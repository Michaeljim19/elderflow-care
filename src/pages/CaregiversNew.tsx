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
import { Caregiver } from "@/types"
import { getCaregivers, addCaregiver } from "@/services/firebase/caregivers"

const Caregivers = () => {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [addingCaregiver, setAddingCaregiver] = useState(false)
  const { toast } = useToast()

  // Form state for adding new caregiver
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
    shift_type: "" as "Day" | "Night" | "Rotating" | "On-call" | "",
    role: "" as "nurse" | "caregiver" | "admin" | "doctor" | "family" | ""
  })

  // Load caregivers on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const caregiversData = await getCaregivers()
        setCaregivers(caregiversData)
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "Failed to load caregivers data. Please try again.",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [toast])

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

  const handleAddCaregiver = async () => {
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.contact_number || !formData.shift_type) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    try {
      setAddingCaregiver(true)
      
      const newCaregiverData = {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        birthday: formData.birthday,
        email: formData.email,
        contact_number: parseInt(formData.contact_number),
        address: formData.address,
        shift_type: formData.shift_type as "Day" | "Night" | "Rotating" | "On-call",
        role: formData.role as "nurse" | "caregiver" | "admin" | "doctor" | "family"
      }

      await addCaregiver(newCaregiverData)
      
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
        shift_type: "",
        role: ""
      })
      setIsAddDialogOpen(false)
      
      toast({
        title: "Success",
        description: `Caregiver ${formData.first_name} ${formData.last_name} has been added successfully.`
      })
      
    } catch (error) {
      console.error("Error adding caregiver:", error)
      toast({
        title: "Error",
        description: "Failed to add caregiver. Please try again.",
        variant: "destructive"
      })
    } finally {
      setAddingCaregiver(false)
    }
  }

  const filteredCaregivers = caregivers.filter(caregiver =>
    caregiver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caregiver.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caregiver.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getShiftColor = (shiftType: string) => {
    switch(shiftType) {
      case 'Day': return "bg-blue-100 text-blue-800"
      case 'Night': return "bg-purple-100 text-purple-800"
      case 'Rotating': return "bg-green-100 text-green-800"
      case 'On-call': return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

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
    )
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
              <Button className="gap-2">
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
                    <Label htmlFor="birthday">Birthday</Label>
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
                    placeholder="Enter contact number"
                    value={formData.contact_number}
                    onChange={(e) => handleInputChange("contact_number", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="shiftType">Shift Type *</Label>
                    <Select value={formData.shift_type} onValueChange={(value) => handleInputChange("shift_type", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day">Day</SelectItem>
                        <SelectItem value="Night">Night</SelectItem>
                        <SelectItem value="Rotating">Rotating</SelectItem>
                        <SelectItem value="On-call">On-call</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nurse">Nurse</SelectItem>
                        <SelectItem value="caregiver">Caregiver</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="family">Family</SelectItem>
                      </SelectContent>
                    </Select>
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
                    "Add Caregiver"
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
            <CardTitle className="text-sm font-medium">Day Shift</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.filter(c => c.shift_type === 'Day').length}</div>
            <p className="text-xs text-muted-foreground">
              Day shift available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Night Shift</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.filter(c => c.shift_type === 'Night').length}</div>
            <p className="text-xs text-muted-foreground">
              Night shift on duty
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Caregiver List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Caregiver Records
          </CardTitle>
          <CardDescription>
            All registered caregivers in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCaregivers.length === 0 ? (
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
          ) : (
            <div className="space-y-4">
              {filteredCaregivers.map((caregiver) => (
                <div
                  key={caregiver.caregiver_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {caregiver.first_name} {caregiver.last_name}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {caregiver.contact_number || "No phone"}
                        </span>
                        <span>{caregiver.email}</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {caregiver.address?.city_municipality || "No address"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getShiftColor(caregiver.shift_type)}>
                          {caregiver.shift_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          Role: {caregiver.role || "Not specified"}
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

export default Caregivers
