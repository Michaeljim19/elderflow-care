import { useState, useEffect, useMemo } from "react"
import { Timestamp } from "firebase/firestore"
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Eye, 
  Phone, 
  MapPin,
  Loader2,
  FileText,    // Add FileText import
  Download,    // Add Download import
  ExternalLink, // Add ExternalLink import
  Calendar,     // Add Calendar import
  RefreshCw     // Add RefreshCw import
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { 
  Caregiver, 
  Patient,
  getMaxPatientsForShift, 
  canCaregiverTakeMorePatients, 
  getAvailablePatientSlots,
  CAREGIVER_PATIENT_LIMITS 
} from "@/types"
import { addCaregiver, getCaregivers, updateCaregiver, deleteCaregiver, syncAllCaregiverPatientCounts, fixCaregiverFields, uploadCaregiverLicense, uploadCaregiverLicenseAsBase64, debugPatientAssignments, forceSyncCaregiverPatientCount } from "@/services/firebase/caregivers"
import { normalizeCaregiverAddress } from "@/services/firebase/caregiverRecordSync"
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPatients, updatePatient, getPatientsByCaregiver } from "@/services/firebase/patients"
import { getCaregiverTodayShifts, testCaregiverShiftIndex } from "@/services/firebase/caregiverShifts"
import { addressService, Province, CityMunicipality, Barangay } from "@/services/address"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import FileUpload from "@/components/ui/file-upload"    // Add FileUpload import

