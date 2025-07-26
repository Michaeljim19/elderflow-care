import { useState } from "react"
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
  Calendar
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

// Mock data
const mockPatients = [
  {
    id: 1,
    name: "Mary Johnson",
    age: 78,
    gender: "Female",
    phone: "(555) 123-4567",
    address: "123 Oak Street, Springfield",
    assignedCaregiver: "Sarah Wilson",
    medicalConditions: ["Diabetes", "Hypertension"],
    emergencyContact: "John Johnson (Son)",
    lastVisit: "2024-01-15",
    status: "Active"
  },
  {
    id: 2,
    name: "Robert Smith",
    age: 82,
    gender: "Male",
    phone: "(555) 234-5678",
    address: "456 Pine Avenue, Springfield",
    assignedCaregiver: "Michael Chen",
    medicalConditions: ["Heart Disease", "Arthritis"],
    emergencyContact: "Lisa Smith (Daughter)",
    lastVisit: "2024-01-20",
    status: "Active"
  },
  {
    id: 3,
    name: "Eleanor Davis",
    age: 75,
    gender: "Female",
    phone: "(555) 345-6789",
    address: "789 Maple Drive, Springfield",
    assignedCaregiver: "Sarah Wilson",
    medicalConditions: ["Osteoporosis"],
    emergencyContact: "David Davis (Son)",
    lastVisit: "2024-01-18",
    status: "Active"
  }
]

const Patients = () => {
  const [patients] = useState(mockPatients)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<typeof mockPatients[0] | null>(null)

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.assignedCaregiver.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-medical-success/10 text-medical-success"
      case "Inactive": return "bg-muted text-muted-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Patient Management</h1>
          <p className="text-muted-foreground">Manage elderly patient records and information</p>
        </div>
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
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="Enter first name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Enter last name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="age">Age</Label>
                  <Input id="age" type="number" placeholder="Enter age" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="Enter phone number" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="Enter full address" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="caregiver">Assigned Caregiver</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select caregiver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sarah">Sarah Wilson</SelectItem>
                    <SelectItem value="michael">Michael Chen</SelectItem>
                    <SelectItem value="emma">Emma Rodriguez</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="emergency">Emergency Contact</Label>
                <Input id="emergency" placeholder="Enter emergency contact" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="medical" onClick={() => setIsAddDialogOpen(false)}>
                Add Patient
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients by name or caregiver..."
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

      {/* Patient Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{patients.length}</div>
            <p className="text-xs text-muted-foreground">Registered in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
            <Users className="h-4 w-4 text-medical-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-success">
              {patients.filter(p => p.status === "Active").length}
            </div>
            <p className="text-xs text-muted-foreground">Currently under care</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Age</CardTitle>
            <Calendar className="h-4 w-4 text-medical-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-info">
              {Math.round(patients.reduce((sum, p) => sum + p.age, 0) / patients.length)}
            </div>
            <p className="text-xs text-muted-foreground">Years old</p>
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
            Complete list of registered patients with their details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredPatients.map((patient) => (
              <Card key={patient.id} className="border-l-4 border-l-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{patient.name}</h3>
                        <Badge className={getStatusColor(patient.status)}>
                          {patient.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Age: {patient.age} • {patient.gender}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {patient.phone}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {patient.address}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="font-medium">Caregiver:</span> {patient.assignedCaregiver}
                        </div>
                        <div>
                          <span className="font-medium">Emergency:</span> {patient.emergencyContact}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {patient.medicalConditions.map((condition, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                          <DialogHeader>
                            <DialogTitle>{patient.name} - Patient Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Age:</span> {patient.age}
                              </div>
                              <div>
                                <span className="font-medium">Gender:</span> {patient.gender}
                              </div>
                              <div>
                                <span className="font-medium">Phone:</span> {patient.phone}
                              </div>
                              <div>
                                <span className="font-medium">Last Visit:</span> {patient.lastVisit}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Address:</span>
                              <p className="text-muted-foreground">{patient.address}</p>
                            </div>
                            <div>
                              <span className="font-medium">Medical Conditions:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {patient.medicalConditions.map((condition, index) => (
                                  <Badge key={index} variant="secondary">
                                    {condition}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-medical-critical">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Patients