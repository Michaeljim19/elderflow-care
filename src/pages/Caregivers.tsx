import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Mail, Phone, Clock, Users, Loader2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      case "Night": return "bg-purple/10 text-purple border-purple/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caregiver Management</h1>
          <p className="text-muted-foreground mt-1">Manage healthcare staff and their assignments</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Caregiver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Caregiver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
              
              <Button onClick={handleAdd} className="w-full" disabled={addingCaregiver}>
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
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Caregivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Day Shift</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dayCaregivers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Night Shift</CardTitle>
            <Clock className="h-4 w-4 text-purple" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nightCaregivers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search caregivers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Caregivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Caregivers List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCaregivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-lg font-medium text-muted-foreground">
                        {caregivers.length === 0 ? "No caregivers added yet" : "No caregivers match your search"}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {caregivers.length === 0 
                          ? "Click 'Add Caregiver' to create your first caregiver record" 
                          : "Try adjusting your search terms"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCaregivers.map((caregiver) => (
                <TableRow key={caregiver.caregiver_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {caregiver.first_name} {caregiver.middle_name ? `${caregiver.middle_name} ` : ''}{caregiver.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {caregiver.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {caregiver.birthday ? `${calculateAge(caregiver.birthday)} years` : 'N/A'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3" />
                      {caregiver.contact_number}
                    </div>
                  </TableCell>
                  <TableCell>{caregiver.role}</TableCell>
                  <TableCell>
                    <Badge className={getShiftBadgeColor(caregiver.shift_type)}>
                      {caregiver.shift_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editingCaregiver?.caregiver_id === caregiver.caregiver_id} 
                              onOpenChange={(open) => !open && setEditingCaregiver(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(caregiver)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit Caregiver</DialogTitle>
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
                            
                            <Button onClick={handleUpdate} className="w-full" disabled={updatingCaregiver}>
                              {updatingCaregiver ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                "Update Caregiver"
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
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
        </CardContent>
      </Card>
    </div>
  );
}