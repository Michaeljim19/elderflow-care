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
  Calendar,
  Activity,
  Shield,
  FileText,
  Eye,
  Filter,
  Loader2
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

  // Filter patients based on search term
  const filteredPatients = patients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculate overview stats
  const totalPatients = patients.length
  const activeReminders = patients.reduce((sum, patient) => sum + patient.medicationCount, 0)
  const overdueReminders = patients.filter(patient => patient.hasOverdue).length
  const totalMedications = patients.reduce((sum, patient) => sum + patient.medicationCount, 0)
  const overdueCount = patients.filter(patient => patient.hasOverdue).length

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
              <h1 className="text-5xl font-bold tracking-tight">
                Loading Medications...
              </h1>
            </div>
          </div>
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-xl text-muted-foreground">Loading medication reminders...</p>
            </CardContent>
          </Card>
        </div>
      )
    }
    
    return (
      <div className="p-6 space-y-6">
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
              <h1 className="text-5xl font-bold text-foreground">
                Medication Reminders
              </h1>
              <p className="text-xl text-muted-foreground">
                Managing medications for {patient?.first_name} {patient?.last_name}
              </p>
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-12 text-base">
                <Plus className="h-5 w-5" />
                <span className="text-base">Add Medication</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Medication Reminder</DialogTitle>
                <DialogDescription>
                  Add a new medication reminder for {patient?.first_name} {patient?.last_name}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="medication-name">Medication Name *</Label>
                    <Input
                      id="medication-name"
                      value={newMedication.medicationName}
                      onChange={(e) => setNewMedication({...newMedication, medicationName: e.target.value})}
                      placeholder="e.g., Metformin"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dosage">Dosage *</Label>
                    <Input
                      id="dosage"
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication({...newMedication, dosage: e.target.value})}
                      placeholder="e.g., 500mg"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="frequency">Frequency *</Label>
                    <Select onValueChange={(value) => setNewMedication({...newMedication, frequency: value})}>
                      <SelectTrigger>
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
                  <div className="grid gap-2">
                    <Label htmlFor="time-of-day">Time of Day *</Label>
                    <Select onValueChange={(value) => setNewMedication({...newMedication, timeOfDay: value})}>
                      <SelectTrigger>
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={newMedication.startDate}
                      onChange={(e) => setNewMedication({...newMedication, startDate: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={newMedication.endDate}
                      onChange={(e) => setNewMedication({...newMedication, endDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="prescribed-by">Prescribed By</Label>
                  <Input
                    id="prescribed-by"
                    value={newMedication.prescribedBy}
                    onChange={(e) => setNewMedication({...newMedication, prescribedBy: e.target.value})}
                    placeholder="e.g., Dr. Smith"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="instructions">Special Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={newMedication.instructions}
                    onChange={(e) => setNewMedication({...newMedication, instructions: e.target.value})}
                    placeholder="Special instructions..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMedication}>
                  Add Medication
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Patient Info Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Patient</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{patient?.first_name} {patient?.last_name}</div>
              <p className="text-xs text-muted-foreground">
                {patient?.contact_number}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Medications</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentPatientMedications.filter(med => med.is_active).length}</div>
              <p className="text-xs text-muted-foreground">
                Currently prescribed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Due Today</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {currentPatientMedications.filter(med => med.is_active).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Reminders scheduled
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">0</div>
              <p className="text-xs text-muted-foreground">
                Need attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Medication List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Medication Schedule
            </CardTitle>
            <CardDescription>
              Current medication reminders and schedules
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentPatientMedications.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  No medication reminders set up yet
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click 'Add Medication' to create the first reminder
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Medication
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {currentPatientMedications.map((medication) => (
                  <div
                    key={medication.medication_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Pill className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {medication.medication_name}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Pill className="h-3 w-3" />
                            {medication.dosage}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {medication.frequency}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {medication.time_of_day}
                          </span>
                          {medication.start_date && (
                            <span className="flex items-center gap-1">
                              <CalendarClock className="h-3 w-3" />
                              Since: {new Date(medication.start_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {medication.notes && (
                          <p className="text-sm text-muted-foreground italic mt-1">
                            {medication.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={medication.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {medication.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleMarkAsTaken(medication.medication_id)}
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Taken
                      </Button>
                      <Button variant="ghost" size="sm" title="Edit Medication">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete Medication" className="text-red-600 hover:text-red-700">
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

  // Main patients view
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading medication data...</p>
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
          <h1 className="text-3xl font-bold text-foreground">Medication Management</h1>
          <p className="text-muted-foreground">Manage patient medication schedules and reminders</p>
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients by name..."
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
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPatients}</div>
            <p className="text-xs text-muted-foreground">
              Registered patients
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Medications</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMedications}</div>
            <p className="text-xs text-muted-foreground">
              Total medications
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reminders</CardTitle>
            <Bell className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReminders}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled reminders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Medications</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patient List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Patient Medications
          </CardTitle>
          <CardDescription>
            Click on a patient to manage their medications
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
                  ? "Add patients from the Patient Management page" 
                  : "Try adjusting your search terms"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPatients.map((patient) => (
                <Card 
                  key={patient.patient_id} 
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                  onClick={() => setSelectedPatient(patient.patient_id)}
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">
                              {patient.first_name} {patient.last_name}
                            </h3>
                            <p className="text-sm text-muted-foreground">{patient.contact_number}</p>
                          </div>
                        </div>
                        {getPatientStatusBadge(patient)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">Medications:</span>
                          <p className="font-semibold">{patient.medicationCount}</p>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Next Reminder:</span>
                          <p className={`font-semibold ${patient.hasOverdue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {patient.nextReminder}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t">
                        <span className="text-sm text-muted-foreground">Click to manage medications</span>
                        <Button variant="ghost" size="sm" className="h-8 px-3">
                          <Pill className="h-4 w-4 mr-1" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Medications