const Caregivers = () => {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [addingCaregiver, setAddingCaregiver] = useState(false)
  const [editingCaregiver, setEditingCaregiver] = useState<Caregiver | null>(null)
  const [updatingCaregiver, setUpdatingCaregiver] = useState(false)
  const [deletingCaregiver, setDeletingCaregiver] = useState<string | null>(null)
  const [viewingCaregiver, setViewingCaregiver] = useState<Caregiver | null>(null)
  const [assignedPatients, setAssignedPatients] = useState<Patient[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [syncingCounts, setSyncingCounts] = useState(false)
  const [caregiverAvailability, setCaregiverAvailability] = useState<Record<string, 'available' | 'scheduled' | 'loading'>>({})
  const { toast } = useToast()

  // PSGC API states for address dropdowns
  const [provinces, setProvinces] = useState<Province[]>([])
  const [cities, setCities] = useState<CityMunicipality[]>([])
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [loadingAddressData, setLoadingAddressData] = useState(false)

  // Helper functions for date and timestamp handling
  const calculateShiftEndDate = (startDate: string): string => {
    if (!startDate) return "";
    
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 3);
    
    return end.toISOString().split('T')[0];
  };

  const dateToTimestamp = (dateString: string): Timestamp => {
    if (!dateString) return Timestamp.now();
    return Timestamp.fromDate(new Date(dateString));
  };

  const timestampToDate = (timestamp: any): string => {
    if (!timestamp) return "";
    if (timestamp.toDate) {
      return timestamp.toDate().toISOString().split('T')[0];
    }
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
    }
    return "";
  };

  // Get tomorrow's date in YYYY-MM-DD format for date input min attribute (excluding today)
  const getTomorrowDate = (): string => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const isNewlyRegisteredCaregiver = (caregiver: Caregiver | null): boolean => {
    if (!caregiver) {
      return false
    }

    return (caregiver.status || '').toString().trim().toLowerCase() === 'pending'
  }

  // Helper function to check if license image is valid
  const isValidLicenseImage = (licenseUrl?: string): boolean => {
    if (!licenseUrl) return false;
    // Check if it's a base64 image or a valid URL
    return licenseUrl.startsWith('data:image/') || licenseUrl.startsWith('http');
  };

  // Helper function to format address into readable string
  const formatAddress = (caregiverOrAddress: any): string => {
    const normalizedAddress = normalizeCaregiverAddress(caregiverOrAddress?.address ?? caregiverOrAddress)
    const parts = [
      normalizedAddress.street,
      normalizedAddress.barangay,
      normalizedAddress.city_municipality,
      normalizedAddress.province
    ].filter(part => part && part.trim() !== '')

    return parts.length > 0 ? parts.join(', ') : "Not provided"
  };

  // Helper function to get file extension from license URL
  const getLicenseFileExtension = (licenseUrl: string): string => {
    if (licenseUrl.startsWith('data:image/')) {
      const mimeMatch = licenseUrl.match(/data:image\/([a-zA-Z0-9]+);/);
      return mimeMatch ? mimeMatch[1] : 'jpg';
    }
    return licenseUrl.split('.').pop()?.toLowerCase() || 'jpg';
  };

  // Load assigned patients for a caregiver
  const loadAssignedPatients = async (caregiverId: string) => {
    try {
      console.log(`🔄 [loadAssignedPatients] Starting to load patients for caregiver: ${caregiverId}`);
      setLoadingPatients(true)
      setAssignedPatients([]) // Clear previous data
      
      if (!caregiverId) {
        console.warn("No caregiver ID provided")
        return
      }
      
      const patients = await getPatientsByCaregiver(caregiverId)
      console.log(`🔄 [loadAssignedPatients] Received ${patients.length} patients:`, patients);
      setAssignedPatients(patients)
    } catch (error) {
      console.error("Error loading assigned patients:", error)
      toast({
        title: "Error",
        description: "Failed to load assigned patients. Please try again.",
        variant: "destructive"
      })
      setAssignedPatients([])
    } finally {
      setLoadingPatients(false)
    }
  };

  // Handle viewing caregiver details and load assigned patients
  const handleViewCaregiver = async (caregiver: Caregiver) => {
    setViewingCaregiver(caregiver)
    if (caregiver.caregiver_id) {
      await loadAssignedPatients(caregiver.caregiver_id)
    }
  };

  // Handle syncing all caregiver patient counts
  const handleSyncPatientCounts = async () => {
    try {
      setSyncingCounts(true)
      
      // First fix any missing fields in existing caregivers
      await fixCaregiverFields()
      
      // Then sync all patient counts
      await syncAllCaregiverPatientCounts()
      
      // Refresh caregivers data to show updated counts
      const updatedCaregivers = await getCaregivers()
      setCaregivers(updatedCaregivers)
      
      toast({
        title: "Success",
        description: "Patient counts synchronized successfully for all caregivers.",
      })
    } catch (error) {
      console.error("Error syncing patient counts:", error)
      toast({
        title: "Error",
        description: "Failed to sync patient counts. Please try again.",
        variant: "destructive"
      })
    } finally {
      setSyncingCounts(false)
    }
  };

  const runBackgroundMaintenance = async () => {
    try {
      console.log('Auto-syncing patient counts to ensure accuracy...');
      await syncAllCaregiverPatientCounts();

      const updatedCaregivers = await getCaregivers();
      setCaregivers(updatedCaregivers);
      await checkCaregiverAvailability(updatedCaregivers);

      console.log('Checking for capacity violations after sync...');
      const capacityResult = await checkAndFixAllCaregiverCapacities();
      if (capacityResult.fixed > 0) {
        console.log(`Auto-fixed ${capacityResult.fixed} patient assignments`);
        const finalCaregivers = await getCaregivers();
        setCaregivers(finalCaregivers);
        await checkCaregiverAvailability(finalCaregivers);
      }
    } catch (syncError) {
      console.error('Auto-sync failed:', syncError);
    }
  };

  // Update the formData state to include license fields
  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    birthday: "",
    email: "",
    contact_number: "",
    address: {
      province: "",
      city_municipality: "",
      barangay: "",
      street: ""
    },
    // Selected codes for PSGC API
    selectedProvinceCode: "",
    selectedCityCode: "",
    selectedBarangayCode: "",
    shift_type: undefined as "Day" | "Night" | undefined,
    shift_start_date: "",
    shift_end_date: "",
    role: "Eldercare" as "Eldercare",
    assigned_patients_count: 0,
    max_patients: 0,
    license_number: "",    // Add license number field
    license_picture: "",   // Add license picture field
    contract_start_date: "", // Add contract start date field
    contract_end_date: ""    // Add contract end date field
  })

  // Add license file state
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)

  const normalizePhilippineContactNumber = (value: string) => {
    const digits = value.replace(/\D/g, '')

    if (digits.startsWith('63') && digits.length === 12) {
      return `0${digits.slice(2)}`
    }

    if (digits.startsWith('9') && digits.length === 10) {
      return `0${digits}`
    }

    return digits
  }

  const isValidPhilippineContactNumber = (value: string) => /^09\d{9}$/.test(value)

  const normalizeAddressForEdit = (caregiverOrAddress: any) => normalizeCaregiverAddress(caregiverOrAddress?.address ?? caregiverOrAddress)

  // Helper function to check caregiver availability
  const checkCaregiverAvailability = async (caregivers: Caregiver[]) => {
    try {
      // Set all as loading initially
      const loadingStatus: Record<string, 'available' | 'scheduled' | 'loading'> = {}
      caregivers.forEach(caregiver => {
        loadingStatus[caregiver.caregiver_id] = 'loading'
      })
      setCaregiverAvailability(loadingStatus)

      // Check each caregiver's today shifts
      const availabilityPromises = caregivers.map(async (caregiver) => {
        try {
          const todayShifts = await getCaregiverTodayShifts(caregiver.caregiver_id)
          return {
            caregiverId: caregiver.caregiver_id,
            status: todayShifts.length > 0 ? 'scheduled' : 'available'
          }
        } catch (error) {
          console.error(`Error checking availability for caregiver ${caregiver.caregiver_id}:`, error)
          return {
            caregiverId: caregiver.caregiver_id,
            status: 'available' // Default to available on error
          }
        }
      })

      const results = await Promise.all(availabilityPromises)
      const finalStatus: Record<string, 'available' | 'scheduled' | 'loading'> = {}
      results.forEach(result => {
        finalStatus[result.caregiverId] = result.status as 'available' | 'scheduled'
      })
      setCaregiverAvailability(finalStatus)
    } catch (error) {
      console.error('Error checking caregiver availability:', error)
    }
  }

  // Load caregivers on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const caregiversData = await getCaregivers()
        setCaregivers(caregiversData)
        
        // Check availability for all caregivers
        await checkCaregiverAvailability(caregiversData)

        void runBackgroundMaintenance()
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "Failed to load eldercares data. Please try again.",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [toast])

  // Load provinces on component mount
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        setLoadingAddressData(true)
        const provincesData = await addressService.getProvinces()
        setProvinces(provincesData)
      } catch (error) {
        console.error("Error loading provinces:", error)
        toast({
          title: "Error",
          description: "Failed to load provinces data.",
          variant: "destructive"
        })
      } finally {
        setLoadingAddressData(false)
      }
    }
    
    loadProvinces()
  }, [toast])

  // PSGC API functions
  const handleProvinceChange = async (provinceCode: string) => {
    const selectedProvince = provinces.find(p => p.code === provinceCode)
    if (!selectedProvince) return

    setFormData(prev => ({
      ...prev,
      selectedProvinceCode: provinceCode,
      selectedCityCode: "",
      selectedBarangayCode: "",
      address: {
        ...prev.address,
        province: selectedProvince.name,
        city_municipality: "",
        barangay: ""
      }
    }))

    // Reset dependent dropdowns
    setCities([])
    setBarangays([])

    // Load cities for selected province
    try {
      setLoadingAddressData(true)
      const citiesData = await addressService.getCitiesByProvince(provinceCode)
      setCities(citiesData)
    } catch (error) {
      console.error("Error loading cities:", error)
      toast({
        title: "Error",
        description: "Failed to load cities/municipalities.",
        variant: "destructive"
      })
    } finally {
      setLoadingAddressData(false)
    }
  }

  const handleCityChange = async (cityCode: string) => {
    const selectedCity = cities.find(c => c.code === cityCode)
    if (!selectedCity) return

    setFormData(prev => ({
      ...prev,
      selectedCityCode: cityCode,
      selectedBarangayCode: "",
      address: {
        ...prev.address,
        city_municipality: selectedCity.name,
        barangay: ""
      }
    }))

    // Reset barangays
    setBarangays([])

    // Load barangays for selected city
    try {
      setLoadingAddressData(true)
      const barangaysData = await addressService.getBarangaysByCity(cityCode)
      setBarangays(barangaysData)
    } catch (error) {
      console.error("Error loading barangays:", error)
      toast({
        title: "Error",
        description: "Failed to load barangays.",
        variant: "destructive"
      })
    } finally {
      setLoadingAddressData(false)
    }
  }

  const handleBarangayChange = (barangayCode: string) => {
    const selectedBarangay = barangays.find(b => b.code === barangayCode)
    if (!selectedBarangay) return

    setFormData(prev => ({
      ...prev,
      selectedBarangayCode: barangayCode,
      address: {
        ...prev.address,
        barangay: selectedBarangay.name
      }
    }))
  }

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1]
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }))
    } else if (field === 'shift_start_date') {
      // Validate that the selected date is in the future (not today or past)
      const selectedDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set time to start of day for accurate comparison
      
      if (selectedDate <= today) {
        toast({
          title: "Invalid Date",
          description: "Shift start date must be in the future. Please select a date after today.",
          variant: "destructive"
        });
        return; // Don't update the form data if date is invalid
      }
      
      // Auto-calculate shift end date when start date changes
      const endDate = calculateShiftEndDate(value);
      setFormData(prev => ({ 
        ...prev, 
        [field]: value,
        shift_end_date: endDate
      }))
    } else if (field === 'shift_type') {
      // Auto-set max_patients based on shift type
      const maxPatients = getMaxPatientsForShift(value as "Day" | "Night");
      setFormData(prev => ({ 
        ...prev, 
        [field]: value as "Day" | "Night",
        max_patients: maxPatients
      }))
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const handleAddCaregiver = async () => {
    const normalizedContactNumber = normalizePhilippineContactNumber(formData.contact_number)

    if (!formData.first_name || !formData.last_name || !formData.birthday || !formData.email || !formData.contact_number || !formData.shift_type || !formData.shift_start_date || !formData.address.province || !formData.address.city_municipality || !formData.address.barangay || !formData.address.street) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (marked with *).",
        variant: "destructive"
      })
      return
    }

    if (!isValidPhilippineContactNumber(normalizedContactNumber)) {
      toast({
        title: "Invalid Contact Number",
        description: "Enter a valid Philippine mobile number like 09XXXXXXXXX or +639XXXXXXXXX.",
        variant: "destructive"
      })
      return
    }

    // Additional validation for shift start date
    const selectedDate = new Date(formData.shift_start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate <= today) {
      toast({
        title: "Invalid Date",
        description: "Shift start date must be in the future. Please select a date after today.",
        variant: "destructive"
      });
      return;
    }

    try {
      setAddingCaregiver(true)
      
      const newCaregiverData = {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        birthday: formData.birthday,
        email: formData.email,
        contact_number: normalizedContactNumber,
        address: formData.address,
        shift_type: formData.shift_type as "Day" | "Night",
        shift_start_date: formData.shift_start_date ? dateToTimestamp(formData.shift_start_date) : undefined,
        shift_end_date: formData.shift_end_date ? dateToTimestamp(formData.shift_end_date) : undefined,
        role: "Eldercare" as "Eldercare",
        assigned_patients_count: 0, // New caregivers start with 0 assigned patients
        max_patients: formData.max_patients,
        license_number: formData.license_number,
        license_picture: "", // Will be updated after caregiver is created
        contract_start_date: formData.contract_start_date,
        contract_end_date: formData.contract_end_date
      }

      // Helper function to safely create Timestamps
      const safeTimestamp = (dateValue: any): Timestamp | undefined => {
        if (!dateValue) return undefined;
        
        try {
          // If it's already a Timestamp, return it
          if (dateValue instanceof Timestamp) {
            return dateValue;
          }
          
          // If it's a string, try to parse it
          if (typeof dateValue === 'string') {
            if (dateValue.trim() === '') return undefined;
            const date = new Date(dateValue);
            if (isNaN(date.getTime())) {
              console.warn('Invalid date string:', dateValue);
              return undefined;
            }
            return Timestamp.fromDate(date);
          }
          
          // If it's already a Date object
          if (dateValue instanceof Date) {
            if (isNaN(dateValue.getTime())) {
              console.warn('Invalid Date object:', dateValue);
              return undefined;
            }
            return Timestamp.fromDate(dateValue);
          }
          
          console.warn('Unknown date format:', dateValue, typeof dateValue);
          return undefined;
        } catch (error) {
          console.warn('Error creating timestamp for:', dateValue, error);
          return undefined;
        }
      };

      // Create the caregiver using the caregivers service
      const caregiverId = await addCaregiver({
        first_name: newCaregiverData.first_name,
        last_name: newCaregiverData.last_name,
        middle_name: newCaregiverData.middle_name,
        birthday: newCaregiverData.birthday,
        email: newCaregiverData.email,
        contact_number: newCaregiverData.contact_number,
        address: newCaregiverData.address,
        shift_type: newCaregiverData.shift_type,
        shift_start_date: safeTimestamp(newCaregiverData.shift_start_date),
        shift_end_date: safeTimestamp(newCaregiverData.shift_end_date),
        role: newCaregiverData.role,
        license_number: newCaregiverData.license_number,
        contract_start_date: newCaregiverData.contract_start_date,
        contract_end_date: newCaregiverData.contract_end_date
      });

      // If a license file is selected, upload it using the real caregiver ID
      if (licenseFile && caregiverId) {
        try {
          console.log('Attempting Firebase Storage upload...')
          const uploadedLicenseUrl = await uploadCaregiverLicense(caregiverId, licenseFile, setUploadProgress)
          // Update the caregiver with the license URL
          await updateCaregiver(caregiverId, { license_picture: uploadedLicenseUrl })
          console.log('Firebase Storage upload successful')
        } catch (uploadError) {
          console.error('Firebase Storage upload failed:', uploadError)
          
          try {
            // Fallback to base64 storage
            console.log('Attempting base64 fallback...')
            const base64Data = await uploadCaregiverLicenseAsBase64(caregiverId, licenseFile)
            await updateCaregiver(caregiverId, { license_picture: base64Data })
            console.log('Base64 fallback successful')
            
            toast({
              title: "Upload Complete",
              description: "License uploaded successfully using fallback method.",
            })
          } catch (fallbackError) {
            console.error('Base64 fallback also failed:', fallbackError)
            
            const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
            
            toast({
              title: "Upload Failed",
              description: `License upload failed: ${errorMessage}. Caregiver was created successfully. You can try uploading the license again by editing the caregiver.`,
              variant: "destructive"
            })
          }
        }
      }
      
      // Refresh caregivers list
      const updatedCaregivers = await getCaregivers()
      setCaregivers(updatedCaregivers)
      
      // Reset form and close dialog
      setFormData({
        first_name: "",
        middle_name: "",
        last_name: "",
        birthday: "",
        email: "",
        contact_number: "",
        address: {
          province: "",
          city_municipality: "",
          barangay: "",
          street: ""
        },
        selectedProvinceCode: "",
        selectedCityCode: "",
        selectedBarangayCode: "",
        shift_type: undefined,
        shift_start_date: "",
        shift_end_date: "",
        role: "Eldercare",
        assigned_patients_count: 0,
        max_patients: 0,
        license_number: "",
        license_picture: "",
        contract_start_date: "",
        contract_end_date: ""
      })
      setLicenseFile(null)
      setSelectedFiles([])
      setUploadProgress(0)
      setIsAddDialogOpen(false)
      
      toast({
        title: "Success",
        description: `Eldercare ${formData.first_name} ${formData.last_name} has been added successfully! Check the console for login credentials and any email notifications.`,
        duration: 6000
      })
      
    } catch (error) {
      console.error("Error adding caregiver:", error)
      toast({
        title: "Error",
        description: "Failed to add eldercare. Please try again.",
        variant: "destructive"
      })
    } finally {
      setAddingCaregiver(false)
      setUploadProgress(0)
    }
  }

  // Edit caregiver function
  const handleEdit = (caregiver: Caregiver) => {
    setEditingCaregiver(caregiver)
    // Pre-populate form with existing data
    setFormData({
      first_name: caregiver.first_name || "",
      middle_name: caregiver.middle_name || "",
      last_name: caregiver.last_name || "",
      birthday: caregiver.birthday || "",
      email: caregiver.email || "",
      contact_number: caregiver.contact_number?.toString() || "",
      address: normalizeAddressForEdit(caregiver),
      selectedProvinceCode: "",
      selectedCityCode: "",
      selectedBarangayCode: "",
      shift_type: caregiver.shift_type || undefined,
      shift_start_date: timestampToDate(caregiver.shift_start_date) || "",
      shift_end_date: timestampToDate(caregiver.shift_end_date) || "",
      role: "Eldercare",
      assigned_patients_count: caregiver.assigned_patients_count || 0,
      max_patients: caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type),
      license_number: caregiver.license_number || "",      // Include license number
      license_picture: caregiver.license_picture || "",    // Include license picture
      contract_start_date: caregiver.contract_start_date || "", // Include contract start date
      contract_end_date: caregiver.contract_end_date || ""     // Include contract end date
    })
  }

  useEffect(() => {
    if (!editingCaregiver || provinces.length === 0) {
      return
    }

    const caregiverAddress = normalizeAddressForEdit(editingCaregiver)
    if (!caregiverAddress.province) {
      return
    }

    let isCancelled = false

    const hydrateAddressSelection = async () => {
      try {
        const selectedProvince = provinces.find(province => 
          province.code === caregiverAddress.province || province.name === caregiverAddress.province
        )

        if (!selectedProvince || isCancelled) {
          return
        }

        setFormData(prev => ({
          ...prev,
          selectedProvinceCode: selectedProvince.code
        }))

        const citiesData = await addressService.getCitiesByProvince(selectedProvince.code)
        if (isCancelled) {
          return
        }

        setCities(citiesData)

        const selectedCity = citiesData.find(city => 
          city.code === caregiverAddress.city_municipality || city.name === caregiverAddress.city_municipality
        )

        if (!selectedCity || isCancelled) {
          return
        }

        setFormData(prev => ({
          ...prev,
          selectedCityCode: selectedCity.code
        }))

        const barangaysData = await addressService.getBarangaysByCity(selectedCity.code)
        if (isCancelled) {
          return
        }

        setBarangays(barangaysData)

        const selectedBarangay = barangaysData.find(barangay => 
          barangay.code === caregiverAddress.barangay || barangay.name === caregiverAddress.barangay
        )

        if (selectedBarangay && !isCancelled) {
          setFormData(prev => ({
            ...prev,
            selectedBarangayCode: selectedBarangay.code
          }))
        }
      } catch (error) {
        console.error('Error loading address data for editing:', error)
        toast({
          title: "Warning",
          description: "Could not load address dropdown data for editing.",
          variant: "destructive"
        })
      }
    }

    void hydrateAddressSelection()

    return () => {
      isCancelled = true
    }
  }, [editingCaregiver?.caregiver_id, editingCaregiver?.address, provinces, toast])

  // Auto-update caregiver status based on shift dates
  const updateCaregiverStatusByDates = async () => {
    try {
      console.log('🔄 Updating caregiver status based on shift dates...')
      
      const allCaregivers = await getCaregivers()
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Start of today
      
      let updated = 0
      
      for (const caregiver of allCaregivers) {
        const isApprovedCaregiver = caregiver.auth_created === true || caregiver.verified === true || caregiver.emailVerified === true || caregiver.email_verified === true || caregiver.is_active === true || caregiver.status === 'Active'
        let expectedStatus: 'pending' | 'Active' | 'Inactive' | 'On Leave' = isApprovedCaregiver ? 'Active' : 'pending'
        
        // Check if caregiver has shift dates
        if (caregiver.shift_start_date && caregiver.shift_end_date) {
          const startDate = new Date(timestampToDate(caregiver.shift_start_date))
          const endDate = new Date(timestampToDate(caregiver.shift_end_date))
          
          // Caregiver should be active if today is between start and end dates (inclusive)
          expectedStatus = today >= startDate && today <= endDate ? 'Active' : 'Inactive'
        } else if (caregiver.shift_start_date) {
          // If only start date is set, active from start date onwards
          const startDate = new Date(timestampToDate(caregiver.shift_start_date))
          expectedStatus = today >= startDate ? 'Active' : 'Inactive'
        } else if (isApprovedCaregiver) {
          expectedStatus = 'Active'
        } else {
          // If no shift dates, treat the caregiver as pending until contract details exist
          expectedStatus = 'pending'
        }
        
        const currentStatus = caregiver.status || 'pending'
        
        // Update if status doesn't match what it should be
        if (currentStatus !== expectedStatus) {
          await updateCaregiver(caregiver.caregiver_id, { status: expectedStatus })
          console.log(`   ✅ Updated ${caregiver.first_name} ${caregiver.last_name}: ${currentStatus} → ${expectedStatus}`)
          updated++
        }
      }
      
      console.log(`✅ Status update complete: ${updated} caregivers updated`)
      return updated
    } catch (error) {
      console.error('Error updating caregiver status:', error)
      throw error
    }
  }

  // Function to generate a capacity status report
  const generateCapacityReport = async () => {
    try {
      const allCaregivers = await getCaregivers()
      
      console.log(`\n📊 CAPACITY STATUS REPORT (${new Date().toLocaleString()})`)
      console.log(`=`.repeat(80))
      
      const report = {
        total: allCaregivers.length,
        active: 0,
        inactive: 0,
        overCapacity: 0,
        atCapacity: 0,
        underCapacity: 0,
        dayShift: 0,
        nightShift: 0,
        totalPatients: 0,
        totalCapacity: 0
      }
      
      console.log(`\n🏥 CAREGIVER BREAKDOWN:`)
      allCaregivers.forEach((caregiver, index) => {
        const current = caregiver.assigned_patients_count || 0
        const max = caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type)
        const status = caregiver.status || 'Unknown'
        const shift = caregiver.shift_type
        
        // Update report stats
        if (status === 'Active') report.active++
        else report.inactive++
        
        if (current > max) report.overCapacity++
        else if (current === max) report.atCapacity++
        else report.underCapacity++
        
        if (shift === 'Day') report.dayShift++
        else if (shift === 'Night') report.nightShift++
        
        report.totalPatients += current
        report.totalCapacity += max
        
        // Status indicators
        let indicator = '✅'
        if (current > max) indicator = '🚨'
        else if (current === max) indicator = '⚠️'
        else if (status !== 'Active') indicator = '❌'
        
        console.log(`${indicator} ${index + 1}. ${caregiver.first_name} ${caregiver.last_name}`)
        console.log(`     Patients: ${current}/${max} | Shift: ${shift} | Status: ${status}`)
        
        if (current > max) {
          console.log(`     🔥 OVER CAPACITY BY ${current - max} PATIENTS!`)
        }
      })
      
      console.log(`\n📈 SUMMARY STATISTICS:`)
      console.log(`   Total Caregivers: ${report.total}`)
      console.log(`   Active: ${report.active} | Inactive: ${report.inactive}`)
      console.log(`   Day Shift: ${report.dayShift} | Night Shift: ${report.nightShift}`)
      console.log(`   Total Patients: ${report.totalPatients}`)
      console.log(`   Total Capacity: ${report.totalCapacity}`)
      console.log(`   System Utilization: ${((report.totalPatients / report.totalCapacity) * 100).toFixed(1)}%`)
      
      console.log(`\n⚡ CAPACITY STATUS:`)
      console.log(`   🚨 Over Capacity: ${report.overCapacity} caregivers`)
      console.log(`   ⚠️ At Capacity: ${report.atCapacity} caregivers`)
      console.log(`   ✅ Under Capacity: ${report.underCapacity} caregivers`)
      
      if (report.overCapacity > 0 && report.underCapacity === 0) {
        console.log(`\n💡 RECOMMENDATIONS:`)
        console.log(`   1. 🚨 URGENT: ${report.overCapacity} caregivers are over capacity`)
        console.log(`   2. 📝 No caregivers have available capacity for redistribution`)
        console.log(`   3. 🆕 Consider adding more caregivers to the system`)
        console.log(`   4. 📊 Consider increasing capacity limits for existing caregivers`)
        console.log(`   5. 🔄 Review patient assignments and shift distributions`)
      }
      
      console.log(`=`.repeat(80))
      
      return report
    } catch (error) {
      console.error('❌ Error generating capacity report:', error)
      return null
    }
  }

  // Function to check and fix all caregivers who exceed their patient limits
  const checkAndFixAllCaregiverCapacities = async () => {
    try {
      console.log('🔍 Checking all caregivers for capacity violations...')
      
      const allCaregivers = await getCaregivers()
      const violatingCaregivers = []
      
      // Check each caregiver for capacity violations
      for (const caregiver of allCaregivers) {
        const currentPatients = caregiver.assigned_patients_count || 0
        const maxPatients = caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type)
        
        if (currentPatients > maxPatients) {
          console.log(`⚠️ Found violation: ${caregiver.first_name} ${caregiver.last_name} has ${currentPatients}/${maxPatients} patients (${caregiver.shift_type} shift)`)
          violatingCaregivers.push({
            caregiver,
            currentPatients,
            maxPatients,
            excess: currentPatients - maxPatients
          })
        }
      }
      
      if (violatingCaregivers.length === 0) {
        console.log('✅ No capacity violations found - all caregivers are within their limits')
        return {
          fixed: 0,
          failed: 0,
          violatingCaregivers: 0,
          message: 'All caregivers are within their patient limits'
        }
      }
      
      console.log(`🚨 Found ${violatingCaregivers.length} caregivers exceeding their limits:`)
      violatingCaregivers.forEach(v => {
        console.log(`   - ${v.caregiver.first_name} ${v.caregiver.last_name}: ${v.currentPatients}/${v.maxPatients} (excess: ${v.excess})`)
      })
      
      let totalFixed = 0
      let totalFailed = 0
      const redistributionResults = []
      
      // Fix each violating caregiver
      for (const violation of violatingCaregivers) {
        console.log(`\n🔧 Fixing caregiver: ${violation.caregiver.first_name} ${violation.caregiver.last_name}`)
        console.log(`   Current: ${violation.currentPatients} patients, Max: ${violation.maxPatients}, Excess: ${violation.excess}`)
        
        const result = await redistributePatientsOnShiftChange(
          violation.caregiver.caregiver_id,
          violation.caregiver.shift_type
        )
        
        totalFixed += result.redistributed
        totalFailed += result.failed
        
        redistributionResults.push({
          caregiver: `${violation.caregiver.first_name} ${violation.caregiver.last_name}`,
          result: result
        })
        
        if (result.redistributed > 0) {
          console.log(`✅ Successfully redistributed ${result.redistributed} patients`)
          result.transferredPatients.forEach(transfer => {
            console.log(`   → ${transfer.patient} → ${transfer.toCaregiver} (${transfer.targetShift} shift)`)
          })
        }
        
        if (result.failed > 0) {
          console.log(`❌ Failed to redistribute ${result.failed} patients`)
          if (result.details) {
            console.log(`   📊 System Status:`)
            console.log(`      - Total other caregivers: ${result.details.totalCaregivers}`)
            console.log(`      - Active caregivers: ${result.details.activeCaregivers}`)
            console.log(`      - Available caregivers: ${result.details.availableCaregivers}`)
            console.log(`   💡 Suggestion: ${result.details.suggestion}`)
          }
        }
      }
      
      console.log(`\n📊 Summary: Fixed ${totalFixed} assignments, Failed ${totalFailed} assignments across ${violatingCaregivers.length} caregivers`)
      
      return {
        fixed: totalFixed,
        failed: totalFailed,
        violatingCaregivers: violatingCaregivers.length,
        redistributionResults: redistributionResults,
        message: `Fixed ${totalFixed} patient assignments across ${violatingCaregivers.length} caregivers${totalFailed > 0 ? ` (${totalFailed} failed)` : ''}`
      }
      
    } catch (error) {
      console.error('❌ Error checking caregiver capacities:', error)
      return {
        fixed: 0,
        failed: 0,
        violatingCaregivers: 0,
        message: 'Failed to check caregiver capacities',
        error: true
      }
    }
  }

  // Function to redistribute patients when caregiver shifts change
  const redistributePatientsOnShiftChange = async (
    caregiverId: string, 
    newShiftType: 'Day' | 'Night'
  ) => {
    try {
      console.log(`\n🔄 Starting patient redistribution for caregiver ${caregiverId} with ${newShiftType} shift`)
      
      // Get all assigned patients for this caregiver
      console.log(`📋 Getting assigned patients for caregiver ${caregiverId}...`)
      const assignedPatients = await getPatientsByCaregiver(caregiverId)
      console.log(`📋 Found ${assignedPatients.length} assigned patients:`)
      assignedPatients.forEach(p => console.log(`   - ${p.first_name} ${p.last_name} (ID: ${p.patient_id})`))
      
      // Calculate new max patients based on new shift type
      const newMaxPatients = getMaxPatientsForShift(newShiftType)
      console.log(`📊 Maximum patients for ${newShiftType} shift: ${newMaxPatients}`)
      
      if (assignedPatients.length <= newMaxPatients) {
        console.log(`✅ Caregiver can keep all ${assignedPatients.length} patients within limit of ${newMaxPatients}`)
        return {
          redistributed: 0,
          failed: 0,
          transferredPatients: [],
          message: `Caregiver can keep all ${assignedPatients.length} patients within new limit of ${newMaxPatients}`
        }
      }

      // Need to redistribute excess patients
      const excessCount = assignedPatients.length - newMaxPatients
      console.log(`⚠️ Need to redistribute ${excessCount} excess patients (${assignedPatients.length} - ${newMaxPatients})`)
      
      // Sort patients by name for consistent transfer order
      const patientsToTransfer = assignedPatients
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
        .slice(0, excessCount) // Transfer the first N patients based on sort
      
      console.log(`📤 Patients selected for transfer:`)
      patientsToTransfer.forEach(p => console.log(`   → ${p.first_name} ${p.last_name}`))
      
      // Get all caregivers to find available capacity
      console.log(`🏥 Getting all caregivers to find available capacity...`)
      const allCaregivers = await getCaregivers()
      console.log(`🏥 Found ${allCaregivers.length} total caregivers`)
      
      // Find caregivers with available capacity
      const availableCaregivers = allCaregivers.filter(caregiver => {
        if (caregiver.caregiver_id === caregiverId) return false // Exclude current caregiver
        if (caregiver.status !== 'Active') return false // Only active caregivers
        
        const currentPatientCount = caregiver.assigned_patients_count || 0
        const maxPatients = caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type)
        
        return currentPatientCount < maxPatients
      })

      console.log(`🏥 Found ${availableCaregivers.length} available caregivers with capacity:`)
      availableCaregivers.forEach(c => {
        const current = c.assigned_patients_count || 0
        const max = c.max_patients || getMaxPatientsForShift(c.shift_type)
        console.log(`   - ${c.first_name} ${c.last_name}: ${current}/${max} patients (${c.shift_type} shift)`)
      })

      if (availableCaregivers.length === 0) {
        console.log(`❌ No available caregivers found for redistribution`)
        
        // Show detailed breakdown of why no caregivers are available
        console.log(`\n📋 Detailed breakdown of all caregivers:`)
        allCaregivers
          .filter(c => c.caregiver_id !== caregiverId)
          .forEach(c => {
            const current = c.assigned_patients_count || 0
            const max = c.max_patients || getMaxPatientsForShift(c.shift_type)
            const status = c.status || 'Unknown'
            console.log(`   - ${c.first_name} ${c.last_name}: ${current}/${max} patients (${c.shift_type} shift, Status: ${status})`)
          })
        
        // Check if we can find caregivers who are closest to having capacity
        const nearCapacityCaregivers = allCaregivers
          .filter(caregiver => {
            if (caregiver.caregiver_id === caregiverId) return false
            if (caregiver.status !== 'Active') return false
            return true
          })
          .map(caregiver => {
            const current = caregiver.assigned_patients_count || 0
            const max = caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type)
            return {
              caregiver,
              current,
              max,
              available: max - current,
              overage: current - max
            }
          })
          .sort((a, b) => b.available - a.available) // Sort by most available first
        
        console.log(`\n💡 Suggested actions:`)
        if (nearCapacityCaregivers.length > 0) {
          console.log(`   1. Consider increasing capacity limits for caregivers`)
          console.log(`   2. Add more active caregivers to the system`)
          console.log(`   3. Caregivers closest to having capacity:`)
          nearCapacityCaregivers.slice(0, 3).forEach(c => {
            if (c.available >= 0) {
              console.log(`      - ${c.caregiver.first_name} ${c.caregiver.last_name}: ${c.current}/${c.max} (${c.available} available)`)
            } else {
              console.log(`      - ${c.caregiver.first_name} ${c.caregiver.last_name}: ${c.current}/${c.max} (${Math.abs(c.overage)} over limit)`)
            }
          })
        }
        
        return {
          redistributed: 0,
          failed: excessCount,
          transferredPatients: [],
          message: `Cannot redistribute ${excessCount} patients - no available caregivers with capacity. Consider adding more caregivers or increasing capacity limits.`,
          error: true,
          details: {
            totalCaregivers: allCaregivers.length - 1, // Exclude current caregiver
            activeCaregivers: allCaregivers.filter(c => c.caregiver_id !== caregiverId && c.status === 'Active').length,
            availableCaregivers: 0,
            suggestion: nearCapacityCaregivers.length > 0 
              ? `Consider increasing capacity for ${nearCapacityCaregivers[0].caregiver.first_name} ${nearCapacityCaregivers[0].caregiver.last_name}`
              : 'Add more active caregivers to the system'
          }
        }
      }

      // Sort available caregivers by shift type preference and available capacity
      availableCaregivers.sort((a, b) => {
        // Prefer caregivers with the same shift type first
        const aShiftMatch = a.shift_type === newShiftType ? 1 : 0
        const bShiftMatch = b.shift_type === newShiftType ? 1 : 0
        
        if (aShiftMatch !== bShiftMatch) {
          return bShiftMatch - aShiftMatch
        }
        
        // Then sort by available capacity (most available first)
        const aAvailable = (a.max_patients || getMaxPatientsForShift(a.shift_type)) - (a.assigned_patients_count || 0)
        const bAvailable = (b.max_patients || getMaxPatientsForShift(b.shift_type)) - (b.assigned_patients_count || 0)
        
        return bAvailable - aAvailable
      })

      const transferResults = []
      let successfulTransfers = 0
      let failedTransfers = 0
      
      console.log(`\n🔄 Starting patient transfers:`)
      
      // Transfer patients to available caregivers
      for (const patient of patientsToTransfer) {
        let transferred = false
        console.log(`\n👤 Transferring ${patient.first_name} ${patient.last_name}...`)
        
        // Try to assign to an available caregiver
        for (const targetCaregiver of availableCaregivers) {
          const currentCount = targetCaregiver.assigned_patients_count || 0
          const maxPatients = targetCaregiver.max_patients || getMaxPatientsForShift(targetCaregiver.shift_type)
          
          if (currentCount < maxPatients) {
            try {
              console.log(`   ➡️ Attempting transfer to ${targetCaregiver.first_name} ${targetCaregiver.last_name} (${currentCount}/${maxPatients})`)
              
              // Determine which assignment field to update based on target caregiver's shift
              const updateData: any = {}
              
              if (targetCaregiver.shift_type === 'Day') {
                updateData.assigned_day_caregiver_id = targetCaregiver.caregiver_id
                // Clear night assignment if transferring to day shift
                updateData.assigned_night_caregiver_id = null
                console.log(`   📋 Setting Day shift assignment: ${targetCaregiver.caregiver_id}`)
              } else if (targetCaregiver.shift_type === 'Night') {
                updateData.assigned_night_caregiver_id = targetCaregiver.caregiver_id
                // Clear day assignment if transferring to night shift
                updateData.assigned_day_caregiver_id = null
                console.log(`   📋 Setting Night shift assignment: ${targetCaregiver.caregiver_id}`)
              }
              
              // Also update the legacy assignment field for backward compatibility
              updateData.assigned_caregiver_id = targetCaregiver.caregiver_id
              console.log(`   📋 Update data:`, updateData)
              
              await updatePatient(patient.patient_id, updateData)
              console.log(`   ✅ Patient ${patient.patient_id} updated successfully`)
              
              // Update the target caregiver's patient count locally to prevent double assignment
              targetCaregiver.assigned_patients_count = currentCount + 1
              console.log(`   📊 Updated local count for ${targetCaregiver.first_name}: ${currentCount + 1}`)
              
              transferResults.push({
                patient: `${patient.first_name} ${patient.last_name}`,
                fromCaregiver: caregiverId,
                toCaregiver: `${targetCaregiver.first_name} ${targetCaregiver.last_name}`,
                targetShift: targetCaregiver.shift_type
              })
              
              successfulTransfers++
              transferred = true
              console.log(`   ✅ Successfully transferred to ${targetCaregiver.first_name} ${targetCaregiver.last_name} (${targetCaregiver.shift_type} shift)`)
              break
            } catch (error) {
              console.error(`   ❌ Failed to transfer to ${targetCaregiver.first_name} ${targetCaregiver.last_name}:`, error)
              continue
            }
          } else {
            console.log(`   ⏭️ ${targetCaregiver.first_name} ${targetCaregiver.last_name} at capacity (${currentCount}/${maxPatients})`)
          }
        }
        
        if (!transferred) {
          failedTransfers++
          console.log(`   ❌ Failed to transfer ${patient.first_name} ${patient.last_name} - no available caregivers`)
        }
      }
      
      // Sync patient counts after redistribution
      try {
        console.log(`\n🔄 Syncing patient counts after redistribution...`)
        await syncAllCaregiverPatientCounts()
        console.log(`✅ Patient counts synchronized`)
      } catch (syncError) {
        console.error('❌ Failed to sync patient counts after redistribution:', syncError)
      }
      
      console.log(`\n📊 Redistribution Summary:`)
      console.log(`   ✅ Successful transfers: ${successfulTransfers}`)
      console.log(`   ❌ Failed transfers: ${failedTransfers}`)
      
      return {
        redistributed: successfulTransfers,
        failed: failedTransfers,
        transferredPatients: transferResults,
        message: successfulTransfers > 0 
          ? `Successfully redistributed ${successfulTransfers} patients` 
          : `Failed to redistribute any patients`
      }
      
    } catch (error) {
      console.error('❌ Error redistributing patients:', error)
      return {
        redistributed: 0,
        failed: 0,
        transferredPatients: [],
        message: 'Failed to redistribute patients due to system error',
        error: true
      }
    }
  }

  const handleUpdate = async () => {
    if (!editingCaregiver) return

    const isLimitedEditMode = isNewlyRegisteredCaregiver(editingCaregiver)

    const normalizedContactNumber = normalizePhilippineContactNumber(formData.contact_number)

    if (isLimitedEditMode) {
      if (!formData.shift_type || !formData.shift_start_date || !formData.contract_start_date || !formData.contract_end_date) {
        toast({
          title: "Validation Error",
          description: "Please provide shift details and contract start/end dates.",
          variant: "destructive"
        })
        return
      }
    } else if (!formData.first_name || !formData.last_name || !formData.birthday || !formData.email || !formData.contact_number || !formData.shift_type || !formData.shift_start_date || !formData.address.province || !formData.address.city_municipality || !formData.address.barangay || !formData.address.street) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (marked with *).",
        variant: "destructive"
      })
      return
    }

    if (!isLimitedEditMode && !isValidPhilippineContactNumber(normalizedContactNumber)) {
      toast({
        title: "Invalid Contact Number",
        description: "Enter a valid Philippine mobile number like 09XXXXXXXXX or +639XXXXXXXXX.",
        variant: "destructive"
      })
      return
    }

    // Additional validation for shift start date
    const selectedDate = new Date(formData.shift_start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // For editing, allow keeping the original date even if it's in the past
    const originalStartDate = timestampToDate(editingCaregiver.shift_start_date);
    const isKeepingOriginalDate = formData.shift_start_date === originalStartDate;
    
    if (!isKeepingOriginalDate && selectedDate <= today) {
      toast({
        title: "Invalid Date",
        description: "New shift start date must be in the future. Please select a date after today, or keep the original date.",
        variant: "destructive"
      });
      return;
    }

    try {
      setUpdatingCaregiver(true)
      
      // Store original shift type for comparison
      const originalShiftType = editingCaregiver.shift_type
      const addressValue = {
        province: formData.address?.province || "",
        city_municipality: formData.address?.city_municipality || "",
        barangay: formData.address?.barangay || "",
        street: formData.address?.street || ""
      }
      const preservedAddress = normalizeAddressForEdit(editingCaregiver)
      const normalizedExistingContactNumber = normalizePhilippineContactNumber(editingCaregiver.contact_number?.toString() || "")
      const preservedContactNumber = isValidPhilippineContactNumber(normalizedExistingContactNumber)
        ? Number(normalizedExistingContactNumber)
        : (typeof editingCaregiver.contact_number === "number" ? editingCaregiver.contact_number : 0)
      
      // Debug logging for form data
      console.log('🔍 Edit caregiver form data:', {
        shift_start_date: formData.shift_start_date,
        shift_end_date: formData.shift_end_date,
        original_shift_start_date: editingCaregiver.shift_start_date,
        original_shift_end_date: editingCaregiver.shift_end_date
      })
      
      const fullUpdatedData = {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        birthday: formData.birthday,
        email: formData.email,
        contact_number: Number(normalizedContactNumber),
        address: addressValue,
        shift_type: formData.shift_type as "Day" | "Night",
        shift_start_date: formData.shift_start_date ? dateToTimestamp(formData.shift_start_date) : editingCaregiver.shift_start_date,
        shift_end_date: formData.shift_end_date ? dateToTimestamp(formData.shift_end_date) : editingCaregiver.shift_end_date,
        role: "Eldercare" as "Eldercare",
        assigned_patients_count: formData.assigned_patients_count,
        max_patients: formData.max_patients,
        license_number: formData.license_number,
        license_picture: formData.license_picture,
        contract_start_date: formData.contract_start_date,
        contract_end_date: formData.contract_end_date
      }

      const limitedUpdatedData = {
        first_name: editingCaregiver.first_name || formData.first_name,
        middle_name: editingCaregiver.middle_name || formData.middle_name,
        last_name: editingCaregiver.last_name || formData.last_name,
        birthday: editingCaregiver.birthday || formData.birthday,
        email: editingCaregiver.email || formData.email,
        contact_number: preservedContactNumber,
        address: preservedAddress,
        shift_type: formData.shift_type as "Day" | "Night",
        shift_start_date: formData.shift_start_date ? dateToTimestamp(formData.shift_start_date) : editingCaregiver.shift_start_date,
        shift_end_date: formData.shift_end_date ? dateToTimestamp(formData.shift_end_date) : editingCaregiver.shift_end_date,
        role: (editingCaregiver.role || "Eldercare") as "Eldercare",
        assigned_patients_count: editingCaregiver.assigned_patients_count ?? formData.assigned_patients_count,
        max_patients: formData.shift_type ? getMaxPatientsForShift(formData.shift_type as "Day" | "Night") : editingCaregiver.max_patients,
        license_number: editingCaregiver.license_number || formData.license_number,
        license_picture: editingCaregiver.license_picture || formData.license_picture,
        contract_start_date: formData.contract_start_date,
        contract_end_date: formData.contract_end_date
      }

      const updatedData: any = isLimitedEditMode ? limitedUpdatedData : fullUpdatedData

      // If a new license file is selected, upload it and update the URL
      if (!isLimitedEditMode && licenseFile) {
        try {
          console.log('Attempting Firebase Storage upload for edit...')
          const newLicenseUrl = await uploadCaregiverLicense(editingCaregiver.caregiver_id, licenseFile, setUploadProgress)
          updatedData.license_picture = newLicenseUrl
          console.log('Firebase Storage upload successful for edit')
        } catch (uploadError) {
          console.error('Firebase Storage upload failed for edit:', uploadError)
          
          try {
            // Fallback to base64 storage
            console.log('Attempting base64 fallback for edit...')
            const base64Data = await uploadCaregiverLicenseAsBase64(editingCaregiver.caregiver_id, licenseFile)
            updatedData.license_picture = base64Data
            console.log('Base64 fallback successful for edit')
            
            toast({
              title: "Upload Complete",
              description: "License updated successfully using fallback method.",
            })
          } catch (fallbackError) {
            console.error('Base64 fallback also failed for edit:', fallbackError)
            toast({
              title: "Upload Error",
              description: "Failed to upload new license file. Caregiver will be updated without new license.",
              variant: "destructive"
            })
          }
        }
      }

      await updateCaregiver(editingCaregiver.caregiver_id, updatedData as any)
      
      // Check if shift changed and handle patient redistribution
      const shiftChanged = originalShiftType !== formData.shift_type
      console.log(`🔄 Shift change check: ${originalShiftType} → ${formData.shift_type}, Changed: ${shiftChanged}`)
      
      if (shiftChanged) {
        console.log(`🔄 Shift changed for caregiver ${editingCaregiver.caregiver_id}, starting patient redistribution...`)
        
        toast({
          title: "Shift Changed",
          description: "Checking patient assignments and redistributing if necessary...",
        })
        
        try {
          const redistributionResult = await redistributePatientsOnShiftChange(
            editingCaregiver.caregiver_id,
            formData.shift_type as "Day" | "Night"
          )
          
          console.log('📊 Redistribution result:', redistributionResult)
          
          if (redistributionResult.redistributed > 0) {
            toast({
              title: "Patients Redistributed",
              description: `Successfully transferred ${redistributionResult.redistributed} patient(s) to other caregivers due to shift change.`,
            })
          }
          
          if (redistributionResult.failed > 0) {
            toast({
              title: "Redistribution Warning",
              description: `${redistributionResult.failed} patient(s) could not be redistributed automatically. Please check patient assignments manually.`,
              variant: "destructive"
            })
          }
          
          if (redistributionResult.redistributed === 0 && redistributionResult.failed === 0) {
            toast({
              title: "No Redistribution Needed",
              description: "Caregiver can handle all assigned patients within the new shift limits.",
            })
          }
        } catch (redistributionError) {
          console.error("Error during patient redistribution:", redistributionError)
          toast({
            title: "Redistribution Error",
            description: "Failed to redistribute patients automatically. Please check patient assignments manually.",
            variant: "destructive"
          })
        }
      }
      
      // Refresh caregivers list
      const updatedCaregivers = await getCaregivers()
      setCaregivers(updatedCaregivers)
      
      // Reset form and close dialog
      setEditingCaregiver(null)
      setFormData({
        first_name: "",
        middle_name: "",
        last_name: "",
        birthday: "",
        email: "",
        contact_number: "",
        address: {
          province: "",
          city_municipality: "",
          barangay: "",
          street: ""
        },
        selectedProvinceCode: "",
        selectedCityCode: "",
        selectedBarangayCode: "",
        shift_type: undefined,
        shift_start_date: "",
        shift_end_date: "",
        role: "Eldercare",
        assigned_patients_count: 0,
        max_patients: 0,
        license_number: "",
        license_picture: "",
        contract_start_date: "",
        contract_end_date: ""
      })
      setLicenseFile(null)
      setSelectedFiles([])
      setUploadProgress(0)
      
      toast({
        title: "Success",
        description: `Eldercare ${formData.first_name} ${formData.last_name} has been updated successfully.`
      })
      
    } catch (error) {
      console.error("Error updating caregiver:", error)
      toast({
        title: "Error",
        description: "Failed to update eldercare. Please try again.",
        variant: "destructive"
      })
    } finally {
      setUpdatingCaregiver(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (caregiverId: string) => {
    try {
      setDeletingCaregiver(caregiverId)
      
      await deleteCaregiver(caregiverId)
      
      // Refresh caregivers list
      const updatedCaregivers = await getCaregivers()
      setCaregivers(updatedCaregivers)
      
      toast({
        title: "Success",
        description: "Eldercare has been deleted successfully."
      })
      
    } catch (error) {
      console.error("Error deleting caregiver:", error)
      toast({
        title: "Error",
        description: "Failed to delete eldercare. Please try again.",
        variant: "destructive"
      })
    } finally {
      setDeletingCaregiver(null)
    }
  }

  const caregiverStats = useMemo(() => {
    const dayShiftCount = caregivers.filter(caregiver => caregiver.shift_type === 'Day').length
    const nightShiftCount = caregivers.filter(caregiver => caregiver.shift_type === 'Night').length
    const totalAssignedPatients = caregivers.reduce((total, caregiver) => total + (caregiver.assigned_patients_count || 0), 0)
    const totalCapacity = caregivers.reduce((total, caregiver) => total + (caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type)), 0)

    return {
      dayShiftCount,
      nightShiftCount,
      totalAssignedPatients,
      totalCapacity
    }
  }, [caregivers])

  const filteredCaregivers = useMemo(() => {
    const query = searchTerm.toLowerCase()
    return caregivers.filter(caregiver =>
      (caregiver.first_name || '').toLowerCase().includes(query) ||
      (caregiver.last_name || '').toLowerCase().includes(query) ||
      (caregiver.email || '').toLowerCase().includes(query)
    )
  }, [caregivers, searchTerm])

  const getShiftColor = (shiftType: string) => {
    switch(shiftType) {
      case 'Day': return "bg-blue-100 text-blue-800"
      case 'Night': return "bg-purple-100 text-purple-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const hasCaregiverAvailabilityRequirements = (caregiver: Caregiver) => {
    return Boolean(caregiver.license_number || caregiver.license_picture) && Boolean(caregiver.contract_start_date && caregiver.contract_end_date)
  }

  const getAvailabilityBadge = (caregiver: Caregiver) => {
    if (!hasCaregiverAvailabilityRequirements(caregiver)) {
      const reasons = []

      if (!caregiver.license_number && !caregiver.license_picture) {
        reasons.push('No License')
      }

      if (!(caregiver.contract_start_date && caregiver.contract_end_date)) {
        reasons.push('No Contract')
      }

      return (
        <Badge variant="outline" className="text-red-600 border-red-600 gap-1">
          <div className="w-2 h-2 bg-red-600 rounded-full" />
          Unavailable
          <span className="text-xs font-normal">({reasons.join(' / ')})</span>
        </Badge>
      )
    }

    const status = caregiverAvailability[caregiver.caregiver_id] || 'loading'
    
    switch(status) {
      case 'available':
        return (
          <Badge className="bg-green-100 text-green-800 gap-1">
            <div className="w-2 h-2 bg-green-600 rounded-full" />
            Available
          </Badge>
        )
      case 'scheduled':
        return (
          <Badge className="bg-orange-100 text-orange-800 gap-1">
            <Calendar className="h-3 w-3" />
            Scheduled Today
          </Badge>
        )
      case 'loading':
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking...
          </Badge>
        )
    }
  }

  const isEditingNewlyRegistered = isNewlyRegisteredCaregiver(editingCaregiver)

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xl text-muted-foreground">Loading eldercares...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold text-foreground">Eldercare Management</h1>
          <p className="text-xl text-muted-foreground">Manage eldercare profiles and schedules</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={handleSyncPatientCounts}
            disabled={syncingCounts}
          >
            {syncingCounts ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sync Patient Counts
              </>
            )}
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Eldercare
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Eldercare</DialogTitle>
                <DialogDescription>
                  Enter the eldercare's information to create a new record.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input 
                      id="firstName" 
                      placeholder="Enter first name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Enter last name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input 
                      id="middleName" 
                      placeholder="Enter middle name"
                      value={formData.middle_name}
                      onChange={(e) => handleInputChange("middle_name", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="birthday">Birthday *</Label>
                    <Input 
                      id="birthday" 
                      type="date"
                      value={formData.birthday}
                      onChange={(e) => handleInputChange("birthday", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Contact Number *</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                    value={formData.contact_number}
                    onChange={(e) => handleInputChange("contact_number", e.target.value)}
                  />
                </div>
                
                {/* Address Section with PSGC API */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Address *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="province">Province *</Label>
                      <Select 
                        value={formData.selectedProvinceCode || ""} 
                        onValueChange={handleProvinceChange}
                        disabled={loadingAddressData}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={loadingAddressData ? "Loading provinces..." : "Select province"} />
                        </SelectTrigger>
                        <SelectContent>
                          {provinces.filter(province => province.code && province.code.trim() !== '' && province.name !== 'Pampanga').map((province) => (
                            <SelectItem key={province.code} value={province.code}>
                              {province.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">City/Municipality *</Label>
                      <Select 
                        value={formData.selectedCityCode || ""} 
                        onValueChange={handleCityChange}
                        disabled={loadingAddressData || !formData.selectedProvinceCode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !formData.selectedProvinceCode 
                              ? "Select province first" 
                              : loadingAddressData 
                                ? "Loading cities..." 
                                : "Select city/municipality"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {cities.filter(city => city.code && city.code.trim() !== '').map((city) => (
                            <SelectItem key={city.code} value={city.code}>
                              {city.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="barangay">Barangay *</Label>
                      <Select 
                        value={formData.selectedBarangayCode || ""} 
                        onValueChange={handleBarangayChange}
                        disabled={loadingAddressData || !formData.selectedCityCode}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !formData.selectedCityCode 
                              ? "Select city first" 
                              : loadingAddressData 
                                ? "Loading barangays..." 
                                : "Select barangay"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {barangays.filter(barangay => barangay.code && barangay.code.trim() !== '').map((barangay) => (
                            <SelectItem key={barangay.code} value={barangay.code}>
                              {barangay.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="street">Street *</Label>
                      <Input 
                        id="street" 
                        placeholder="Enter street address"
                        value={formData.address.street}
                        onChange={(e) => handleInputChange("address.street", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="shiftType">Shift Type *</Label>
                    <Select value={formData.shift_type || ""} onValueChange={(value) => handleInputChange("shift_type", value as "Day" | "Night")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day">Day Shift (7AM - 7PM)</SelectItem>
                        <SelectItem value="Night">Night Shift (7PM - 7AM)</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.shift_type && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Patient capacity: {CAREGIVER_PATIENT_LIMITS[formData.shift_type as "Day" | "Night"]} patients max
                      </div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Input 
                      id="role" 
                      value="Eldercare"
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="shiftStartDate">Shift Start Date *</Label>
                    <Input 
                      id="shiftStartDate" 
                      type="date"
                      min={getTomorrowDate()}
                      value={formData.shift_start_date}
                      onChange={(e) => handleInputChange("shift_start_date", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="shiftEndDate">Shift End Date</Label>
                    <Input 
                      id="shiftEndDate" 
                      type="date"
                      value={formData.shift_end_date}
                      disabled
                      className="bg-muted"
                      placeholder="Auto-calculated (Start date + 3 days)"
                    />
                  </div>
                </div>

                {/* Add License Information Section - Updated */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium border-t pt-4">License Information</h3>
                  <div className="grid gap-2">
                    <Label htmlFor="licenseNumber">License Number</Label>
                    <Input 
                      id="licenseNumber" 
                      placeholder="Enter license number"
                      value={formData.license_number}
                      onChange={(e) => handleInputChange("license_number", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="licensePicture">License Picture</Label>
                    <FileUpload
                      onFilesSelected={(files: File[]) => {
                        setSelectedFiles(files)
                        if (files && files.length > 0) {
                          setLicenseFile(files[0])
                        } else {
                          setLicenseFile(null)
                        }
                      }}
                      onFileRemove={(index: number) => {
                        setSelectedFiles([])
                        setLicenseFile(null)
                      }}
                      selectedFiles={selectedFiles}
                      existingFiles={[]}
                      multiple={false}
                      accept="image/*,.pdf"
                      maxFiles={1}
                      disabled={addingCaregiver}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload an image (JPG, PNG, WebP) or PDF file of the eldercare's license. Max size: 10MB.
                    </p>
                    {licenseFile && (
                      <div className="text-sm text-green-600">
                        Selected: {licenseFile.name} ({(licenseFile.size / 1024 / 1024).toFixed(2)} MB)
                      </div>
                    )}
                  </div>
                </div>

                {/* Contract Information Section */}
                <div>
                  <h3 className="text-lg font-medium border-t pt-4">Contract Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="contractStartDate">Contract Start Date</Label>
                      <Input 
                        id="contractStartDate" 
                        type="date"
                        value={formData.contract_start_date}
                        onChange={(e) => handleInputChange("contract_start_date", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contractEndDate">Contract End Date</Label>
                      <Input 
                        id="contractEndDate" 
                        type="date"
                        value={formData.contract_end_date}
                        onChange={(e) => handleInputChange("contract_end_date", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCaregiver} disabled={addingCaregiver}>
                  {addingCaregiver ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Eldercare"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Edit Dialog */}
          <Dialog open={!!editingCaregiver} onOpenChange={(open) => !open && setEditingCaregiver(null)}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Eldercare</DialogTitle>
                <DialogDescription>
                  {isEditingNewlyRegistered
                    ? "For newly registered caregivers, only shift and contract dates can be edited."
                    : "Update the eldercare's information."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {!isEditingNewlyRegistered && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="editFirstName">First Name *</Label>
                        <Input
                          id="editFirstName"
                          placeholder="Enter first name"
                          value={formData.first_name}
                          onChange={(e) => handleInputChange("first_name", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="editLastName">Last Name *</Label>
                        <Input
                          id="editLastName"
                          placeholder="Enter last name"
                          value={formData.last_name}
                          onChange={(e) => handleInputChange("last_name", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="editMiddleName">Middle Name</Label>
                        <Input
                          id="editMiddleName"
                          placeholder="Enter middle name"
                          value={formData.middle_name}
                          onChange={(e) => handleInputChange("middle_name", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="editBirthday">Birthday *</Label>
                        <Input
                          id="editBirthday"
                          type="date"
                          value={formData.birthday}
                          onChange={(e) => handleInputChange("birthday", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="editEmail">Email *</Label>
                      <Input
                        id="editEmail"
                        type="email"
                        placeholder="Enter email address"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="editPhone">Contact Number *</Label>
                      <Input
                        id="editPhone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                        value={formData.contact_number}
                        onChange={(e) => handleInputChange("contact_number", e.target.value)}
                      />
                    </div>

                    <div className="space-y-4">
                      <Label className="text-sm font-medium">Address *</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="editProvince">Province *</Label>
                          <Select
                            value={formData.selectedProvinceCode || ""}
                            onValueChange={handleProvinceChange}
                            disabled={loadingAddressData}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={loadingAddressData ? "Loading provinces..." : "Select province"} />
                            </SelectTrigger>
                            <SelectContent>
                              {provinces.filter(province => province.code && province.code.trim() !== '').map((province) => (
                                <SelectItem key={province.code} value={province.code}>
                                  {province.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="editCity">City/Municipality *</Label>
                          <Select
                            value={formData.selectedCityCode}
                            onValueChange={handleCityChange}
                            disabled={loadingAddressData || !formData.selectedProvinceCode}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={
                                !formData.selectedProvinceCode
                                  ? "Select province first"
                                  : loadingAddressData
                                    ? "Loading cities..."
                                    : "Select city/municipality"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {cities.filter(city => city.code && city.code.trim() !== '').map((city) => (
                                <SelectItem key={city.code} value={city.code}>
                                  {city.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="editBarangay">Barangay *</Label>
                          <Select
                            value={formData.selectedBarangayCode}
                            onValueChange={handleBarangayChange}
                            disabled={loadingAddressData || !formData.selectedCityCode}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={
                                !formData.selectedCityCode
                                  ? "Select city first"
                                  : loadingAddressData
                                    ? "Loading barangays..."
                                    : "Select barangay"
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {barangays.filter(barangay => barangay.code && barangay.code.trim() !== '').map((barangay) => (
                                <SelectItem key={barangay.code} value={barangay.code}>
                                  {barangay.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="editStreet">Street *</Label>
                          <Input
                            id="editStreet"
                            placeholder="Enter street address"
                            value={formData.address.street}
                            onChange={(e) => handleInputChange("address.street", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className={`grid gap-4 ${isEditingNewlyRegistered ? "grid-cols-1" : "grid-cols-2"}`}>
                  <div className="grid gap-2">
                    <Label htmlFor="editShiftType">Shift Type *</Label>
                    <Select value={formData.shift_type || ""} onValueChange={(value) => handleInputChange("shift_type", value as "Day" | "Night")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day">Day Shift (7AM - 7PM)</SelectItem>
                        <SelectItem value="Night">Night Shift (7PM - 7AM)</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.shift_type && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Patient capacity: {CAREGIVER_PATIENT_LIMITS[formData.shift_type as "Day" | "Night"]} patients max
                      </div>
                    )}
                  </div>
                  {!isEditingNewlyRegistered && (
                    <div className="grid gap-2">
                      <Label htmlFor="editRole">Role</Label>
                      <Input
                        id="editRole"
                        value="Eldercare"
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editShiftStartDate">Shift Start Date *</Label>
                    <Input
                      id="editShiftStartDate"
                      type="date"
                      value={formData.shift_start_date}
                      onChange={(e) => handleInputChange("shift_start_date", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editShiftEndDate">Shift End Date</Label>
                    <Input
                      id="editShiftEndDate"
                      type="date"
                      value={formData.shift_end_date}
                      disabled
                      className="bg-muted"
                      placeholder="Auto-calculated (Start date + 3 days)"
                    />
                  </div>
                </div>

                {!isEditingNewlyRegistered && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium border-t pt-4">License Information</h3>
                    <div className="grid gap-2">
                      <Label htmlFor="editLicenseNumber">License Number</Label>
                      <Input
                        id="editLicenseNumber"
                        placeholder="Enter license number"
                        value={formData.license_number}
                        onChange={(e) => handleInputChange("license_number", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="editLicensePicture">License Picture</Label>
                      {formData.license_picture && (
                        <div className="mb-2">
                          <p className="text-sm text-muted-foreground mb-2">Current license:</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(formData.license_picture, '_blank')}
                            className="gap-2"
                          >
                            <FileText className="h-4 w-4" />
                            View Current License
                          </Button>
                        </div>
                      )}
                      <FileUpload
                        onFilesSelected={(files: File[]) => {
                          setSelectedFiles(files)
                          if (files && files.length > 0) {
                            setLicenseFile(files[0])
                          } else {
                            setLicenseFile(null)
                          }
                        }}
                        onFileRemove={() => {
                          setSelectedFiles([])
                          setLicenseFile(null)
                        }}
                        selectedFiles={selectedFiles}
                        existingFiles={[]}
                        multiple={false}
                        accept="image/*,.pdf"
                        maxFiles={1}
                        disabled={updatingCaregiver}
                      />
                      <p className="text-xs text-muted-foreground">
                        Upload a new license file to replace the current one. Leave empty to keep existing license.
                      </p>
                      {licenseFile && (
                        <div className="text-sm text-green-600">
                          New file selected: {licenseFile.name} ({(licenseFile.size / 1024 / 1024).toFixed(2)} MB)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-medium border-t pt-4">Contract Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="editContractStartDate">Contract Start Date</Label>
                      <Input
                        id="editContractStartDate"
                        type="date"
                        value={formData.contract_start_date}
                        onChange={(e) => handleInputChange("contract_start_date", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="editContractEndDate">Contract End Date</Label>
                      <Input
                        id="editContractEndDate"
                        type="date"
                        value={formData.contract_end_date}
                        onChange={(e) => handleInputChange("contract_end_date", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingCaregiver(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updatingCaregiver}>
                  {updatingCaregiver ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Eldercare"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* View Details Dialog */}
          <Dialog open={!!viewingCaregiver} onOpenChange={(open) => {
            if (!open) {
              setViewingCaregiver(null)
              setAssignedPatients([])
            }
          }}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Eldercare Details</DialogTitle>
                <DialogDescription>
                  View detailed information about the eldercare.
                </DialogDescription>
              </DialogHeader>
              {viewingCaregiver && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                      <p className="text-sm font-semibold">
                        {[viewingCaregiver.first_name, viewingCaregiver.middle_name, viewingCaregiver.last_name]
                          .filter(Boolean).join(' ') || "Name not provided"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Birthday</Label>
                      <p className="text-sm">
                        {(() => {
                          // Check multiple possible birthday field names
                          const birthday = viewingCaregiver.birthday || 
                                         viewingCaregiver.birthdate || 
                                         (viewingCaregiver as any).date_of_birth;
                          
                          if (!birthday) return "Not provided";
                          
                          try {
                            // Try to format the date if it's a valid date
                            const date = new Date(birthday);
                            if (!isNaN(date.getTime())) {
                              return date.toLocaleDateString();
                            }
                            // If it's not a valid date, return as is
                            return birthday;
                          } catch {
                            return birthday;
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                      <p className="text-sm">{viewingCaregiver.email || "Not provided"}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Contact Number</Label>
                      <p className="text-sm">
                        {viewingCaregiver.contact_number ? 
                          (typeof viewingCaregiver.contact_number === 'number' ? 
                            viewingCaregiver.contact_number.toString() : 
                            viewingCaregiver.contact_number) : 
                          "Not provided"
                        }
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                    <p className="text-sm">{formatAddress(viewingCaregiver)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Shift Type</Label>
                      <Badge className={getShiftColor(viewingCaregiver.shift_type)}>
                        {viewingCaregiver.shift_type || "Not specified"}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                      <p className="text-sm capitalize">{viewingCaregiver.role || "Not specified"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Patient Capacity</Label>
                      <p className="text-sm">
                        {viewingCaregiver.assigned_patients_count || 0} / {viewingCaregiver.max_patients || getMaxPatientsForShift(viewingCaregiver.shift_type)} patients
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Availability</Label>
                      {getAvailabilityBadge(viewingCaregiver)}
                      {hasCaregiverAvailabilityRequirements(viewingCaregiver) && canCaregiverTakeMorePatients(viewingCaregiver) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Available ({getAvailablePatientSlots(viewingCaregiver)} slots)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Shift Start Date</Label>
                      <p className="text-sm">
                        {viewingCaregiver.shift_start_date ? 
                          timestampToDate(viewingCaregiver.shift_start_date) ? 
                            new Date(timestampToDate(viewingCaregiver.shift_start_date)).toLocaleDateString() : 
                            "Not specified" : 
                          "Not specified"
                        }
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Shift End Date</Label>
                      <p className="text-sm">
                        {viewingCaregiver.shift_end_date ? 
                          timestampToDate(viewingCaregiver.shift_end_date) ? 
                            new Date(timestampToDate(viewingCaregiver.shift_end_date)).toLocaleDateString() : 
                            "Not specified" : 
                          "Not specified"
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* License Information Section */}
                  <div className="mt-6">
                    <div className="flex items-center gap-2 border-b pb-2 mb-4">
                      <FileText className="h-4 w-4 text-green-500" />
                      <Label className="text-sm font-medium">License Information</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">License Number</Label>
                        <p className="text-sm">
                          {viewingCaregiver.license_number || "Not provided"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">License Status</Label>
                        {isValidLicenseImage(viewingCaregiver.license_picture) ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <FileText className="h-3 w-3 mr-1" />
                            Licensed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            No License
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* License Image Display */}
                    {isValidLicenseImage(viewingCaregiver.license_picture) && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium text-muted-foreground">License Document</Label>
                        <div className="mt-2 p-4 border rounded-lg bg-muted/20">
                          {viewingCaregiver.license_picture!.startsWith('data:') ? (
                            // Base64 image
                            <div className="space-y-3">
                              <img 
                                src={viewingCaregiver.license_picture} 
                                alt="License Document"
                                className="max-w-full h-auto max-h-60 object-contain rounded border mx-auto block"
                                onError={(e) => {
                                  console.error('Error loading license image');
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = viewingCaregiver.license_picture!;
                                    link.download = `license_${viewingCaregiver.first_name}_${viewingCaregiver.last_name}.${getLicenseFileExtension(viewingCaregiver.license_picture!)}`;
                                    link.click();
                                  }}
                                  className="gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  Download
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(viewingCaregiver.license_picture!, '_blank')}
                                  className="gap-2"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View Full Size
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // URL from Firebase Storage
                            <div className="space-y-3">
                              <img 
                                src={viewingCaregiver.license_picture} 
                                alt="License Document"
                                className="max-w-full h-auto max-h-60 object-contain rounded border mx-auto block"
                                onError={(e) => {
                                  console.error('Error loading license image');
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(viewingCaregiver.license_picture!, '_blank')}
                                  className="gap-2"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View Full Size
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contract Information Section */}
                  <div className="mt-6">
                    <div className="flex items-center gap-2 border-b pb-2 mb-4">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <Label className="text-sm font-medium">Contract Information</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Contract Start Date</Label>
                        <p className="text-sm">
                          {viewingCaregiver.contract_start_date ? 
                            new Date(viewingCaregiver.contract_start_date).toLocaleDateString() : 
                            "Not specified"
                          }
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Contract End Date</Label>
                        <p className="text-sm">
                          {viewingCaregiver.contract_end_date ? 
                            new Date(viewingCaregiver.contract_end_date).toLocaleDateString() : 
                            "Not specified"
                          }
                        </p>
                      </div>
                    </div>
                    {viewingCaregiver.contract_start_date && viewingCaregiver.contract_end_date && (
                      <div className="mt-2">
                        <Label className="text-sm font-medium text-muted-foreground">Contract Status</Label>
                        <div className="mt-1">
                          {(() => {
                            const now = new Date();
                            const startDate = new Date(viewingCaregiver.contract_start_date);
                            const endDate = new Date(viewingCaregiver.contract_end_date);
                            const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            
                            if (now < startDate) {
                              return (
                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                  Upcoming
                                </Badge>
                              );
                            } else if (now > endDate) {
                              return (
                                <Badge variant="outline" className="text-red-600 border-red-600">
                                  Expired
                                </Badge>
                              );
                            } else if (daysUntilExpiry <= 30) {
                              return (
                                <Badge variant="outline" className="text-amber-600 border-amber-600">
                                  Expiring Soon ({daysUntilExpiry} days)
                                </Badge>
                              );
                            } else {
                              return (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Active
                                </Badge>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}
                    {!viewingCaregiver.contract_start_date && !viewingCaregiver.contract_end_date && (
                      <div className="mt-2">
                        <Label className="text-sm font-medium text-muted-foreground">Contract Status</Label>
                        <div className="mt-1">
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Pending
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Assigned Patients Section */}
                  <div className="mt-6">
                    <div className="flex items-center gap-2 border-b pb-2 mb-4">
                      <Users className="h-4 w-4 text-blue-500" />
                      <Label className="text-sm font-medium">Assigned Patients</Label>
                      {loadingPatients && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    
                    {loadingPatients ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading patients...</span>
                      </div>
                    ) : assignedPatients.length > 0 ? (
                      <div className="space-y-3">
                        {assignedPatients.map((patient) => (
                          <div key={patient.patient_id} className="p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            {/* Debug patient data */}
                            {console.log('Rendering patient in caregiver view:', {
                              patient_id: patient.patient_id,
                              first_name: patient.first_name,
                              last_name: patient.last_name,
                              full_patient_object: patient
                            })}
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-semibold text-sm">
                                    {patient.first_name && patient.last_name ? 
                                      `${patient.first_name} ${patient.last_name}` : 
                                      patient.first_name || patient.last_name || 
                                      patient.name || '[Name not available]'
                                    }
                                  </h4>
                                  <Badge variant="outline" className="text-xs">
                                    {patient.gender}
                                  </Badge>
                                  {patient.mobility_level && (
                                    <Badge variant="secondary" className="text-xs">
                                      {patient.mobility_level}
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Age: {(() => {
                                      // Debug the birthdate field
                                      console.log('Patient birthdate data:', {
                                        patient_id: patient.patient_id,
                                        birthdate: patient.birthdate,
                                        birthdate_type: typeof patient.birthdate,
                                        raw_patient_data: patient
                                      });
                                      
                                      if (!patient.birthdate) return 'N/A';
                                      
                                      try {
                                        let birthDate;
                                        
                                        // Handle different birthdate formats
                                        if (patient.birthdate.toDate && typeof patient.birthdate.toDate === 'function') {
                                          // Firebase Timestamp
                                          birthDate = patient.birthdate.toDate();
                                        } else if (typeof patient.birthdate === 'string') {
                                          // String date
                                          birthDate = new Date(patient.birthdate);
                                        } else if (patient.birthdate instanceof Date) {
                                          // Already a Date object
                                          birthDate = patient.birthdate;
                                        } else {
                                          console.warn('Unknown birthdate format:', patient.birthdate);
                                          return 'Invalid';
                                        }
                                        
                                        const today = new Date();
                                        const ageInMilliseconds = today.getTime() - birthDate.getTime();
                                        const ageInYears = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24 * 365.25));
                                        
                                        return ageInYears >= 0 ? ageInYears : 'Invalid';
                                      } catch (error) {
                                        console.error('Error calculating age:', error);
                                        return 'Error';
                                      }
                                    })()} years
                                  </div>
                                  {patient.contact_number && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {patient.contact_number}
                                    </div>
                                  )}
                                  {patient.emergency_contact_name && (
                                    <div className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      Emergency: {patient.emergency_contact_name}
                                    </div>
                                  )}
                                  {patient.emergency_contact_phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {patient.emergency_contact_phone}
                                    </div>
                                  )}
                                </div>

                                {patient.address && (
                                  <div className="flex items-start gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-1">{patient.address}</span>
                                  </div>
                                )}

                                {patient.medical_conditions && (
                                  <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                                    <span className="font-medium text-amber-700 dark:text-amber-400">Medical Conditions:</span> {patient.medical_conditions}
                                  </div>
                                )}

                                {patient.care_notes && (
                                  <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                                    <span className="font-medium text-blue-700 dark:text-blue-400">Care Notes:</span> {patient.care_notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="text-xs text-muted-foreground text-center pt-3 border-t">
                          <span className="bg-primary/10 px-2 py-1 rounded-full">
                            Total: {assignedPatients.length} patient{assignedPatients.length !== 1 ? 's' : ''} assigned
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">No Patients Assigned</p>
                        <p className="text-xs">This caregiver currently has no assigned patients.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => {
                  setViewingCaregiver(null)
                  setAssignedPatients([])
                }}>
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search eldercares by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Eldercares</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered eldercares
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Day Shift (7AM-7PM)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregiverStats.dayShiftCount}</div>
            <p className="text-xs text-muted-foreground">
              Day shift available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Night Shift (7PM-7AM)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregiverStats.nightShiftCount}</div>
            <p className="text-xs text-muted-foreground">
              Night shift on duty
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Patient Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {caregiverStats.totalAssignedPatients} / {caregiverStats.totalCapacity}
            </div>
            <p className="text-xs text-muted-foreground">
              Current / Maximum patients
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Caregiver List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Eldercare Records
          </CardTitle>
          <CardDescription>
            All registered eldercares in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCaregivers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {caregivers.length === 0 ? "No eldercares added yet" : "No eldercares match your search"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {caregivers.length === 0 
                  ? "Click 'Add Eldercare' to create your first eldercare record" 
                  : "Try adjusting your search terms"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Unique ID</TableHead>
                    <TableHead className="min-w-[200px]">Eldercare</TableHead>
                    <TableHead className="min-w-[150px]">Contact</TableHead>
                    <TableHead className="min-w-[120px]">Shift</TableHead>
                    <TableHead className="min-w-[120px]">Availability</TableHead>
                    <TableHead className="min-w-[100px]">Patients</TableHead>
                    <TableHead className="min-w-[120px]">Contract</TableHead>
                    <TableHead className="min-w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCaregivers.map((caregiver) => (
                    <TableRow key={caregiver.caregiver_id} className="hover:bg-muted/50">
                      <TableCell className="align-top">
                        <span className="font-mono text-xs text-muted-foreground break-all">
                          {caregiver.caregiver_id.slice(0, 10)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-sm">
                              {caregiver.first_name} {caregiver.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {caregiver.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Role: {caregiver.role || "Not specified"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{caregiver.contact_number || "No phone"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getShiftColor(caregiver.shift_type)}>
                          {caregiver.shift_type}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {caregiver.shift_type === 'Day' ? '7AM - 7PM' : '7PM - 7AM'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {getAvailabilityBadge(caregiver)}
                          {hasCaregiverAvailabilityRequirements(caregiver) && canCaregiverTakeMorePatients(caregiver) ? (
                            <div className="text-xs text-green-600">
                              Available ({getAvailablePatientSlots(caregiver)} slots)
                            </div>
                          ) : (
                            <div className="text-xs text-red-600">
                              Full Capacity
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {caregiver.assigned_patients_count || 0} / {caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          patients assigned
                        </div>
                      </TableCell>
                      <TableCell>
                        {caregiver.contract_start_date && caregiver.contract_end_date ? (
                          <div className="text-xs space-y-1">
                            <div>
                              <span className="font-medium">Start:</span> {new Date(caregiver.contract_start_date).toLocaleDateString()}
                            </div>
                            <div>
                              <span className="font-medium">End:</span> {new Date(caregiver.contract_end_date).toLocaleDateString()}
                            </div>
                            {(() => {
                              const now = new Date()
                              const startDate = new Date(caregiver.contract_start_date)
                              const endDate = new Date(caregiver.contract_end_date)

                              if (now < startDate) {
                                return (
                                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                                    Upcoming
                                  </Badge>
                                )
                              }

                              if (now > endDate) {
                                return (
                                  <Badge variant="outline" className="text-red-600 border-red-600">
                                    Expired
                                  </Badge>
                                )
                              }

                              return (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Active
                                </Badge>
                              )
                            })()}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-gray-600 border-gray-600">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleViewCaregiver(caregiver)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEdit(caregiver)}
                            title="Edit Eldercare"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Delete Eldercare"
                                disabled={deletingCaregiver === caregiver.caregiver_id}
                              >
                                {deletingCaregiver === caregiver.caregiver_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Eldercare</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {caregiver.first_name} {caregiver.last_name}? 
                                  This action cannot be undone and will permanently remove their record from the system.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDelete(caregiver.caregiver_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Caregivers
