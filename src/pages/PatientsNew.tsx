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
  Loader2
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Patient, Caregiver } from "@/types"
import { getPatients, addPatient } from "@/services/firebase/patients"
import { getCaregivers } from "@/services/firebase/caregivers"
import { seedDatabase } from "@/services/firebase/seedData"

const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [addingPatient, setAddingPatient] = useState(false)
  const { toast } = useToast()

  // Form state for adding new patient
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    birthdate: "",
    gender: undefined as "Male" | "Female" | "Other" | undefined,
    contact_number: "",
    address: "",
    assigned_caregiver_id: ""
  })

  // Load patients and caregivers on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [patientsData, caregiversData] = await Promise.all([
          getPatients(),
          getCaregivers()
        ])
        setPatients(patientsData)
        setCaregivers(caregiversData)
        console.log("Loaded caregivers:", caregiversData)
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

  const handleSeedDatabase = async () => {
    try {
      setLoading(true)
      await seedDatabase()
      // Reload data after seeding
      const [patientsData, caregiversData] = await Promise.all([
        getPatients(),
        getCaregivers()
      ])
      setPatients(patientsData)
      setCaregivers(caregiversData)
      toast({
        title: "Success",
        description: "Database seeded with sample data successfully!",
      })
    } catch (error) {
      console.error("Error seeding database:", error)
      toast({
        title: "Error",
        description: "Failed to seed database. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddPatient = async () => {
    if (!formData.first_name || !formData.last_name || !formData.birthdate || !formData.gender) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (First Name, Last Name, Birth Date, Gender).",
        variant: "destructive"
      })
      return
    }

    try {
      setAddingPatient(true)
      
      const newPatientData = {
        ...formData,
        gender: formData.gender as "Male" | "Female" | "Other",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      console.log("Patient data being saved:", newPatientData)
      const patientId = await addPatient(newPatientData)
      
      // Refresh patients list
      const updatedPatients = await getPatients()
      setPatients(updatedPatients)
      
      // Reset form and close dialog
      setFormData({
        first_name: "",
        last_name: "",
        birthdate: "",
        gender: undefined,
        contact_number: "",
        address: "",
        assigned_caregiver_id: ""
      })
      setIsAddDialogOpen(false)
      
      toast({
        title: "Success",
        description: `Patient ${formData.first_name} ${formData.last_name} has been added successfully.`
      })
      
    } catch (error) {
      console.error("Error adding patient:", error)
      toast({
        title: "Error",
        description: "Failed to add patient. Please check your Firebase configuration and try again.",
        variant: "destructive"
      })
    } finally {
      setAddingPatient(false)
    }
  }

  const filteredPatients = patients.filter(patient =>
    patient.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.contact_number.includes(searchTerm)
  )

  const getCaregiverName = (caregiverId: string) => {
    if (!caregiverId) return "Unassigned"
    const caregiver = caregivers.find(c => c.caregiver_id === caregiverId)
    return caregiver ? `${caregiver.first_name} ${caregiver.last_name}` : "Unassigned"
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
          <p className="text-muted-foreground">Manage elderly patient records and information</p>
        </div>
        <div className="flex gap-2">
          {caregivers.length === 0 && (
            <Button variant="outline" className="gap-2" onClick={handleSeedDatabase}>
              <Plus className="h-4 w-4" />
              Create Sample Data
            </Button>
          )}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Patient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
                <DialogDescription>
                  Enter the patient's information to create a new record.
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
                    <Label htmlFor="birthdate">Birth Date *</Label>
                    <Input 
                      id="birthdate" 
                      type="date"
                      value={formData.birthdate}
                      onChange={(e) => handleInputChange("birthdate", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">Gender *</Label>
                    <Select value={formData.gender || ""} onValueChange={(value) => handleInputChange("gender", value as "Male" | "Female" | "Other")}>
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
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    placeholder="Enter address"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="caregiver">Assigned Caregiver</Label>
                  <Select value={formData.assigned_caregiver_id || "unassigned"} onValueChange={(value) => handleInputChange("assigned_caregiver_id", value === "unassigned" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select caregiver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">No caregiver assigned</SelectItem>
                      {caregivers.filter(caregiver => caregiver.caregiver_id && caregiver.caregiver_id.trim() !== '').map((caregiver) => (
                        <SelectItem key={caregiver.caregiver_id} value={caregiver.caregiver_id}>
                          {caregiver.first_name} {caregiver.last_name} - {caregiver.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
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
                placeholder="Search patients by name or phone..."
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
            <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patients.filter(p => p.is_active).length}</div>
            <p className="text-xs text-muted-foreground">
              Currently receiving care
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Caregivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {patients.filter(p => p.assigned_caregiver_id).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Have assigned caregivers
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
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {patient.address || "No address"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getStatusColor(patient.is_active)}>
                          {patient.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Caregiver: {getCaregiverName(patient.assigned_caregiver_id)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
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

export default Patients
