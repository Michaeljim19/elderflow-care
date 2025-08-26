import { useState, useEffect } from "react"
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
  Heart,
  Shield,
  Activity,
  FileText,
  ArrowLeft,
  Calendar,
  Pill
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Patient, Caregiver } from "@/types"
import { getPatients, addPatient, updatePatient, deletePatient } from "@/services/firebase/patients"
import { getCaregivers } from "@/services/firebase/caregivers"
import { addMedicalHistory, getMedicalHistoryByPatient, updateMedicalHistory, getMedicalHistories } from "@/services/firebase/medicalHistory"
import { Timestamp } from "firebase/firestore"
import MedicalHistoryDialog from "@/components/MedicalHistoryDialog"
import { addressService, Province, CityMunicipality, Barangay } from "@/services/address"

const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [totalMedicalHistoryCount, setTotalMedicalHistoryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [addingPatient, setAddingPatient] = useState(false)
  const [formStep, setFormStep] = useState<1 | 2>(1) // Step 1: Basic Info, Step 2: Medical History
  
  // View, Edit, and Delete state management
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [updatingPatient, setUpdatingPatient] = useState(false)
  const [deletingPatient, setDeletingPatient] = useState<string | null>(null)
  const [showEmergencyContact, setShowEmergencyContact] = useState<Patient | null>(null)
  
  // Medical History Management state
  const [selectedPatientForMedicalHistory, setSelectedPatientForMedicalHistory] = useState<string | null>(null)
  const [currentPatientMedicalHistory, setCurrentPatientMedicalHistory] = useState<any[]>([])
  const [loadingMedicalHistory, setLoadingMedicalHistory] = useState(false)
  
  // PSGC API states for address dropdowns
  const [provinces, setProvinces] = useState<Province[]>([])
  const [cities, setCities] = useState<CityMunicipality[]>([])
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [loadingAddressData, setLoadingAddressData] = useState(false)
  
  const { toast } = useToast()

  // Helper function to refresh medical history count
  const refreshMedicalHistoryCount = async () => {
    try {
      const medicalHistoriesData = await getMedicalHistories()
      setTotalMedicalHistoryCount(medicalHistoriesData.length)
    } catch (error) {
      console.error("Error refreshing medical history count:", error)
    }
  }

  // Form state for adding new patient
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    birthdate: "",
    gender: undefined as "Male" | "Female" | "Other" | undefined,
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
    assigned_day_caregiver_id: "",
    assigned_night_caregiver_id: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relationship: "",
    guardian_email: "",
    contract_start_date: "",
    contract_end_date: "",
    medical_history: {
      currentMedicalConditions: {
        diabetes: false,
        hypertension: false,
        heartDisease: false,
        arthritis: false,
        dementia: false,
        other: false,
        otherText: ""
      },
      pastMedicalHistory: {
        cancer: false,
        stroke: false,
        heartAttack: false,
        fractures: false,
        other: false,
        otherText: ""
      },
      currentMedications: {
        bloodPressure: false,
        diabetes: false,
        painRelief: false,
        antidepressants: false,
        other: false,
        otherText: ""
      },
      knownAllergies: {
        foodAllergies: false,
        medicationAllergies: false,
        environmentalAllergies: false,
        other: false,
        otherText: ""
      }
    }
  })

  // Load patients and caregivers on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        console.log("DEBUG: Starting to load patients and caregivers...")
        
        const [patientsData, caregiversData, medicalHistoriesData] = await Promise.all([
          getPatients(),
          getCaregivers(),
          getMedicalHistories()
        ])
        
        console.log("DEBUG: Loaded patients:", patientsData.length, patientsData)
        console.log("DEBUG: Loaded caregivers:", caregiversData.length, caregiversData)
        console.log("DEBUG: Loaded medical histories:", medicalHistoriesData.length, medicalHistoriesData)
        console.log("DEBUG: Day caregivers:", caregiversData.filter(c => c.shift_type === 'Day'))
        console.log("DEBUG: Night caregivers:", caregiversData.filter(c => c.shift_type === 'Night'))
        
        setPatients(patientsData)
        setCaregivers(caregiversData)
        setTotalMedicalHistoryCount(medicalHistoriesData.length)

      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "Failed to load patients data. Please try again.",
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

  // Debug caregivers data when it changes
  useEffect(() => {
    if (caregivers.length > 0) {
      console.log("DEBUG: Caregivers loaded:", caregivers);
      console.log("DEBUG: Day shift caregivers:", caregivers.filter(c => c.shift_type === 'Day'));
      console.log("DEBUG: Night shift caregivers:", caregivers.filter(c => c.shift_type === 'Night'));
    }
  }, [caregivers])

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
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  // Medical history checkbox handlers
  const handleMedicalHistoryCheckbox = (category: string, field: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      medical_history: {
        ...prev.medical_history,
        [category]: {
          ...prev.medical_history[category as keyof typeof prev.medical_history],
          [field]: checked
        }
      }
    }))
  }

  const handleMedicalHistoryOtherText = (category: string, text: string) => {
    setFormData(prev => ({
      ...prev,
      medical_history: {
        ...prev.medical_history,
        [category]: {
          ...prev.medical_history[category as keyof typeof prev.medical_history],
          otherText: text
        }
      }
    }))
  }

  // Helper function to serialize medical history for storage
  const serializeMedicalHistory = (medicalHistory: any) => {
    const sections = []
    
    // Current Medical Conditions
    const currentConditions = []
    if (medicalHistory.currentMedicalConditions.diabetes) currentConditions.push("Diabetes")
    if (medicalHistory.currentMedicalConditions.hypertension) currentConditions.push("Hypertension")
    if (medicalHistory.currentMedicalConditions.heartDisease) currentConditions.push("Heart Disease")
    if (medicalHistory.currentMedicalConditions.arthritis) currentConditions.push("Arthritis")
    if (medicalHistory.currentMedicalConditions.dementia) currentConditions.push("Dementia")
    if (medicalHistory.currentMedicalConditions.other && medicalHistory.currentMedicalConditions.otherText) {
      currentConditions.push(medicalHistory.currentMedicalConditions.otherText)
    }
    if (currentConditions.length > 0) {
      sections.push("Current Medical Conditions: " + currentConditions.join(", "))
    }

    // Past Medical History
    const pastHistory = []
    if (medicalHistory.pastMedicalHistory.cancer) pastHistory.push("Cancer")
    if (medicalHistory.pastMedicalHistory.stroke) pastHistory.push("Stroke")
    if (medicalHistory.pastMedicalHistory.heartAttack) pastHistory.push("Heart Attack")
    if (medicalHistory.pastMedicalHistory.fractures) pastHistory.push("Fractures")
    if (medicalHistory.pastMedicalHistory.other && medicalHistory.pastMedicalHistory.otherText) {
      pastHistory.push(medicalHistory.pastMedicalHistory.otherText)
    }
    if (pastHistory.length > 0) {
      sections.push("Past Medical History: " + pastHistory.join(", "))
    }

    // Current Medications
    const currentMeds = []
    if (medicalHistory.currentMedications.bloodPressure) currentMeds.push("Blood Pressure Medication")
    if (medicalHistory.currentMedications.diabetes) currentMeds.push("Diabetes Medication")
    if (medicalHistory.currentMedications.painRelief) currentMeds.push("Pain Relief Medication")
    if (medicalHistory.currentMedications.antidepressants) currentMeds.push("Antidepressants")
    if (medicalHistory.currentMedications.other && medicalHistory.currentMedications.otherText) {
      currentMeds.push(medicalHistory.currentMedications.otherText)
    }
    if (currentMeds.length > 0) {
      sections.push("Current Medications: " + currentMeds.join(", "))
    }

    // Known Allergies
    const allergies = []
    if (medicalHistory.knownAllergies.foodAllergies) allergies.push("Food Allergies")
    if (medicalHistory.knownAllergies.medicationAllergies) allergies.push("Medication Allergies")
    if (medicalHistory.knownAllergies.environmentalAllergies) allergies.push("Environmental Allergies")
    if (medicalHistory.knownAllergies.other && medicalHistory.knownAllergies.otherText) {
      allergies.push(medicalHistory.knownAllergies.otherText)
    }
    if (allergies.length > 0) {
      sections.push("Known Allergies: " + allergies.join(", "))
    }

    return sections.join("; ")
  }

  // Reset form to initial state
  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      birthdate: "",
      gender: undefined as "Male" | "Female" | "Other" | undefined,
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
      assigned_day_caregiver_id: "",
      assigned_night_caregiver_id: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      emergency_contact_relationship: "",
      guardian_email: "",
      contract_start_date: "",
      contract_end_date: "",
      medical_history: {
        currentMedicalConditions: {
          diabetes: false,
          hypertension: false,
          heartDisease: false,
          arthritis: false,
          dementia: false,
          other: false,
          otherText: ""
        },
        pastMedicalHistory: {
          cancer: false,
          stroke: false,
          heartAttack: false,
          fractures: false,
          other: false,
          otherText: ""
        },
        currentMedications: {
          bloodPressure: false,
          diabetes: false,
          painRelief: false,
          antidepressants: false,
          other: false,
          otherText: ""
        },
        knownAllergies: {
          foodAllergies: false,
          medicationAllergies: false,
          environmentalAllergies: false,
          other: false,
          otherText: ""
        }
      }
    })
  }

  const handleCloseDialog = (open: boolean) => {
    setIsAddDialogOpen(open)
    if (!open) {
      resetForm()
      setFormStep(1) // Reset to first step when closing dialog
    }
  }

  // Step navigation handlers
  const handleNextStep = () => {
    setFormStep(2)
  }

  const handleBackStep = () => {
    setFormStep(1)
  }

  // Caregiver validation functions - simplified and more reliable
  const calculateCaregiverPatientCount = (caregiverId: string, shiftType: 'Day' | 'Night', excludePatientId?: string) => {
    if (!patients || patients.length === 0) {
      return 0
    }
    
    const assignmentField = shiftType === 'Day' ? 'assigned_day_caregiver_id' : 'assigned_night_caregiver_id'
    
    return patients.filter(patient => {
      // Skip the patient being excluded (for edit scenarios)
      if (excludePatientId && patient.patient_id === excludePatientId) {
        return false
      }
      
      return patient[assignmentField] === caregiverId || 
             (patient.assigned_caregiver_id === caregiverId) // Backward compatibility
    }).length
  }



  // Helper function to check if caregiver is at full capacity
  const isCaregiverAtFullCapacity = (caregiverId: string, shiftType: 'Day' | 'Night', excludePatientId?: string) => {
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId)
    if (!caregiver) return false
    
    const currentCount = calculateCaregiverPatientCount(caregiverId, shiftType, excludePatientId)
    const maxPatients = caregiver.max_patients || (shiftType === 'Day' ? 2 : 4)
    
    return currentCount >= maxPatients
  }

  // Enhanced functions that include capacity information
  const getAvailableDayCaregiversWithCapacity = (excludePatientId?: string) => {
    if (!caregivers || caregivers.length === 0) {
      return []
    }
    
    const filtered = caregivers.filter(caregiver => {
      const isDay = caregiver?.shift_type === 'Day'
      return isDay
    })
    
    return filtered
      .map(caregiver => {
        if (!caregiver?.caregiver_id) return null
        
        const currentCount = calculateCaregiverPatientCount(caregiver.caregiver_id, 'Day', excludePatientId)
        const maxPatients = caregiver.max_patients || 2
        const isAtCapacity = currentCount >= maxPatients
        
        return {
          ...caregiver,
          currentCount,
          maxPatients,
          isAtCapacity
        }
      })
      .filter(Boolean) // Remove null entries
  }

  const getAvailableNightCaregiversWithCapacity = (excludePatientId?: string) => {
    if (!caregivers || caregivers.length === 0) {
      return []
    }
    
    const filtered = caregivers.filter(caregiver => {
      const isNight = caregiver?.shift_type === 'Night'
      return isNight
    })
    
    return filtered
      .map(caregiver => {
        if (!caregiver?.caregiver_id) return null
        
        const currentCount = calculateCaregiverPatientCount(caregiver.caregiver_id, 'Night', excludePatientId)
        const maxPatients = caregiver.max_patients || 4
        const isAtCapacity = currentCount >= maxPatients
        
        return {
          ...caregiver,
          currentCount,
          maxPatients,
          isAtCapacity
        }
      })
      .filter(Boolean) // Remove null entries
  }

  // Simplified caregiver functions
  const getAvailableDayCaregivers = (excludePatientId?: string) => {
    if (!caregivers || caregivers.length === 0) {
      return []
    }
    
    const result = caregivers.filter(caregiver => 
      caregiver?.shift_type === 'Day'
    )
    return result
  }

  const getAvailableNightCaregivers = (excludePatientId?: string) => {
    if (!caregivers || caregivers.length === 0) {
      return []
    }
    
    return caregivers.filter(caregiver => 
      caregiver?.shift_type === 'Night'
    )
  }

  const getAllDayCaregivers = () => {
    if (!caregivers || caregivers.length === 0) {
      return []
    }
    return caregivers.filter(caregiver => caregiver?.shift_type === 'Day')
  }

  const getAllNightCaregivers = () => {
    if (!caregivers || caregivers.length === 0) {
      return []
    }
    return caregivers.filter(caregiver => caregiver?.shift_type === 'Night')
  }

  // Validation functions for caregiver selection
  const validateCaregiverSelection = (caregiverId: string, requiredShift: 'Day' | 'Night') => {
    if (!caregiverId || caregiverId === "unassigned") {
      return { isValid: true, message: "" }
    }

    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId)
    
    if (!caregiver) {
      return { 
        isValid: false, 
        message: "Selected caregiver not found. Please refresh and try again." 
      }
    }

    // Check if shift matches
    if (caregiver.shift_type !== requiredShift) {
      return { 
        isValid: false, 
        message: `${caregiver.first_name} ${caregiver.last_name} works ${caregiver.shift_type} shift, but you're trying to assign them to ${requiredShift} shift.` 
      }
    }

    // Check if caregiver is at capacity
    const currentCount = calculateCaregiverPatientCount(caregiverId, requiredShift)
    const maxPatients = caregiver.max_patients || (requiredShift === 'Day' ? 2 : 4)
    
    if (currentCount >= maxPatients) {
      return { 
        isValid: false, 
        message: `${caregiver.first_name} ${caregiver.last_name} is at full capacity (${currentCount}/${maxPatients} patients).` 
      }
    }

    return { isValid: true, message: "" }
  }

  // Enhanced input change handler with validation
  const handleCaregiverChange = (field: string, caregiverId: string) => {
    const requiredShift = field === "assigned_day_caregiver_id" ? 'Day' : 'Night'
    const validation = validateCaregiverSelection(caregiverId, requiredShift)
    
    if (!validation.isValid) {
      toast({
        title: "Invalid Caregiver Selection",
        description: validation.message,
        variant: "destructive"
      })
      return
    }
    
    handleInputChange(field, caregiverId)
    
    if (caregiverId && caregiverId !== "unassigned") {
      const caregiver = caregivers.find(c => c.caregiver_id === caregiverId)
      if (caregiver) {
        toast({
          title: "Caregiver Assigned",
          description: `${caregiver.first_name} ${caregiver.last_name} has been assigned to ${requiredShift.toLowerCase()} shift.`,
        })
      }
    }
  }

  // Simplified validation - just check if caregiver exists and has correct shift
  const isCaregiverAvailable = (caregiverId: string, shiftType: 'Day' | 'Night', excludePatientId?: string) => {
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId)
    if (!caregiver) {
      return false
    }
    
    const isCorrectShift = caregiver.shift_type === shiftType
    
    return isCorrectShift
  }

  const getCaregiverAvailabilityInfo = (caregiverId: string, excludePatientId?: string) => {
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId)
    if (!caregiver) return null
    
    const currentCount = calculateCaregiverPatientCount(caregiverId, caregiver.shift_type, excludePatientId)
    const maxPatients = caregiver.max_patients || (caregiver.shift_type === 'Day' ? 2 : 4)
    
    return { 
      available: true, // Always show as available for now
      shift: caregiver.shift_type, 
      count: currentCount, 
      max: maxPatients, 
      caregiver 
    }
  }

  // Handler to open view dialog for a specific patient
  const openViewDialog = (patient: Patient) => {
    setViewingPatient(patient)
  }

  // Handler to view medical history for a specific patient
  const openMedicalHistoryView = async (patientId: string) => {
    setSelectedPatientForMedicalHistory(patientId)
    setLoadingMedicalHistory(true)
    try {
      const medicalHistory = await getMedicalHistoryByPatient(patientId)
      setCurrentPatientMedicalHistory(medicalHistory)
    } catch (error) {
      console.error("Error loading medical history:", error)
      toast({
        title: "Error",
        description: "Failed to load medical history",
        variant: "destructive"
      })
    } finally {
      setLoadingMedicalHistory(false)
    }
  }

  // Handler to close medical history view
  const closeMedicalHistoryView = () => {
    setSelectedPatientForMedicalHistory(null)
    setCurrentPatientMedicalHistory([])
  }

  // Handler to open edit dialog for a specific patient
  const openEditDialog = (patient: Patient) => {
    setEditingPatient(patient)
    // Pre-populate form with patient data
    setFormData({
      first_name: patient.first_name || "",
      last_name: patient.last_name || "",
      birthdate: patient.birthdate || "",
      gender: patient.gender || undefined,
      contact_number: patient.contact_number ? String(patient.contact_number) : "",
      address: typeof patient.address === 'string' ? 
        { province: "", city_municipality: "", barangay: "", street: patient.address } :
        patient.address || { province: "", city_municipality: "", barangay: "", street: "" },
      selectedProvinceCode: "",
      selectedCityCode: "",
      selectedBarangayCode: "",
      assigned_day_caregiver_id: patient.assigned_day_caregiver_id || "",
      assigned_night_caregiver_id: patient.assigned_night_caregiver_id || "",
      emergency_contact_name: patient.emergency_contact_name || "",
      emergency_contact_phone: patient.emergency_contact_phone ? String(patient.emergency_contact_phone) : "",
      emergency_contact_relationship: patient.emergency_contact_relationship || "",
      guardian_email: patient.guardian_email || "",
      contract_start_date: patient.contract_start_date || "",
      contract_end_date: patient.contract_end_date || "",
      medical_history: {
        currentMedicalConditions: {
          diabetes: false,
          hypertension: false,
          heartDisease: false,
          arthritis: false,
          dementia: false,
          other: false,
          otherText: ""
        },
        pastMedicalHistory: {
          cancer: false,
          stroke: false,
          heartAttack: false,
          fractures: false,
          other: false,
          otherText: ""
        },
        currentMedications: {
          bloodPressure: false,
          diabetes: false,
          painRelief: false,
          antidepressants: false,
          other: false,
          otherText: ""
        },
        knownAllergies: {
          foodAllergies: false,
          medicationAllergies: false,
          environmentalAllergies: false,
          other: false,
          otherText: ""
        }
      }
    })
  }

  // Handler to delete a patient
  const handleDeletePatient = async (patientId: string) => {
    try {
      await deletePatient(patientId)
      
      // Refresh patients list
      const updatedPatients = await getPatients()
      setPatients(updatedPatients)
      
      setDeletingPatient(null)
      
      toast({
        title: "Success",
        description: "Patient deleted successfully"
      })
      
    } catch (error) {
      console.error("Error deleting patient:", error)
      toast({
        title: "Error",
        description: "Failed to delete patient",
        variant: "destructive"
      })
    }
  }

  // Handler to update existing patient
  const handleUpdatePatient = async () => {
    if (!editingPatient || !formData.first_name || !formData.last_name || !formData.birthdate || !formData.gender) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setUpdatingPatient(true)
      
      const updatedPatientData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        contact_number: Number(formData.contact_number),
        address: `${formData.address.street}, ${formData.address.barangay}, ${formData.address.city_municipality}, ${formData.address.province}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, ''),
        guardian_email: formData.guardian_email,
        assigned_day_caregiver_id: formData.assigned_day_caregiver_id,
        assigned_night_caregiver_id: formData.assigned_night_caregiver_id,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: Number(formData.emergency_contact_phone),
        emergency_contact_relationship: formData.emergency_contact_relationship,
        contract_start_date: formData.contract_start_date,
        contract_end_date: formData.contract_end_date,
        medical_conditions: serializeMedicalHistory(formData.medical_history),
        updated_at: Timestamp.now()
      }

      await updatePatient(editingPatient.patient_id, updatedPatientData)
      
      // Update medical history records
      if (formData.medical_history) {
        try {
          // For updates, we'll add new records rather than updating existing ones
          // This preserves the historical timeline of medical information
          const recordDate = new Date().toISOString()
          const recordedBy = 'system' // You can update this to current user ID when auth is implemented
          
          // Current Medical Conditions
          const conditions = formData.medical_history.currentMedicalConditions;
          const patientName = `${formData.first_name} ${formData.last_name}`;
          if (conditions.diabetes) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Diabetes',
              description: `Current medical condition - Updated for ${patientName}`,
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Active',
              notes: `Updated during patient record modification for ${patientName}`
            })
          }
          if (conditions.hypertension) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Hypertension',
              description: 'Current medical condition - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Active',
              notes: 'Updated during patient record modification'
            })
          }
          if (conditions.heartDisease) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Heart Disease',
              description: 'Current medical condition - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Active',
              notes: 'Updated during patient record modification'
            })
          }
          if (conditions.arthritis) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Arthritis',
              description: 'Current medical condition - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Active',
              notes: 'Updated during patient record modification'
            })
          }
          if (conditions.dementia) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Dementia',
              description: 'Current medical condition - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Active',
              notes: 'Updated during patient record modification'
            })
          }
          if (conditions.other && conditions.otherText) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Other Medical Condition',
              description: conditions.otherText + ' - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Active',
              notes: 'Updated during patient record modification'
            })
          }
          
          // Past Medical History
          const pastHistory = formData.medical_history.pastMedicalHistory;
          if (pastHistory.cancer) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Cancer',
              description: 'Past medical history - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Resolved',
              notes: 'Updated during patient record modification'
            })
          }
          if (pastHistory.stroke) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Stroke',
              description: 'Past medical history - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Resolved',
              notes: 'Updated during patient record modification'
            })
          }
          if (pastHistory.heartAttack) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Heart Attack',
              description: 'Past medical history - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Resolved',
              notes: 'Updated during patient record modification'
            })
          }
          if (pastHistory.fractures) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Fractures',
              description: 'Past medical history - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Resolved',
              notes: 'Updated during patient record modification'
            })
          }
          if (pastHistory.other && pastHistory.otherText) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Other Past Medical History',
              description: pastHistory.otherText + ' - Updated',
              date_diagnosed: recordDate,
              treatment: '',
              severity: 'Moderate',
              status: 'Resolved',
              notes: 'Updated during patient record modification'
            })
          }
          
          // Current Medications
          const medications = formData.medical_history.currentMedications;
          if (medications.bloodPressure) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Current Medication - Updated',
              description: 'Blood Pressure Medication',
              date_diagnosed: recordDate,
              treatment: 'Blood Pressure Medication',
              severity: 'Mild',
              status: 'Active',
              medications: 'Blood Pressure Medication',
              notes: 'Current medication updated during patient record modification'
            })
          }
          if (medications.diabetes) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Current Medication - Updated',
              description: 'Diabetes Medication',
              date_diagnosed: recordDate,
              treatment: 'Diabetes Medication',
              severity: 'Mild',
              status: 'Active',
              medications: 'Diabetes Medication',
              notes: 'Current medication updated during patient record modification'
            })
          }
          if (medications.painRelief) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Current Medication - Updated',
              description: 'Pain Relief Medication',
              date_diagnosed: recordDate,
              treatment: 'Pain Relief Medication',
              severity: 'Mild',
              status: 'Active',
              medications: 'Pain Relief Medication',
              notes: 'Current medication updated during patient record modification'
            })
          }
          if (medications.antidepressants) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Current Medication - Updated',
              description: 'Antidepressant Medication',
              date_diagnosed: recordDate,
              treatment: 'Antidepressant Medication',
              severity: 'Mild',
              status: 'Active',
              medications: 'Antidepressant Medication',
              notes: 'Current medication updated during patient record modification'
            })
          }
          if (medications.other && medications.otherText) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Current Medication - Updated',
              description: medications.otherText,
              date_diagnosed: recordDate,
              treatment: medications.otherText,
              severity: 'Mild',
              status: 'Active',
              medications: medications.otherText,
              notes: 'Current medication updated during patient record modification'
            })
          }
          
          // Known Allergies
          const allergies = formData.medical_history.knownAllergies;
          if (allergies.foodAllergies) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Allergy - Updated',
              description: 'Food Allergies',
              date_diagnosed: recordDate,
              treatment: 'Avoidance',
              severity: 'Moderate',
              status: 'Active',
              allergies: 'Food Allergies',
              notes: 'Allergy information updated during patient record modification'
            })
          }
          if (allergies.medicationAllergies) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Allergy - Updated',
              description: 'Medication Allergies',
              date_diagnosed: recordDate,
              treatment: 'Avoidance',
              severity: 'Moderate',
              status: 'Active',
              allergies: 'Medication Allergies',
              notes: 'Allergy information updated during patient record modification'
            })
          }
          if (allergies.environmentalAllergies) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Allergy - Updated',
              description: 'Environmental Allergies',
              date_diagnosed: recordDate,
              treatment: 'Avoidance',
              severity: 'Moderate',
              status: 'Active',
              allergies: 'Environmental Allergies',
              notes: 'Allergy information updated during patient record modification'
            })
          }
          if (allergies.other && allergies.otherText) {
            await addMedicalHistory({
              patient_id: editingPatient.patient_id,
              condition: 'Allergy - Updated',
              description: allergies.otherText,
              date_diagnosed: recordDate,
              treatment: 'Avoidance',
              severity: 'Moderate',
              status: 'Active',
              allergies: allergies.otherText,
              notes: 'Allergy information updated during patient record modification'
            })
          }
        } catch (medicalHistoryError) {
          console.error("Error handling medical history:", medicalHistoryError)
          // Don't fail the entire update if medical history update fails
        }
      }
      
      // Refresh medical history count after updating records
      await refreshMedicalHistoryCount()
      
      // Refresh patients list
      const updatedPatients = await getPatients()
      setPatients(updatedPatients)
      
      // Reset form and close dialog
      setEditingPatient(null)
      resetForm()
      
      toast({
        title: "Success",
        description: "Patient updated successfully"
      })
      
    } catch (error) {
      console.error("Error updating patient:", error)
      toast({
        title: "Error",
        description: "Failed to update patient",
        variant: "destructive"
      })
    } finally {
      setUpdatingPatient(false)
    }
  }

  const handleAddPatient = async () => {
    if (!formData.first_name || !formData.last_name || !formData.birthdate || !formData.gender) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setAddingPatient(true)
      
      const newPatientData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthdate: formData.birthdate,
        gender: formData.gender,
        contact_number: Number(formData.contact_number),
        address: `${formData.address.street}, ${formData.address.barangay}, ${formData.address.city_municipality}, ${formData.address.province}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, ''),
        guardian_email: formData.guardian_email,
        assigned_day_caregiver_id: formData.assigned_day_caregiver_id,
        assigned_night_caregiver_id: formData.assigned_night_caregiver_id,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: Number(formData.emergency_contact_phone),
        emergency_contact_relationship: formData.emergency_contact_relationship,
        contract_start_date: formData.contract_start_date,
        contract_end_date: formData.contract_end_date,
        medical_conditions: serializeMedicalHistory(formData.medical_history),
        is_active: true,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      }

      const patientDoc = await addPatient(newPatientData)
      
      // Medical history records will be created for each selected condition/medication/allergy
      const recordDate = new Date().toISOString()
      const patientName = `${formData.first_name} ${formData.last_name}`;
      
      console.log('Patient created, processing medical history records for:', patientName)
      
      // Create medical history records for each category
      if (formData.medical_history && patientDoc) {
        const recordDate = new Date().toISOString()
        const patientName = `${formData.first_name} ${formData.last_name}`;
        
        // Current Medical Conditions
        const conditions = formData.medical_history.currentMedicalConditions;
        if (conditions.diabetes) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Diabetes',
            description: `Current medical condition for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Active',
            notes: `Medical condition recorded during patient registration for ${patientName}`
          })
        }
        if (conditions.hypertension) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Hypertension',
            description: `Current medical condition for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Active',
            notes: `Medical condition recorded during patient registration for ${patientName}`
          })
        }
        if (conditions.heartDisease) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Heart Disease',
            description: `Current medical condition for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Active',
            notes: `Medical condition recorded during patient registration for ${patientName}`
          })
        }
        if (conditions.arthritis) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Arthritis',
            description: `Current medical condition for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Active',
            notes: `Medical condition recorded during patient registration for ${patientName}`
          })
        }
        if (conditions.dementia) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Dementia',
            description: `Current medical condition for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Active',
            notes: `Medical condition recorded during patient registration for ${patientName}`
          })
        }
        if (conditions.other && conditions.otherText) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Other Medical Condition',
            description: `${conditions.otherText} - Patient: ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Active',
            notes: `Medical condition recorded during patient registration for ${patientName}`
          })
        }
        
        // Past Medical History
        const pastHistory = formData.medical_history.pastMedicalHistory;
        if (pastHistory.cancer) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Cancer (Past)',
            description: `Past medical history for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Resolved',
            notes: `Past medical history recorded during patient registration for ${patientName}`
          })
        }
        if (pastHistory.stroke) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Stroke (Past)',
            description: `Past medical history for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Resolved',
            notes: `Past medical history recorded during patient registration for ${patientName}`
          })
        }
        if (pastHistory.heartAttack) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Heart Attack (Past)',
            description: `Past medical history for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Resolved',
            notes: `Past medical history recorded during patient registration for ${patientName}`
          })
        }
        if (pastHistory.fractures) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Fractures (Past)',
            description: `Past medical history for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Resolved',
            notes: `Past medical history recorded during patient registration for ${patientName}`
          })
        }
        if (pastHistory.other && pastHistory.otherText) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Other Past Medical History',
            description: `${pastHistory.otherText} - Patient: ${patientName}`,
            date_diagnosed: recordDate,
            treatment: '',
            severity: 'Moderate',
            status: 'Resolved',
            notes: `Past medical history recorded during patient registration for ${patientName}`
          })
        }
        
        // Current Medications
        const medications = formData.medical_history.currentMedications;
        if (medications.bloodPressure) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Current Medication',
            description: `Blood Pressure Medication for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Blood Pressure Medication',
            severity: 'Mild',
            status: 'Active',
            medications: 'Blood Pressure Medication',
            notes: `Current medication recorded during patient registration for ${patientName}`
          })
        }
        if (medications.diabetes) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Current Medication',
            description: `Diabetes Medication for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Diabetes Medication',
            severity: 'Mild',
            status: 'Active',
            medications: 'Diabetes Medication',
            notes: `Current medication recorded during patient registration for ${patientName}`
          })
        }
        if (medications.painRelief) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Current Medication',
            description: `Pain Relief Medication for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Pain Relief Medication',
            severity: 'Mild',
            status: 'Active',
            medications: 'Pain Relief Medication',
            notes: `Current medication recorded during patient registration for ${patientName}`
          })
        }
        if (medications.antidepressants) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Current Medication',
            description: `Antidepressant Medication for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Antidepressant Medication',
            severity: 'Mild',
            status: 'Active',
            medications: 'Antidepressant Medication',
            notes: `Current medication recorded during patient registration for ${patientName}`
          })
        }
        if (medications.other && medications.otherText) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Current Medication',
            description: `${medications.otherText} for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: medications.otherText,
            severity: 'Mild',
            status: 'Active',
            medications: medications.otherText,
            notes: `Current medication recorded during patient registration for ${patientName}`
          })
        }
        
        // Known Allergies
        const allergies = formData.medical_history.knownAllergies;
        if (allergies.foodAllergies) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Allergy',
            description: `Food Allergies for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Avoidance',
            severity: 'Moderate',
            status: 'Active',
            allergies: 'Food Allergies',
            notes: `Allergy information recorded during patient registration for ${patientName}`
          })
        }
        if (allergies.medicationAllergies) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Allergy',
            description: `Medication Allergies for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Avoidance',
            severity: 'Moderate',
            status: 'Active',
            allergies: 'Medication Allergies',
            notes: `Allergy information recorded during patient registration for ${patientName}`
          })
        }
        if (allergies.environmentalAllergies) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Allergy',
            description: `Environmental Allergies for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Avoidance',
            severity: 'Moderate',
            status: 'Active',
            allergies: 'Environmental Allergies',
            notes: `Allergy information recorded during patient registration for ${patientName}`
          })
        }
        if (allergies.other && allergies.otherText) {
          await addMedicalHistory({
            patient_id: patientDoc,
            condition: 'Allergy',
            description: `${allergies.otherText} for ${patientName}`,
            date_diagnosed: recordDate,
            treatment: 'Avoidance',
            severity: 'Moderate',
            status: 'Active',
            allergies: allergies.otherText,
            notes: `Allergy information recorded during patient registration for ${patientName}`
          })
        }
      }
      
      // Refresh medical history count after creating records
      await refreshMedicalHistoryCount()
      
      // Refresh patients list
      const updatedPatients = await getPatients()
      setPatients(updatedPatients)
      
      // Reset form
      resetForm()
      setIsAddDialogOpen(false)
      
      toast({
        title: "Success",
        description: "Patient added successfully"
      })
      
    } catch (error) {
      console.error("Error adding patient:", error)
      toast({
        title: "Error",
        description: "Failed to add patient",
        variant: "destructive"
      })
    } finally {
      setAddingPatient(false)
    }
  }

  const filteredPatients = patients.filter(patient =>
    patient.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(patient.contact_number).includes(searchTerm) ||
    patient.emergency_contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.care_notes?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCaregiverName = (caregiverId: string | undefined) => {
    if (!caregiverId || caregiverId.trim() === "" || caregiverId === "unassigned") return "Unassigned"
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId)
    if (!caregiver) return "Unassigned"
    
    const baseName = `${caregiver.first_name} ${caregiver.last_name}`
    const isTemporary = caregiver.temporary_schedule_reason
    
    return isTemporary ? `${baseName} 🔄` : baseName
  }

  const calculateAge = (birthdate: string) => {
    const today = new Date()
    const birth = new Date(birthdate)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800"
  }

  const isContractExpiringSoon = (endDate: string) => {
    if (!endDate) return false
    const today = new Date()
    const contractEnd = new Date(endDate)
    const daysUntilExpiry = Math.ceil((contractEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0
  }

  const isContractExpired = (endDate: string) => {
    if (!endDate) return false
    const today = new Date()
    const contractEnd = new Date(endDate)
    return contractEnd < today
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading patients...</p>
          </div>
        </div>
      </div>
    )
  }

  // If viewing medical history for a specific patient
  if (selectedPatientForMedicalHistory) {
    const selectedPatient = patients.find(p => p.patient_id === selectedPatientForMedicalHistory)
    
    return (
      <div className="p-6 space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={closeMedicalHistoryView}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Button>
            <div>
              <h1 className="text-5xl font-bold text-foreground">
                Medical Records
              </h1>
              <p className="text-xl text-muted-foreground">
                Manage patient medical history records and treatment information
              </p>
            </div>
          </div>
          
          <Button className="gap-2 h-12 text-base">
            <Plus className="h-5 w-5" />
            <span className="text-base">Add Medical Record</span>
          </Button>
        </div>

        {/* Patient Information Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Patient</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{selectedPatient?.first_name} {selectedPatient?.last_name}</div>
              <p className="text-xs text-muted-foreground">
                Age: {calculateAge(selectedPatient?.birthdate)} • {selectedPatient?.gender}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentPatientMedicalHistory.length}</div>
              <p className="text-xs text-muted-foreground">
                Medical history records
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Conditions</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currentPatientMedicalHistory.filter(record => record.status === 'Active').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Current conditions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contact</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{selectedPatient?.contact_number || "No contact"}</div>
              <p className="text-xs text-muted-foreground">
                Phone number
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Medical Records List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Medical History Records
            </CardTitle>
            <CardDescription>
              Complete medical history and conditions for this patient
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMedicalHistory ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Loading medical history records...</p>
                </div>
              </div>
            ) : currentPatientMedicalHistory.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  No medical history records found
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Patient medical history and treatment information will appear here
                </p>
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Medical Record
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentPatientMedicalHistory.map((record, index) => (
                  <div
                    key={record.id || index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {record.condition}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {record.severity}
                          </span>
                          {record.date_diagnosed && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(record.date_diagnosed).toLocaleDateString()}
                            </span>
                          )}
                          {record.treatment && (
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              Treatment: {record.treatment}
                            </span>
                          )}
                          {record.medications && (
                            <span className="flex items-center gap-1">
                              <Pill className="h-3 w-3" />
                              {record.medications}
                            </span>
                          )}
                        </div>
                        {record.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {record.description}
                          </p>
                        )}
                        {record.notes && (
                          <p className="text-sm text-muted-foreground italic mt-1">
                            Notes: {record.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={
                        record.status === 'Active' 
                          ? 'bg-green-100 text-green-800' 
                          : record.status === 'Resolved'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }>
                        {record.status}
                      </Badge>
                      <Badge variant="outline" className={
                        record.severity === 'Severe' 
                          ? 'border-red-200 text-red-800' 
                          : record.severity === 'Moderate'
                          ? 'border-yellow-200 text-yellow-800'
                          : 'border-blue-200 text-blue-800'
                      }>
                        {record.severity}
                      </Badge>
                      <Button variant="ghost" size="sm" title="View Details">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Edit Record">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete Record" className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold text-foreground">Patient Management</h1>
          <p className="text-xl text-muted-foreground">Manage elderly patient records and information</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {formStep === 1 ? "Add New Patient - Basic Information" : "Add New Patient - Medical History"}
                </DialogTitle>
                <DialogDescription>
                  {formStep === 1 
                    ? "Enter patient information to create a new record." 
                    : "Select the patient's medical conditions, medications, and allergies."
                  }
                </DialogDescription>
                {/* Step indicator */}
                <div className="flex items-center gap-2 mt-2">
                  <div className={`h-2 w-8 rounded-full ${formStep === 1 ? 'bg-primary' : 'bg-primary/30'}`} />
                  <div className={`h-2 w-8 rounded-full ${formStep === 2 ? 'bg-primary' : 'bg-muted'}`} />
                  <span className="text-sm text-muted-foreground ml-2">
                    Step {formStep} of 2
                  </span>
                </div>
              </DialogHeader>
              
              {formStep === 1 ? (
                /* Step 1: Basic Information */
                <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input 
                      id="firstName" 
                      placeholder="Enter first name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input 
                      id="lastName" 
                      placeholder="Enter last name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="birthdate">Birth Date *</Label>
                    <Input 
                      id="birthdate" 
                      type="date"
                      value={formData.birthdate}
                      onChange={(e) => handleInputChange("birthdate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select 
                      value={formData.gender || ""} 
                      onValueChange={(value) => handleInputChange("gender", value as "Male" | "Female" | "Other")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone" 
                    placeholder="Enter phone number"
                    value={formData.contact_number}
                    onChange={(e) => handleInputChange("contact_number", e.target.value)}
                    type="tel"
                  />
                </div>
                
                {/* Address Section with PSGC API */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Address *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="province">Province *</Label>
                      <Select value={formData.selectedProvinceCode} onValueChange={handleProvinceChange} disabled={loadingAddressData}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingAddressData ? "Loading provinces..." : "Select province"} />
                        </SelectTrigger>
                        <SelectContent>
                          {provinces.map((province) => (
                            <SelectItem key={province.code} value={province.code}>
                              {province.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">City/Municipality *</Label>
                      <Select value={formData.selectedCityCode} onValueChange={handleCityChange} disabled={!formData.selectedProvinceCode || loadingAddressData}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingAddressData ? "Loading cities..." : "Select city/municipality"} />
                        </SelectTrigger>
                        <SelectContent>
                          {cities.map((city) => (
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
                      <Select value={formData.selectedBarangayCode} onValueChange={handleBarangayChange} disabled={!formData.selectedCityCode || loadingAddressData}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingAddressData ? "Loading barangays..." : "Select barangay"} />
                        </SelectTrigger>
                        <SelectContent>
                          {barangays.map((barangay) => (
                            <SelectItem key={barangay.code} value={barangay.code}>
                              {barangay.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="street">Street/Building *</Label>
                      <Input 
                        id="street" 
                        placeholder="Enter street address, building, unit number"
                        value={formData.address.street}
                        onChange={(e) => handleInputChange("address.street", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Emergency Contact</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="emergencyName">Contact Name</Label>
                      <Input 
                        id="emergencyName" 
                        placeholder="Enter emergency contact name"
                        value={formData.emergency_contact_name}
                        onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="emergencyPhone">Contact Phone</Label>
                      <Input 
                        id="emergencyPhone" 
                        placeholder="Enter emergency contact phone"
                        value={formData.emergency_contact_phone}
                        onChange={(e) => handleInputChange("emergency_contact_phone", e.target.value)}
                        type="tel"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="emergencyRelationship">Relationship</Label>
                      <Input 
                        id="emergencyRelationship" 
                        placeholder="e.g., Son, Daughter, Spouse, Friend"
                        value={formData.emergency_contact_relationship}
                        onChange={(e) => handleInputChange("emergency_contact_relationship", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="guardianEmail">Guardian Email</Label>
                      <Input 
                        id="guardianEmail" 
                        placeholder="Enter guardian email address"
                        value={formData.guardian_email}
                        onChange={(e) => handleInputChange("guardian_email", e.target.value)}
                        type="email"
                      />
                    </div>
                  </div>
                </div>

                {/* Contract Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Contract Information</h3>
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
                
                {/* Caregiver Assignment Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Caregiver Assignment</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="dayCaregiver">Day Shift Caregiver</Label>
                      <Select 
                        value={formData.assigned_day_caregiver_id || "unassigned"} 
                        onValueChange={(value) => handleInputChange("assigned_day_caregiver_id", value === "unassigned" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select day caregiver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">No caregiver assigned</SelectItem>
                          {/* Show ONLY DAY SHIFT caregivers with their capacity info */}
                          {caregivers.filter(c => c.shift_type === 'Day').length === 0 && <SelectItem value="debug">No day shift caregivers available</SelectItem>}
                          {caregivers.filter(c => c.shift_type === 'Day').map((caregiver) => {
                            const currentCount = calculateCaregiverPatientCount(caregiver.caregiver_id, caregiver.shift_type);
                            const maxPatients = caregiver.max_patients || 2;
                            const isAtCapacity = currentCount >= maxPatients;
                            const isTemporary = caregiver.temporary_schedule_reason; // Check if temporary schedule exists
                            
                            return (
                              <SelectItem 
                                key={`day-${caregiver.caregiver_id}`} 
                                value={caregiver.caregiver_id}
                                disabled={isAtCapacity}
                              >
                                {caregiver.first_name} {caregiver.last_name} 
                                [{currentCount}/{maxPatients} patients]
                                {isAtCapacity && " - FULL"}
                                {isTemporary && " 🔄 TEMP"}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="nightCaregiver">Night Shift Caregiver</Label>
                      <Select 
                        value={formData.assigned_night_caregiver_id || "unassigned"} 
                        onValueChange={(value) => handleInputChange("assigned_night_caregiver_id", value === "unassigned" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select night caregiver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">No caregiver assigned</SelectItem>
                          {/* Show ONLY NIGHT SHIFT caregivers with their capacity info */}
                          {caregivers.filter(c => c.shift_type === 'Night').length === 0 && <SelectItem value="debug">No night shift caregivers available</SelectItem>}
                          {caregivers.filter(c => c.shift_type === 'Night').map((caregiver) => {
                            const currentCount = calculateCaregiverPatientCount(caregiver.caregiver_id, caregiver.shift_type);
                            const maxPatients = caregiver.max_patients || 4;
                            const isAtCapacity = currentCount >= maxPatients;
                            const isTemporary = caregiver.temporary_schedule_reason; // Check if temporary schedule exists
                            
                            return (
                              <SelectItem 
                                key={`night-${caregiver.caregiver_id}`} 
                                value={caregiver.caregiver_id}
                                disabled={isAtCapacity}
                              >
                                {caregiver.first_name} {caregiver.last_name} 
                                [{currentCount}/{maxPatients} patients]
                                {isAtCapacity && " - FULL"}
                                {isTemporary && " 🔄 TEMP"}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              ) : (
                /* Step 2: Medical History */
                <div className="grid gap-6 py-4">
                  {/* Current Medical Conditions */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Current Medical Conditions</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="diabetes"
                          checked={formData.medical_history.currentMedicalConditions.diabetes}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedicalConditions", "diabetes", checked as boolean)}
                        />
                        <Label htmlFor="diabetes">Diabetes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="hypertension"
                          checked={formData.medical_history.currentMedicalConditions.hypertension}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedicalConditions", "hypertension", checked as boolean)}
                        />
                        <Label htmlFor="hypertension">Hypertension</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="heartDisease"
                          checked={formData.medical_history.currentMedicalConditions.heartDisease}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedicalConditions", "heartDisease", checked as boolean)}
                        />
                        <Label htmlFor="heartDisease">Heart Disease</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="arthritis"
                          checked={formData.medical_history.currentMedicalConditions.arthritis}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedicalConditions", "arthritis", checked as boolean)}
                        />
                        <Label htmlFor="arthritis">Arthritis</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="dementia"
                          checked={formData.medical_history.currentMedicalConditions.dementia}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedicalConditions", "dementia", checked as boolean)}
                        />
                        <Label htmlFor="dementia">Dementia</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="otherCondition"
                          checked={formData.medical_history.currentMedicalConditions.other}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedicalConditions", "other", checked as boolean)}
                        />
                        <Label htmlFor="otherCondition">Other</Label>
                      </div>
                    </div>
                    {formData.medical_history.currentMedicalConditions.other && (
                      <div className="grid gap-2">
                        <Label htmlFor="otherConditionText">Other Medical Condition</Label>
                        <Input 
                          id="otherConditionText"
                          placeholder="Please specify..."
                          value={formData.medical_history.currentMedicalConditions.otherText || ""}
                          onChange={(e) => handleMedicalHistoryOtherText("currentMedicalConditions", e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Past Medical History */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Past Medical History</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="cancer"
                          checked={formData.medical_history.pastMedicalHistory.cancer}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("pastMedicalHistory", "cancer", checked as boolean)}
                        />
                        <Label htmlFor="cancer">Cancer</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="stroke"
                          checked={formData.medical_history.pastMedicalHistory.stroke}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("pastMedicalHistory", "stroke", checked as boolean)}
                        />
                        <Label htmlFor="stroke">Stroke</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="heartAttack"
                          checked={formData.medical_history.pastMedicalHistory.heartAttack}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("pastMedicalHistory", "heartAttack", checked as boolean)}
                        />
                        <Label htmlFor="heartAttack">Heart Attack</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="fractures"
                          checked={formData.medical_history.pastMedicalHistory.fractures}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("pastMedicalHistory", "fractures", checked as boolean)}
                        />
                        <Label htmlFor="fractures">Fractures</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="otherPastCondition"
                          checked={formData.medical_history.pastMedicalHistory.other}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("pastMedicalHistory", "other", checked as boolean)}
                        />
                        <Label htmlFor="otherPastCondition">Other</Label>
                      </div>
                    </div>
                    {formData.medical_history.pastMedicalHistory.other && (
                      <div className="grid gap-2">
                        <Label htmlFor="otherPastConditionText">Other Past Medical History</Label>
                        <Input 
                          id="otherPastConditionText"
                          placeholder="Please specify..."
                          value={formData.medical_history.pastMedicalHistory.otherText || ""}
                          onChange={(e) => handleMedicalHistoryOtherText("pastMedicalHistory", e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Current Medications */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Current Medications</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="bloodPressureMed"
                          checked={formData.medical_history.currentMedications.bloodPressure}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedications", "bloodPressure", checked as boolean)}
                        />
                        <Label htmlFor="bloodPressureMed">Blood Pressure Medication</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="diabetesMed"
                          checked={formData.medical_history.currentMedications.diabetes}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedications", "diabetes", checked as boolean)}
                        />
                        <Label htmlFor="diabetesMed">Diabetes Medication</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="painReliefMed"
                          checked={formData.medical_history.currentMedications.painRelief}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedications", "painRelief", checked as boolean)}
                        />
                        <Label htmlFor="painReliefMed">Pain Relief</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="antidepressantsMed"
                          checked={formData.medical_history.currentMedications.antidepressants}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedications", "antidepressants", checked as boolean)}
                        />
                        <Label htmlFor="antidepressantsMed">Antidepressants</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="otherMedication"
                          checked={formData.medical_history.currentMedications.other}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("currentMedications", "other", checked as boolean)}
                        />
                        <Label htmlFor="otherMedication">Other</Label>
                      </div>
                    </div>
                    {formData.medical_history.currentMedications.other && (
                      <div className="grid gap-2">
                        <Label htmlFor="otherMedicationText">Other Medication</Label>
                        <Input 
                          id="otherMedicationText"
                          placeholder="Please specify..."
                          value={formData.medical_history.currentMedications.otherText || ""}
                          onChange={(e) => handleMedicalHistoryOtherText("currentMedications", e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Known Allergies */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Known Allergies</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="foodAllergies"
                          checked={formData.medical_history.knownAllergies.foodAllergies}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("knownAllergies", "foodAllergies", checked as boolean)}
                        />
                        <Label htmlFor="foodAllergies">Food Allergies</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="medicationAllergies"
                          checked={formData.medical_history.knownAllergies.medicationAllergies}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("knownAllergies", "medicationAllergies", checked as boolean)}
                        />
                        <Label htmlFor="medicationAllergies">Medication Allergies</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="environmentalAllergies"
                          checked={formData.medical_history.knownAllergies.environmentalAllergies}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("knownAllergies", "environmentalAllergies", checked as boolean)}
                        />
                        <Label htmlFor="environmentalAllergies">Environmental Allergies</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="otherAllergies"
                          checked={formData.medical_history.knownAllergies.other}
                          onCheckedChange={(checked) => handleMedicalHistoryCheckbox("knownAllergies", "other", checked as boolean)}
                        />
                        <Label htmlFor="otherAllergies">Other</Label>
                      </div>
                    </div>
                    {formData.medical_history.knownAllergies.other && (
                      <div className="grid gap-2">
                        <Label htmlFor="otherAllergiesText">Other Allergies</Label>
                        <Input 
                          id="otherAllergiesText"
                          placeholder="Please specify..."
                          value={formData.medical_history.knownAllergies.otherText || ""}
                          onChange={(e) => handleMedicalHistoryOtherText("knownAllergies", e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                {formStep === 2 && (
                  <Button variant="outline" onClick={handleBackStep}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleCloseDialog(false)}>
                  Cancel
                </Button>
                {formStep === 1 ? (
                  <Button onClick={handleNextStep}>
                    Next
                    <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                  </Button>
                ) : (
                  <Button onClick={handleAddPatient} disabled={addingPatient}>
                    {addingPatient ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Patient"
                    )}
                  </Button>
                )}
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
                placeholder="Search patients by name, phone, emergency contact, or care notes..."
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patients.length}</div>
            <p className="text-xs text-muted-foreground">
              Active patient records
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Caregivers</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {patients.filter(p => p.assigned_day_caregiver_id || p.assigned_night_caregiver_id || p.assigned_caregiver_id).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Have assigned caregivers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emergency Contacts</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {patients.filter(p => p.emergency_contact_name).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Have emergency contacts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Contracts</CardTitle>
            <FileText className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {patients.filter(p => p.contract_end_date && isContractExpiringSoon(p.contract_end_date)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Contracts expiring within 30 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medical History Records</CardTitle>
            <FileText className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMedicalHistoryCount}</div>
            <p className="text-xs text-muted-foreground">
              Total medical records across all patients
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patient List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Patient Records
          </CardTitle>
          <CardDescription>
            All registered patients in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPatients.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {patients.length === 0 ? "No patients added yet" : "No patients match your search"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {patients.length === 0 
                  ? "Click 'Add Patient' to create your first patient record" 
                  : "Try adjusting your search terms"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.patient_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Age: {calculateAge(patient.birthdate)}</span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {patient.contact_number || "No phone"}
                        </span>
                        {patient.mobility_level && (
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {patient.mobility_level}
                          </span>
                        )}
                        {patient.emergency_contact_name && (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Emergency: {patient.emergency_contact_name}
                          </span>
                        )}
                        {patient.contract_start_date && (
                          <span className={`flex items-center gap-1 ${
                            patient.contract_end_date && isContractExpired(patient.contract_end_date) 
                              ? 'text-red-600' 
                              : patient.contract_end_date && isContractExpiringSoon(patient.contract_end_date)
                                ? 'text-orange-600'
                                : ''
                          }`}>
                            <FileText className="h-3 w-3" />
                            Contract: {new Date(patient.contract_start_date).toLocaleDateString()}
                            {patient.contract_end_date && ` - ${new Date(patient.contract_end_date).toLocaleDateString()}`}
                            {patient.contract_end_date && isContractExpired(patient.contract_end_date) && ' (EXPIRED)'}
                            {patient.contract_end_date && isContractExpiringSoon(patient.contract_end_date) && !isContractExpired(patient.contract_end_date) && ' (EXPIRES SOON)'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getStatusColor(patient.is_active)}>
                          {patient.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <span>Day: {getCaregiverName(patient.assigned_day_caregiver_id)}</span>
                          <span>Night: {getCaregiverName(patient.assigned_night_caregiver_id)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openViewDialog(patient)}
                      title="View Patient Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowEmergencyContact(patient)}
                      title="Emergency Contact Info"
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                    <MedicalHistoryDialog 
                      patient={patient}
                      trigger={
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="gap-1"
                          title="View Medical History"
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openEditDialog(patient)}
                      title="Edit Patient"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openMedicalHistoryView(patient.patient_id)}
                      title="View Medical History"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setDeletingPatient(patient.patient_id)}
                      title="Delete Patient"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Patient Dialog */}
      <Dialog open={!!viewingPatient} onOpenChange={() => setViewingPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>
              Complete information for {viewingPatient?.first_name} {viewingPatient?.last_name}
            </DialogDescription>
          </DialogHeader>
          {viewingPatient && (
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">First Name</Label>
                  <p className="text-sm">{viewingPatient.first_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Name</Label>
                  <p className="text-sm">{viewingPatient.last_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Birthdate</Label>
                  <p className="text-sm">{viewingPatient.birthdate ? new Date(viewingPatient.birthdate).toLocaleDateString() : "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Gender</Label>
                  <p className="text-sm">{viewingPatient.gender || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Contact Number</Label>
                  <p className="text-sm">{viewingPatient.contact_number || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(viewingPatient.is_active)}>
                    {viewingPatient.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Address */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Address</Label>
                <p className="text-sm">{viewingPatient.address || "Not provided"}</p>
              </div>

              {/* Assigned Caregivers */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Assigned Caregivers</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Day Caregiver</Label>
                    <p className="text-sm">{getCaregiverName(viewingPatient.assigned_day_caregiver_id)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Night Caregiver</Label>
                    <p className="text-sm">{getCaregiverName(viewingPatient.assigned_night_caregiver_id)}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Emergency Contact</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <p className="text-sm">{viewingPatient.emergency_contact_name || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="text-sm">{viewingPatient.emergency_contact_phone || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Relationship</Label>
                    <p className="text-sm">{viewingPatient.emergency_contact_relationship || "Not provided"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Guardian Email</Label>
                    <p className="text-sm">{viewingPatient.guardian_email || "Not provided"}</p>
                  </div>
                </div>
              </div>

              {/* Contract Information */}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Contract Information</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start Date</Label>
                    <p className="text-sm">
                      {viewingPatient.contract_start_date ? 
                        new Date(viewingPatient.contract_start_date).toLocaleDateString() : 
                        "Not specified"
                      }
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End Date</Label>
                    <p className="text-sm">
                      {viewingPatient.contract_end_date ? 
                        new Date(viewingPatient.contract_end_date).toLocaleDateString() : 
                        "Not specified"
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={!!editingPatient} onOpenChange={() => {
        setEditingPatient(null)
        resetForm()
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>
              Update patient information for {editingPatient?.first_name} {editingPatient?.last_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-first-name">First Name *</Label>
              <Input
                id="edit-first-name"
                value={formData.first_name}
                onChange={(e) => handleInputChange("first_name", e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div>
              <Label htmlFor="edit-last-name">Last Name *</Label>
              <Input
                id="edit-last-name"
                value={formData.last_name}
                onChange={(e) => handleInputChange("last_name", e.target.value)}
                placeholder="Enter last name"
              />
            </div>
            <div>
              <Label htmlFor="edit-birthdate">Birthdate *</Label>
              <Input
                id="edit-birthdate"
                type="date"
                value={formData.birthdate}
                onChange={(e) => handleInputChange("birthdate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                <SelectTrigger id="edit-gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-contact">Contact Number</Label>
              <Input
                id="edit-contact"
                value={formData.contact_number}
                onChange={(e) => handleInputChange("contact_number", e.target.value)}
                placeholder="Enter contact number"
              />
            </div>
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={`${formData.address.street}, ${formData.address.barangay}, ${formData.address.city_municipality}, ${formData.address.province}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')}
                onChange={(e) => {
                  // For simplicity, store the full address in the street field when editing
                  handleInputChange("address.street", e.target.value);
                  handleInputChange("address.barangay", "");
                  handleInputChange("address.city_municipality", "");
                  handleInputChange("address.province", "");
                }}
                placeholder="Enter address"
              />
            </div>
            <div>
              <Label htmlFor="edit-day-caregiver">Day Caregiver</Label>
              <Select value={formData.assigned_day_caregiver_id || "unassigned"} onValueChange={(value) => handleInputChange("assigned_day_caregiver_id", value === "unassigned" ? "" : value)}>
                <SelectTrigger id="edit-day-caregiver">
                  <SelectValue placeholder="Select day caregiver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No Assignment</SelectItem>
                  {getAvailableDayCaregiversWithCapacity(editingPatient?.patient_id)
                    .filter(caregiver => caregiver?.caregiver_id && caregiver.caregiver_id.trim() !== '')
                    .map((caregiver) => (
                    <SelectItem 
                      key={caregiver?.caregiver_id} 
                      value={caregiver?.caregiver_id || "unassigned"}
                      disabled={caregiver?.isAtCapacity && formData.assigned_day_caregiver_id !== caregiver?.caregiver_id}
                    >
                      {`${caregiver?.first_name} ${caregiver?.last_name}`} ({caregiver?.currentCount}/{caregiver?.maxPatients})
                      {caregiver?.isAtCapacity && formData.assigned_day_caregiver_id !== caregiver?.caregiver_id && " - Full"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-night-caregiver">Night Caregiver</Label>
              <Select value={formData.assigned_night_caregiver_id || "unassigned"} onValueChange={(value) => handleInputChange("assigned_night_caregiver_id", value === "unassigned" ? "" : value)}>
                <SelectTrigger id="edit-night-caregiver">
                  <SelectValue placeholder="Select night caregiver" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No Assignment</SelectItem>
                  {getAvailableNightCaregiversWithCapacity(editingPatient?.patient_id)
                    .filter(caregiver => caregiver?.caregiver_id && caregiver.caregiver_id.trim() !== '')
                    .map((caregiver) => (
                    <SelectItem 
                      key={caregiver?.caregiver_id} 
                      value={caregiver?.caregiver_id || "unassigned"}
                      disabled={caregiver?.isAtCapacity && formData.assigned_night_caregiver_id !== caregiver?.caregiver_id}
                    >
                      {`${caregiver?.first_name} ${caregiver?.last_name}`} ({caregiver?.currentCount}/{caregiver?.maxPatients})
                      {caregiver?.isAtCapacity && formData.assigned_night_caregiver_id !== caregiver?.caregiver_id && " - Full"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-emergency-name">Emergency Contact Name</Label>
              <Input
                id="edit-emergency-name"
                value={formData.emergency_contact_name}
                onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
                placeholder="Enter emergency contact name"
              />
            </div>
            <div>
              <Label htmlFor="edit-emergency-phone">Emergency Contact Phone</Label>
              <Input
                id="edit-emergency-phone"
                value={formData.emergency_contact_phone}
                onChange={(e) => handleInputChange("emergency_contact_phone", e.target.value)}
                placeholder="Enter emergency contact phone"
              />
            </div>
            <div>
              <Label htmlFor="edit-emergency-relationship">Emergency Contact Relationship</Label>
              <Input
                id="edit-emergency-relationship"
                value={formData.emergency_contact_relationship}
                onChange={(e) => handleInputChange("emergency_contact_relationship", e.target.value)}
                placeholder="e.g., Son, Daughter, Spouse"
              />
            </div>
            <div>
              <Label htmlFor="edit-guardian-email">Guardian Email</Label>
              <Input
                id="edit-guardian-email"
                value={formData.guardian_email}
                onChange={(e) => handleInputChange("guardian_email", e.target.value)}
                placeholder="Enter guardian email address"
                type="email"
              />
            </div>
            <div>
              <Label htmlFor="edit-contract-start">Contract Start Date</Label>
              <Input
                id="edit-contract-start"
                type="date"
                value={formData.contract_start_date}
                onChange={(e) => handleInputChange("contract_start_date", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-contract-end">Contract End Date</Label>
              <Input
                id="edit-contract-end"
                type="date"
                value={formData.contract_end_date}
                onChange={(e) => handleInputChange("contract_end_date", e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => {
              setEditingPatient(null)
              resetForm()
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePatient} disabled={updatingPatient}>
              {updatingPatient ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Patient"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emergency Contact Dialog */}
      <Dialog open={!!showEmergencyContact} onOpenChange={() => setShowEmergencyContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emergency Contact Information</DialogTitle>
            <DialogDescription>
              Emergency contact for {showEmergencyContact?.first_name} {showEmergencyContact?.last_name}
            </DialogDescription>
          </DialogHeader>
          {showEmergencyContact && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Contact Name</Label>
                  <p className="text-sm">{showEmergencyContact.emergency_contact_name || "Not provided"}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Relationship</Label>
                  <p className="text-sm">{showEmergencyContact.emergency_contact_relationship || "Not specified"}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <p className="text-sm">{showEmergencyContact.emergency_contact_phone || "Not provided"}</p>
                  {showEmergencyContact.emergency_contact_phone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`tel:${showEmergencyContact.emergency_contact_phone}`, '_self')}
                    >
                      <Phone className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPatient} onOpenChange={() => setDeletingPatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the patient record and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPatient && handleDeletePatient(deletingPatient)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Patient
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Patients
