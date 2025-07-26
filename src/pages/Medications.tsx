import { useState } from "react"
import { 
  Pill, 
  Plus, 
  Search, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  User,
  Edit,
  Trash2
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
import { Textarea } from "@/components/ui/textarea"

// Mock data
const mockMedications = [
  {
    id: 1,
    patientName: "Mary Johnson",
    medicationName: "Metformin",
    dosage: "500mg",
    frequency: "Twice daily",
    times: ["8:00 AM", "8:00 PM"],
    instructions: "Take with food",
    prescribedBy: "Dr. Smith",
    startDate: "2024-01-01",
    endDate: "2024-06-30",
    status: "Active",
    nextDose: "8:00 PM Today"
  },
  {
    id: 2,
    patientName: "Robert Smith",
    medicationName: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily",
    times: ["9:00 AM"],
    instructions: "Take on empty stomach",
    prescribedBy: "Dr. Johnson",
    startDate: "2024-01-15",
    endDate: "2024-12-31",
    status: "Active",
    nextDose: "9:00 AM Tomorrow"
  },
  {
    id: 3,
    patientName: "Eleanor Davis",
    medicationName: "Vitamin D3",
    dosage: "1000 IU",
    frequency: "Once daily",
    times: ["12:00 PM"],
    instructions: "Take with largest meal",
    prescribedBy: "Dr. Brown",
    startDate: "2024-01-10",
    endDate: "2024-12-31",
    status: "Active",
    nextDose: "12:00 PM Today"
  }
]

const Medications = () => {
  const [medications] = useState(mockMedications)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredMedications = medications.filter(med =>
    med.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    med.medicationName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-medical-success/10 text-medical-success"
      case "Completed": return "bg-muted text-muted-foreground"
      case "Missed": return "bg-medical-critical/10 text-medical-critical"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getFrequencyIcon = (frequency: string) => {
    if (frequency.includes("Once")) return <Clock className="h-4 w-4" />
    if (frequency.includes("Twice")) return <Clock className="h-4 w-4" />
    return <Clock className="h-4 w-4" />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Medication Management</h1>
          <p className="text-muted-foreground">Track and manage patient medication schedules</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Medication
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Medication</DialogTitle>
              <DialogDescription>
                Enter medication details and schedule information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="patient">Select Patient</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose patient" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mary">Mary Johnson</SelectItem>
                    <SelectItem value="robert">Robert Smith</SelectItem>
                    <SelectItem value="eleanor">Eleanor Davis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="medication">Medication Name</Label>
                  <Input id="medication" placeholder="Enter medication name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dosage">Dosage</Label>
                  <Input id="dosage" placeholder="e.g., 500mg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once daily</SelectItem>
                      <SelectItem value="twice">Twice daily</SelectItem>
                      <SelectItem value="three">Three times daily</SelectItem>
                      <SelectItem value="four">Four times daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="prescriber">Prescribed By</Label>
                  <Input id="prescriber" placeholder="Doctor name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="instructions">Special Instructions</Label>
                <Textarea 
                  id="instructions" 
                  placeholder="Enter any special instructions for taking this medication"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="medical" onClick={() => setIsAddDialogOpen(false)}>
                Add Medication
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search medications by patient or medication name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Medication Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Medications</CardTitle>
            <Pill className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{medications.length}</div>
            <p className="text-xs text-muted-foreground">Currently prescribed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-medical-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-warning">8</div>
            <p className="text-xs text-muted-foreground">Scheduled doses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-medical-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-success">6</div>
            <p className="text-xs text-muted-foreground">Taken today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed</CardTitle>
            <AlertTriangle className="h-4 w-4 text-medical-critical" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-critical">1</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Today's Medication Schedule
          </CardTitle>
          <CardDescription>
            Upcoming medication doses for today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Mock today's schedule */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-medical-warning/10 border border-medical-warning/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-medical-warning/20">
                  <Clock className="h-4 w-4 text-medical-warning" />
                </div>
                <div>
                  <p className="font-medium">Mary Johnson - Metformin 500mg</p>
                  <p className="text-sm text-muted-foreground">Due at 8:00 PM (in 2 hours)</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Mark as Taken</Button>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-medical-info/10 border border-medical-info/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-medical-info/20">
                  <Clock className="h-4 w-4 text-medical-info" />
                </div>
                <div>
                  <p className="font-medium">Eleanor Davis - Vitamin D3 1000 IU</p>
                  <p className="text-sm text-muted-foreground">Due at 12:00 PM (4 hours ago)</p>
                </div>
              </div>
              <Button variant="warning" size="sm">Overdue</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Medication List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            All Medications
          </CardTitle>
          <CardDescription>
            Complete list of patient medications and schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredMedications.map((medication) => (
              <Card key={medication.id} className="border-l-4 border-l-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{medication.medicationName}</h3>
                        <Badge className={getStatusColor(medication.status)}>
                          {medication.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          Patient: {medication.patientName}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Pill className="h-4 w-4" />
                          Dosage: {medication.dosage}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {getFrequencyIcon(medication.frequency)}
                          {medication.frequency}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Times:</span> {medication.times.join(", ")}
                        </div>
                        <div>
                          <span className="font-medium">Next Dose:</span> {medication.nextDose}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Prescribed by:</span> {medication.prescribedBy}
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span> {medication.startDate} to {medication.endDate}
                        </div>
                      </div>

                      {medication.instructions && (
                        <div className="text-sm">
                          <span className="font-medium">Instructions:</span>
                          <p className="text-muted-foreground italic">{medication.instructions}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
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

export default Medications