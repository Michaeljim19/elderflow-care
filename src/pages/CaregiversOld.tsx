import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Mail, Phone, Clock, Users, Loader2, Search, Filter } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Caregiver, CaregiverStatus, CaregiverRole, ShiftType } from "@/types";
import { getCaregivers, addCaregiver, updateCaregiver, deleteCaregiver } from "@/services/firebase";

export default function Caregivers() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCaregiver, setEditingCaregiver] = useState<Caregiver | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingCaregiver, setAddingCaregiver] = useState(false);
  const [updatingCaregiver, setUpdatingCaregiver] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // PSGC API states
  const [provinces, setProvinces] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [barangays, setBarangays] = useState<any[]>([]);
  const [loadingAddressData, setLoadingAddressData] = useState(false);

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
    shift_type: "Day" as ShiftType,
    shift_start_date: "",
    shift_end_date: "",
    role: "caregiver" as CaregiverRole
  });

  // Function to calculate shift end date (start date + 3 days)
  const calculateShiftEndDate = (startDate: string): string => {
    if (!startDate) return "";
    
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 3);
    
    return end.toISOString().split('T')[0];
  };

  // Function to convert date string to Firebase Timestamp
  const dateToTimestamp = (dateString: string): Timestamp => {
    if (!dateString) return Timestamp.now();
    return Timestamp.fromDate(new Date(dateString));
  };

  // Function to convert Firebase Timestamp to date string
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

  // Load caregivers on component mount
  useEffect(() => {
    const loadCaregivers = async () => {
      try {
        setLoading(true);
        console.log('Loading caregivers, user auth state:', user ? 'authenticated' : 'not authenticated');
        const caregiversData = await getCaregivers();
        setCaregivers(caregiversData);
      } catch (error) {
        console.error("Error loading caregivers:", error);
        toast({
          title: "Error",
          description: "Failed to load caregivers. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadCaregivers();
  }, [user, toast]);

  // PSGC API functions - Limited to Baliwag (Bulacan) and Pampanga
  const fetchProvinces = async () => {
    try {
      setLoadingAddressData(true);
      // Directly fetch provinces for Central Luzon (Region III)
      const response = await fetch('https://psgc.gitlab.io/api/regions/030000000/provinces/');
      const data = await response.json();
      // Filter to only include Bulacan and Pampanga
      const filteredProvinces = data.filter((province: any) => 
        province.name === 'Bulacan' || province.name === 'Pampanga'
      );
      setProvinces(filteredProvinces);
    } catch (error) {
      console.error('Error fetching provinces:', error);
      toast({
        title: "Error",
        description: "Failed to load provinces.",
        variant: "destructive"
      });
    } finally {
      setLoadingAddressData(false);
    }
  };

  const fetchCities = async (provinceCode: string) => {
    try {
      setLoadingAddressData(true);
      const response = await fetch(`https://psgc.gitlab.io/api/provinces/${provinceCode}/cities-municipalities/`);
      const data = await response.json();
      
      console.log('All cities for province:', data); // Debug log
      
      // Get the selected province name to apply specific filtering
      const selectedProvince = provinces.find(p => p.code === provinceCode);
      let filteredCities = data;
      
      // If Bulacan is selected, only show Baliwag
      if (selectedProvince && selectedProvince.name === 'Bulacan') {
        filteredCities = data.filter((city: any) => 
          city.name.toLowerCase().includes('baliwag') || 
          city.name.toLowerCase().includes('baliuag')
        );
        console.log('Filtered cities for Bulacan:', filteredCities); // Debug log
      }
      // If Pampanga is selected, show all cities/municipalities
      
      setCities(filteredCities);
    } catch (error) {
      console.error('Error fetching cities:', error);
    } finally {
      setLoadingAddressData(false);
    }
  };

  const fetchBarangays = async (cityCode: string) => {
    try {
      setLoadingAddressData(true);
      const response = await fetch(`https://psgc.gitlab.io/api/cities-municipalities/${cityCode}/barangays/`);
      const data = await response.json();
      setBarangays(data);
    } catch (error) {
      console.error('Error fetching barangays:', error);
    } finally {
      setLoadingAddressData(false);
    }
  };

  // Load provinces on component mount
  useEffect(() => {
    fetchProvinces();
  }, []);

  const resetForm = () => {
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
      shift_type: "Day",
      shift_start_date: "",
      shift_end_date: "",
      role: "caregiver"
    });
    
    // Clear the address data arrays when resetting
    setCities([]);
    setBarangays([]);
  };

  const handleAdd = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.contact_number || !formData.birthday || !formData.shift_start_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (First Name, Last Name, Email, Contact Number, Birthday, and Shift Start Date). Middle Name is optional.",
        variant: "destructive"
      });
      return;
    }

    // Check if user is authenticated
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to add caregivers.",
        variant: "destructive"
      });
      return;
    }

    try {
      setAddingCaregiver(true);
      
      // Only send fields that match Firebase structure
      const newCaregiverData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthday: formData.birthday,
        email: formData.email,
        contact_number: Number(formData.contact_number),
        shift_type: formData.shift_type,
        role: formData.role
      };

      // Only add optional fields if they have values
      if (formData.middle_name && formData.middle_name.trim() !== '') {
        newCaregiverData.middle_name = formData.middle_name;
      }
      
      if (formData.shift_start_date && formData.shift_start_date.trim() !== '') {
        newCaregiverData.shift_start_date = dateToTimestamp(formData.shift_start_date);
        newCaregiverData.shift_end_date = dateToTimestamp(calculateShiftEndDate(formData.shift_start_date));
      }

      // Add address if any field is filled
      if (formData.address.province || formData.address.city_municipality || 
          formData.address.barangay || formData.address.street) {
        newCaregiverData.address = formData.address;
      }

      console.log('User authenticated:', user.email);
      console.log('Adding caregiver data:', newCaregiverData);

      await addCaregiver(newCaregiverData);
      
      // Refresh caregivers list
      const updatedCaregivers = await getCaregivers();
      setCaregivers(updatedCaregivers);
      
      resetForm();
      setIsAddDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Caregiver added successfully!"
      });
    } catch (error) {
      console.error("Error adding caregiver:", error);
      toast({
        title: "Error",
        description: "Failed to add caregiver. Please try again.",
        variant: "destructive"
      });
    } finally {
      setAddingCaregiver(false);
    }
  };

  const handleEdit = async (caregiver: Caregiver) => {
    setEditingCaregiver(caregiver);
    
    setFormData({
      first_name: caregiver.first_name,
      middle_name: caregiver.middle_name || "",
      last_name: caregiver.last_name,
      birthday: caregiver.birthday || "",
      email: caregiver.email,
      contact_number: String(caregiver.contact_number),
      address: caregiver.address || {
        province: "",
        city_municipality: "",
        barangay: "",
        street: ""
      },
      shift_type: caregiver.shift_type,
      shift_start_date: timestampToDate(caregiver.shift_start_date),
      shift_end_date: timestampToDate(caregiver.shift_end_date),
      role: caregiver.role
    });
    
    // Load address data if available
    const caregiverAddress = caregiver.address;
    if (caregiverAddress?.province) {
      try {
        // Find the province in the already loaded provinces array
        const selectedProvince = provinces.find(p => 
          p.code === caregiverAddress.province || p.name === caregiverAddress.province
        );
        
        if (selectedProvince) {
          // Load cities for the selected province
          await fetchCities(selectedProvince.code);
          
          // If there's a city, load barangays after cities are loaded
          if (caregiverAddress.city_municipality) {
            // Wait a bit for cities to be loaded, then find the city and load barangays
            setTimeout(async () => {
              const response = await fetch(`https://psgc.gitlab.io/api/provinces/${selectedProvince.code}/cities-municipalities/`);
              const citiesData = await response.json();
              
              // Apply filtering for Bulacan (only Baliwag)
              let filteredCities = citiesData;
              if (selectedProvince.name === 'Bulacan') {
                filteredCities = citiesData.filter((city: any) => 
                  city.name.toLowerCase().includes('baliwag') || 
                  city.name.toLowerCase().includes('baliuag')
                );
              }
              
              const selectedCity = filteredCities.find(c => 
                c.code === caregiverAddress.city_municipality || c.name === caregiverAddress.city_municipality
              );
              
              if (selectedCity) {
                await fetchBarangays(selectedCity.code);
              }
            }, 500);
          }
        }
      } catch (error) {
        console.error('Error loading address data for editing:', error);
      }
    }
  };

  const handleUpdate = async () => {
    if (!editingCaregiver) return;
    
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.contact_number || !formData.birthday || !formData.shift_start_date) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (First Name, Last Name, Email, Contact Number, Birthday, and Shift Start Date). Middle Name is optional.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setUpdatingCaregiver(true);
      
      const updatedData: any = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        birthday: formData.birthday,
        email: formData.email,
        contact_number: Number(formData.contact_number),
        shift_type: formData.shift_type,
        role: formData.role,
        updated_at: Timestamp.now()
      };

      // Only add optional fields if they have values
      if (formData.middle_name && formData.middle_name.trim() !== '') {
        updatedData.middle_name = formData.middle_name;
      }
      
      if (formData.shift_start_date && formData.shift_start_date.trim() !== '') {
        updatedData.shift_start_date = dateToTimestamp(formData.shift_start_date);
        updatedData.shift_end_date = dateToTimestamp(calculateShiftEndDate(formData.shift_start_date));
      }

      // Add address if any field is filled
      if (formData.address.province || formData.address.city_municipality || 
          formData.address.barangay || formData.address.street) {
        updatedData.address = formData.address;
      }

      await updateCaregiver(editingCaregiver.caregiver_id, updatedData);
      
      // Refresh caregivers list
      const updatedCaregivers = await getCaregivers();
      setCaregivers(updatedCaregivers);
      
      setEditingCaregiver(null);
      resetForm();
      
      toast({
        title: "Success",
        description: "Caregiver updated successfully!"
      });
    } catch (error) {
      console.error("Error updating caregiver:", error);
      toast({
        title: "Error",
        description: "Failed to update caregiver. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingCaregiver(false);
    }
  };

  const handleDelete = async (caregiverId: string) => {
    try {
      await deleteCaregiver(caregiverId);
      
      // Refresh caregivers list
      const updatedCaregivers = await getCaregivers();
      setCaregivers(updatedCaregivers);
      
      toast({
        title: "Success",
        description: "Caregiver deleted successfully!"
      });
    } catch (error) {
      console.error("Error deleting caregiver:", error);
      toast({
        title: "Error",
        description: "Failed to delete caregiver. Please try again.",
        variant: "destructive"
      });
    }
  };

  const filteredCaregivers = caregivers.filter(caregiver =>
    caregiver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caregiver.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caregiver.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dayCaregivers = caregivers.filter(c => c.shift_type === "Day").length;
  const nightCaregivers = caregivers.filter(c => c.shift_type === "Night").length;

  // Function to calculate age from birthday
  const calculateAge = (birthday: string): number => {
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const getShiftBadgeColor = (shiftType: ShiftType) => {
    switch (shiftType) {
      case "Day": return "bg-primary/10 text-primary border-primary/20";
      case "Night": return "bg-violet-500/10 text-violet-700 border-violet-500/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading caregivers...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caregiver Management</h1>
          <p className="text-muted-foreground">Manage caregiver profiles and schedules</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Caregiver
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Caregiver</DialogTitle>
                <DialogDescription>
                  Enter the caregiver's information to create a new record.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">{/* Form content stays the same */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="middle_name">Middle Name (Optional)</Label>
                  <Input
                    id="middle_name"
                    value={formData.middle_name}
                    onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                    placeholder="Enter middle name"
                  />
                </div>
                <div>
                  <Label htmlFor="birthday">Birthday *</Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              
                <div>
                  <Label htmlFor="contact_number">Contact Number *</Label>
                  <Input
                    id="contact_number"
                    type="number"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                    placeholder="Enter contact number"
                  />
                </div>              {/* Address Section */}
              <div className="space-y-4">
                <Label className="text-sm font-medium">Address (Optional - Baliwag, Bulacan & Pampanga only)</Label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="province">Province</Label>
                    <Select 
                      value={formData.address.province} 
                      onValueChange={async (value) => {
                        // Clear dependent fields first
                        setCities([]);
                        setBarangays([]);
                        
                        setFormData({
                          ...formData, 
                          address: {
                            ...formData.address,
                            province: value,
                            city_municipality: "",
                            barangay: ""
                          }
                        });
                        
                        // Then fetch new cities
                        const selectedProvince = provinces.find(p => p.name === value);
                        if (selectedProvince) {
                          await fetchCities(selectedProvince.code);
                        }
                      }}
                      disabled={loadingAddressData}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map((province) => (
                          <SelectItem key={province.code} value={province.name}>
                            {province.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="city_municipality">City/Municipality</Label>
                    <Select 
                      value={formData.address.city_municipality} 
                      onValueChange={async (value) => {
                        // Clear dependent fields first
                        setBarangays([]);
                        
                        setFormData({
                          ...formData, 
                          address: {
                            ...formData.address,
                            city_municipality: value,
                            barangay: ""
                          }
                        });
                        
                        // Then fetch new barangays
                        const selectedCity = cities.find(c => c.name === value);
                        if (selectedCity) {
                          await fetchBarangays(selectedCity.code);
                        }
                      }}
                      disabled={!formData.address.province}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select city/municipality" />
                      </SelectTrigger>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city.code} value={city.name}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="barangay">Barangay</Label>
                    <Select 
                      value={formData.address.barangay} 
                      onValueChange={(value) => {
                        setFormData({
                          ...formData, 
                          address: {
                            ...formData.address,
                            barangay: value
                          }
                        });
                      }}
                      disabled={!formData.address.city_municipality}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select barangay" />
                      </SelectTrigger>
                      <SelectContent>
                        {barangays.map((barangay) => (
                          <SelectItem key={barangay.code} value={barangay.name}>
                            {barangay.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      value={formData.address.street}
                      onChange={(e) => setFormData({
                        ...formData, 
                        address: {
                          ...formData.address,
                          street: e.target.value
                        }
                      })}
                      placeholder="Enter street address, building, etc."
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shift_type">Shift Type</Label>
                  <Select value={formData.shift_type} onValueChange={(value: ShiftType) => setFormData({...formData, shift_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day (7am-7pm)</SelectItem>
                      <SelectItem value="Night">Night (7pm-7am)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="shift_start_date">Shift Start Date *</Label>
                  <Input
                    id="shift_start_date"
                    type="date"
                    value={formData.shift_start_date}
                    min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      setFormData({
                        ...formData, 
                        shift_start_date: startDate,
                        shift_end_date: calculateShiftEndDate(startDate)
                      });
                    }}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="shift_end_date">Shift End Date</Label>
                <Input
                  id="shift_end_date"
                  type="date"
                  value={formData.shift_end_date}
                  readOnly
                  className="bg-muted"
                  placeholder="Automatically calculated (Start Date + 3 days)"
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={addingCaregiver}>
                  {addingCaregiver ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Caregiver"
                  )}
                </Button>
              </div>
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
                placeholder="Search caregivers by name or email..."
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Caregivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.length}</div>
            <p className="text-xs text-muted-foreground">
              Registered caregivers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.filter(c => c.shift_type === 'day').length}</div>
            <p className="text-xs text-muted-foreground">
              Day shift available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Duty</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.filter(c => c.shift_type === 'night').length}</div>
            <p className="text-xs text-muted-foreground">
              Night shift on duty
            </p>
          </CardContent>
        </Card>
      </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-300">Total Caregivers</CardTitle>
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-violet-900 dark:text-violet-100">{caregivers.length}</div>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Active staff members</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-orange-400/20 rounded-full -mr-16 -mt-16"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Day Shift</CardTitle>
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">{dayCaregivers}</div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">7am - 7pm shifts</p>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400/20 to-blue-400/20 rounded-full -mr-16 -mt-16"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Night Shift</CardTitle>
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg">
              <Clock className="h-5 w-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{nightCaregivers}</div>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">7pm - 7am shifts</p>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Search Section */}
      <div className="bg-card/50 backdrop-blur-sm border border-violet-200/50 rounded-xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              placeholder="Search caregivers by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-violet-200 focus:border-violet-500 focus:ring-violet-500/20"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-violet-200 text-violet-700 hover:bg-violet-50">
              <Clock className="h-4 w-4 mr-2" />
              Filter by Shift
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced Caregivers Table */}
      <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950 border-b border-violet-200/50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-violet-900 dark:text-violet-100">Caregivers Directory</CardTitle>
                <p className="text-sm text-violet-600 dark:text-violet-400 mt-1">
                  {filteredCaregivers.length} of {caregivers.length} caregivers
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-violet-50/50 dark:bg-violet-950/50 border-b border-violet-200/50">
                  <TableHead className="font-semibold text-violet-800 dark:text-violet-200">Name</TableHead>
                  <TableHead className="font-semibold text-violet-800 dark:text-violet-200">Age</TableHead>
                  <TableHead className="font-semibold text-violet-800 dark:text-violet-200">Contact</TableHead>
                  <TableHead className="font-semibold text-violet-800 dark:text-violet-200">Role</TableHead>
                  <TableHead className="font-semibold text-violet-800 dark:text-violet-200">Shift</TableHead>
                  <TableHead className="font-semibold text-violet-800 dark:text-violet-200 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredCaregivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="text-center py-16">
                      <div className="bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 rounded-full p-6 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                        <Users className="h-10 w-10 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {caregivers.length === 0 ? "No caregivers added yet" : "No caregivers match your search"}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                        {caregivers.length === 0 
                          ? "Start building your caregiver team by adding your first caregiver profile with their details and availability." 
                          : "Try adjusting your search terms or clearing filters to find the caregivers you're looking for."}
                      </p>
                      {caregivers.length === 0 && (
                        <Button 
                          onClick={() => setAddDialogOpen(true)}
                          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <Plus className="mr-2 h-5 w-5" />
                          Add Your First Caregiver
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCaregivers.map((caregiver) => (
                <TableRow 
                  key={caregiver.caregiver_id} 
                  className="hover:bg-violet-50/50 dark:hover:bg-violet-950/50 transition-colors duration-200 border-b border-violet-100/50"
                >
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {caregiver.first_name.charAt(0)}{caregiver.last_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {caregiver.first_name} {caregiver.middle_name ? `${caregiver.middle_name} ` : ''}{caregiver.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3 text-violet-500" />
                          {caregiver.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="text-sm font-medium">
                      {caregiver.birthday ? `${calculateAge(caregiver.birthday)} years` : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-violet-100 dark:bg-violet-800 rounded">
                        <Phone className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                      </div>
                      <span className="text-sm font-medium">{caregiver.contact_number}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 capitalize">
                      {caregiver.role}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge className={`${getShiftBadgeColor(caregiver.shift_type)} px-3 py-1 text-xs font-semibold rounded-full`}>
                      {caregiver.shift_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Dialog open={editingCaregiver?.caregiver_id === caregiver.caregiver_id} 
                              onOpenChange={(open) => !open && setEditingCaregiver(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(caregiver)}
                            className="border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300 transition-colors duration-200"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/50 dark:to-purple-950/50 border-violet-200/50">
                          <DialogHeader className="pb-4">
                            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                              Edit Caregiver
                            </DialogTitle>
                            <p className="text-muted-foreground">Update caregiver information</p>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="edit_first_name">First Name *</Label>
                                <Input
                                  id="edit_first_name"
                                  value={formData.first_name}
                                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit_last_name">Last Name *</Label>
                                <Input
                                  id="edit_last_name"
                                  value={formData.last_name}
                                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="edit_middle_name">Middle Name (Optional)</Label>
                                <Input
                                  id="edit_middle_name"
                                  value={formData.middle_name}
                                  onChange={(e) => setFormData({...formData, middle_name: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit_birthday">Birthday *</Label>
                                <Input
                                  id="edit_birthday"
                                  type="date"
                                  value={formData.birthday}
                                  onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                                />
                              </div>
                            </div>
                            
                            <div>
                              <Label htmlFor="edit_email">Email *</Label>
                              <Input
                                id="edit_email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="edit_contact_number">Contact Number *</Label>
                              <Input
                                id="edit_contact_number"
                                type="number"
                                value={formData.contact_number}
                                onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                              />
                            </div>

                            {/* Address Section */}
                            <div className="space-y-4">
                              <Label className="text-sm font-medium">Address (Optional - Baliwag, Bulacan & Pampanga only)</Label>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="edit_province">Province</Label>
                                  <Select 
                                    value={formData.address.province} 
                                    onValueChange={async (value) => {
                                      // Clear dependent fields first
                                      setCities([]);
                                      setBarangays([]);
                                      
                                      setFormData({
                                        ...formData, 
                                        address: {
                                          ...formData.address,
                                          province: value,
                                          city_municipality: "",
                                          barangay: ""
                                        }
                                      });
                                      
                                      // Then fetch new cities
                                      const selectedProvince = provinces.find(p => p.name === value);
                                      if (selectedProvince) {
                                        await fetchCities(selectedProvince.code);
                                      }
                                    }}
                                    disabled={loadingAddressData}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select province" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {provinces.map((province) => (
                                        <SelectItem key={province.code} value={province.name}>
                                          {province.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label htmlFor="edit_city_municipality">City/Municipality</Label>
                                  <Select 
                                    value={formData.address.city_municipality} 
                                    onValueChange={async (value) => {
                                      // Clear dependent fields first
                                      setBarangays([]);
                                      
                                      setFormData({
                                        ...formData, 
                                        address: {
                                          ...formData.address,
                                          city_municipality: value,
                                          barangay: ""
                                        }
                                      });
                                      
                                      // Then fetch new barangays
                                      const selectedCity = cities.find(c => c.name === value);
                                      if (selectedCity) {
                                        await fetchBarangays(selectedCity.code);
                                      }
                                    }}
                                    disabled={!formData.address.province}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select city/municipality" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {cities.map((city) => (
                                        <SelectItem key={city.code} value={city.name}>
                                          {city.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="edit_barangay">Barangay</Label>
                                  <Select 
                                    value={formData.address.barangay} 
                                    onValueChange={(value) => {
                                      setFormData({
                                        ...formData, 
                                        address: {
                                          ...formData.address,
                                          barangay: value
                                        }
                                      });
                                    }}
                                    disabled={!formData.address.city_municipality}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select barangay" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {barangays.map((barangay) => (
                                        <SelectItem key={barangay.code} value={barangay.name}>
                                          {barangay.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label htmlFor="edit_street">Street Address</Label>
                                  <Input
                                    id="edit_street"
                                    value={formData.address.street}
                                    onChange={(e) => setFormData({
                                      ...formData, 
                                      address: {
                                        ...formData.address,
                                        street: e.target.value
                                      }
                                    })}
                                    placeholder="Enter street address, building, etc."
                                  />
                                </div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="edit_shift_type">Shift Type</Label>
                                <Select value={formData.shift_type} onValueChange={(value: ShiftType) => setFormData({...formData, shift_type: value})}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Day">Day (7am-7pm)</SelectItem>
                                    <SelectItem value="Night">Night (7pm-7am)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor="edit_shift_start_date">Shift Start Date *</Label>
                                <Input
                                  id="edit_shift_start_date"
                                  type="date"
                                  value={formData.shift_start_date}
                                  min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                                  onChange={(e) => {
                                    const startDate = e.target.value;
                                    setFormData({
                                      ...formData, 
                                      shift_start_date: startDate,
                                      shift_end_date: calculateShiftEndDate(startDate)
                                    });
                                  }}
                                />
                              </div>
                            </div>
                            
                            <div>
                              <Label htmlFor="edit_shift_end_date">Shift End Date</Label>
                              <Input
                                id="edit_shift_end_date"
                                type="date"
                                value={formData.shift_end_date}
                                readOnly
                                className="bg-muted"
                                placeholder="Automatically calculated (Start Date + 3 days)"
                              />
                            </div>
                            
                            <Button 
                              onClick={handleUpdate} 
                              className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50" 
                              disabled={updatingCaregiver}
                            >
                              {updatingCaregiver ? (
                                <>
                                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                  Updating Caregiver...
                                </>
                              ) : (
                                <>
                                  <Edit className="mr-2 h-5 w-5" />
                                  Update Caregiver
                                </>
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors duration-200"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Caregiver</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {caregiver.first_name} {caregiver.last_name}? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(caregiver.caregiver_id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}