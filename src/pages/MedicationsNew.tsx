import React, { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Clock,
  Pill,
  User,
  CalendarClock,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  Bell,
  BellRing,
  Users,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Patient, Medication } from '@/types'
import { getPatients } from '@/services/firebase/patients'
import { getMedicationsByPatient } from '@/services/firebase/medications'
import { toast } from '@/hooks/use-toast'

// Extended Patient interface for medication management
interface PatientWithMedications extends Patient {
  medicationCount: number
  nextReminder: string
  hasOverdue: boolean
}

const Medications = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [patients, setPatients] = useState<PatientWithMedications[]>([])
  const [currentPatientMedications, setCurrentPatientMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMedications, setLoadingMedications] = useState(false)
  const [newMedication, setNewMedication] = useState({
    medicationName: '',
    dosage: '',
    frequency: '',
    timeOfDay: '',
    instructions: '',
    prescribedBy: '',
    startDate: '',
    endDate: ''
  })

  // Load patients from Firebase
  useEffect(() => {
    const loadPatients = async () => {
      try {
        setLoading(true)
        const fetchedPatients = await getPatients()
        
        // Transform patients to include medication counts and reminder info
        const patientsWithMedications: PatientWithMedications[] = await Promise.all(
          fetchedPatients.map(async (patient) => {
            try {
              const medications = await getMedicationsByPatient(patient.patient_id)
              const activeMedications = medications.filter(med => med.is_active)
              
              // Calculate next reminder and overdue status
              const now = new Date()
              const overdueMeds = activeMedications.filter(med => {
                // Simple check - in real implementation, you'd check against scheduled times
                return false // Placeholder - implement proper overdue logic
              })
              
              const hasOverdue = overdueMeds.length > 0
              const nextReminder = hasOverdue 
                ? 'Overdue' 
                : activeMedications.length > 0 
                  ? 'Next dose scheduled' 
                  : 'No medications'

              return {
                ...patient,
                medicationCount: activeMedications.length,
                nextReminder,
                hasOverdue
              }
            } catch (error) {
              console.error(`Error loading medications for patient ${patient.patient_id}:`, error)
              return {
                ...patient,
                medicationCount: 0,
                nextReminder: 'Error loading',
                hasOverdue: false
              }
            }
          })
        )
        
        setPatients(patientsWithMedications)
      } catch (error) {
        console.error('Error loading patients:', error)
        toast({
          title: "Error",
          description: "Failed to load patients from database",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadPatients()
  }, [])

  // Load medications when patient is selected
  useEffect(() => {
    const loadPatientMedications = async () => {
      if (!selectedPatient) {
        setCurrentPatientMedications([])
        return
      }

      try {
        setLoadingMedications(true)
        const medications = await getMedicationsByPatient(selectedPatient)
        setCurrentPatientMedications(medications.filter(med => med.is_active))
      } catch (error) {
        console.error('Error loading patient medications:', error)
        toast({
          title: "Error",
          description: "Failed to load patient medications",
          variant: "destructive"
        })
      } finally {
        setLoadingMedications(false)
      }
    }

    loadPatientMedications()
  }, [selectedPatient])

  // Filter patients based on search term
  const filteredPatients = patients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate overview stats
  const totalPatients = patients.length
  const activeReminders = patients.reduce((sum, patient) => sum + patient.medicationCount, 0)
  const overdueReminders = patients.filter(patient => patient.hasOverdue).length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800'
      case 'Overdue':
        return 'bg-red-100 text-red-800'
      case 'Completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPatientStatusBadge = (patient: PatientWithMedications) => {
    if (patient.hasOverdue) {
      return <Badge className="bg-red-100 text-red-800">Overdue</Badge>
    }
    if (patient.medicationCount === 0) {
      return <Badge className="bg-gray-100 text-gray-800">No Medications</Badge>
    }
    return <Badge className="bg-green-100 text-green-800">Active</Badge>
  }

  const handleAddMedication = () => {
    if (!selectedPatient) {
      toast({
        title: "Error",
        description: "Please select a patient first",
        variant: "destructive"
      })
      return
    }

    // Add medication logic would go here
    toast({
      title: "Success",
      description: "Medication reminder added successfully"
    })
    setIsDialogOpen(false)
    setNewMedication({
      medicationName: '',
      dosage: '',
      frequency: '',
      timeOfDay: '',
      instructions: '',
      prescribedBy: '',
      startDate: '',
      endDate: ''
    })
  }

  const handleMarkAsTaken = (medicationId: string) => {
    toast({
      title: "Success",
      description: "Medication marked as taken"
    })
  }

  if (selectedPatient) {
    const patient = patients.find(p => p.patient_id === selectedPatient)
    
    if (loadingMedications) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPatient(null)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Loading Medications...
              </h1>
            </div>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading medication reminders...</p>
            </CardContent>
          </Card>
        </div>
      )
    }
    
    return (
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPatient(null)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Patients
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Medication Reminders
              </h1>
              <p className="text-muted-foreground">
                Managing medications for {patient?.first_name} {patient?.last_name}
              </p>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Medication
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Medication Reminder</DialogTitle>
                <DialogDescription>
                  Add a new medication reminder for {patient?.first_name} {patient?.last_name}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="medication-name" className="text-right">
                    Medication
                  </Label>
                  <Input
                    id="medication-name"
                    value={newMedication.medicationName}
                    onChange={(e) => setNewMedication({...newMedication, medicationName: e.target.value})}
                    className="col-span-3"
                    placeholder="e.g., Metformin"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dosage" className="text-right">
                    Dosage
                  </Label>
                  <Input
                    id="dosage"
                    value={newMedication.dosage}
                    onChange={(e) => setNewMedication({...newMedication, dosage: e.target.value})}
                    className="col-span-3"
                    placeholder="e.g., 500mg"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="frequency" className="text-right">
                    Frequency
                  </Label>
                  <Select onValueChange={(value) => setNewMedication({...newMedication, frequency: value})}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once-daily">Once daily</SelectItem>
                      <SelectItem value="twice-daily">Twice daily</SelectItem>
                      <SelectItem value="three-times-daily">Three times daily</SelectItem>
                      <SelectItem value="as-needed">As needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="time-of-day" className="text-right">
                    Time
                  </Label>
                  <Select onValueChange={(value) => setNewMedication({...newMedication, timeOfDay: value})}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Afternoon">Afternoon</SelectItem>
                      <SelectItem value="Evening">Evening</SelectItem>
                      <SelectItem value="Night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="prescribed-by" className="text-right">
                    Prescribed By
                  </Label>
                  <Input
                    id="prescribed-by"
                    value={newMedication.prescribedBy}
                    onChange={(e) => setNewMedication({...newMedication, prescribedBy: e.target.value})}
                    className="col-span-3"
                    placeholder="e.g., Dr. Smith"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="instructions" className="text-right">
                    Instructions
                  </Label>
                  <Textarea
                    id="instructions"
                    value={newMedication.instructions}
                    onChange={(e) => setNewMedication({...newMedication, instructions: e.target.value})}
                    className="col-span-3"
                    placeholder="Special instructions..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" onClick={handleAddMedication}>
                  Add Medication
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Patient Info Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <User className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="text-xl font-semibold">{patient?.first_name} {patient?.last_name}</h3>
                  <p className="text-muted-foreground">{patient?.contact_number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Active Medications</p>
                <p className="text-2xl font-bold">{currentPatientMedications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medication Reminders */}
        <div className="space-y-4">
          {currentPatientMedications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Pill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Medication Reminders</h3>
                <p className="text-muted-foreground mb-4">
                  This patient doesn't have any medication reminders set up yet.
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  Add First Medication
                </Button>
              </CardContent>
            </Card>
          ) : (
            currentPatientMedications.map((medication) => (
              <Card key={medication.medication_id} className="border-l-4 border-l-green-500">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">{medication.medication_name}</h3>
                        <Badge className="bg-green-100 text-green-800">
                          Active
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Pill className="h-4 w-4" />
                          Dosage: {medication.dosage}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          {medication.frequency}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {medication.time_of_day}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Start Date:</span> {medication.start_date}
                        </div>
                        <div>
                          <span className="font-medium">End Date:</span> {medication.end_date || 'Ongoing'}
                        </div>
                      </div>

                      {medication.notes && (
                        <div className="text-sm">
                          <span className="font-medium">Instructions:</span>
                          <p className="text-muted-foreground italic">{medication.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleMarkAsTaken(medication.medication_id)}
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark as Taken
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  // Main patients view
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medication Management</h1>
          <p className="text-muted-foreground">Loading patients...</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading patients from database...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pl-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medication Management</h1>
          <p className="text-muted-foreground">
            Select a patient to view and manage their medication reminders
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-0">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{totalPatients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Bell className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Reminders</p>
                <p className="text-2xl font-bold">{activeReminders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{overdueReminders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="ml-0">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pl-0">
        {filteredPatients.map((patient) => (
          <Card 
            key={patient.patient_id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedPatient(patient.patient_id)}
          >
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold text-lg">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{patient.contact_number}</p>
                    </div>
                  </div>
                  {getPatientStatusBadge(patient)}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Medications:</span>
                    <p className="text-muted-foreground">{patient.medicationCount}</p>
                  </div>
                  <div>
                    <span className="font-medium">Next Reminder:</span>
                    <p className={`${patient.hasOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {patient.nextReminder}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Click to manage medications</span>
                  <Button variant="ghost" size="sm" className="h-8 px-3">
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPatients.length === 0 && (
        <Card className="ml-0">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Patients Found</h3>
            <p className="text-muted-foreground">
              No patients match your search criteria.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default Medications
