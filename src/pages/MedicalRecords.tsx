import { useState, useEffect } from "react"
import { 
  FileText, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  User,
  Loader2,
  Heart,
  Activity,
  ArrowLeft,
  Plus
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Patient, MedicalHistory } from "@/types"
import { getPatients } from "@/services/firebase/patients"
import { getMedicalHistoryByPatient, getMedicalHistories, addMedicalHistory, updateMedicalHistory } from "@/services/firebase/medicalHistory"

const MedicalRecords = () => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [allMedicalHistories, setAllMedicalHistories] = useState<MedicalHistory[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientMedicalHistory, setPatientMedicalHistory] = useState<MedicalHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPatientHistory, setLoadingPatientHistory] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddMedicalRecordOpen, setIsAddMedicalRecordOpen] = useState(false)
  const [viewingMedicalRecord, setViewingMedicalRecord] = useState<any | null>(null)
  const [editingMedicalRecord, setEditingMedicalRecord] = useState<any | null>(null)
  const [isEditMedicalDialogOpen, setIsEditMedicalDialogOpen] = useState(false)
  const [medicalEditForm, setMedicalEditForm] = useState({
    condition: "",
    description: "",
    date_diagnosed: "",
    treatment: "",
    severity: "",
    status: "",
    medications: "",
    notes: ""
  })
  const [newMedicalRecord, setNewMedicalRecord] = useState({
    condition: "",
    date_diagnosed: "",
    current_medical_conditions: [] as string[],
    past_medical_history: [] as string[],
    current_medications: [] as string[],
    known_allergies: [] as string[],
    notes: ""
  })
  const { toast } = useToast()

  // Load patients and medical histories on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [patientsData, medicalHistoriesData] = await Promise.all([
          getPatients(),
          getMedicalHistories()
        ])
        setPatients(patientsData)
        setAllMedicalHistories(medicalHistoriesData)
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "Failed to load data. Please try again.",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [toast])

  // Function to reload medical histories data
  const reloadMedicalHistories = async () => {
    try {
      const medicalHistoriesData = await getMedicalHistories()
      setAllMedicalHistories(medicalHistoriesData)
    } catch (error) {
      console.error("Error reloading medical histories:", error)
    }
  }

  // Reload data when window gains focus (user comes back to the page)
  useEffect(() => {
    const handleFocus = () => {
      reloadMedicalHistories()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Load medical history for selected patient
  const handlePatientSelect = async (patient: Patient) => {
    try {
      setLoadingPatientHistory(true)
      setSelectedPatient(patient)
      const history = await getMedicalHistoryByPatient(patient.patient_id)
      setPatientMedicalHistory(history)
    } catch (error) {
      console.error("Error loading patient medical history:", error)
      toast({
        title: "Error",
        description: "Failed to load patient medical history. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoadingPatientHistory(false)
    }
  }

  // Go back to patient list
  const handleBackToPatients = () => {
    setSelectedPatient(null)
    setPatientMedicalHistory([])
  }

  // Handler to view medical history record details
  const handleViewMedicalRecord = (record: any) => {
    console.log('View button clicked', record)
    setViewingMedicalRecord(record)
  }

  // Handler to close medical record view
  const closeViewMedicalRecord = () => {
    setViewingMedicalRecord(null)
  }

  // Handler to edit medical history record
  const handleEditMedicalRecord = (record: any) => {
    console.log('Edit button clicked', record)
    setEditingMedicalRecord(record)
    setMedicalEditForm({
      condition: record.condition || '',
      description: record.description || '',
      date_diagnosed: record.date_diagnosed ? 
        (typeof record.date_diagnosed === 'string' 
          ? record.date_diagnosed.split('T')[0]
          : record.date_diagnosed.toDate ? record.date_diagnosed.toDate().toISOString().split('T')[0]
          : new Date(record.date_diagnosed).toISOString().split('T')[0]
        ) : '',
      treatment: record.treatment || '',
      severity: record.severity || '',
      status: record.status || '',
      medications: record.medications || record.current_medications?.join(', ') || '',
      notes: record.notes || ''
    })
    setIsEditMedicalDialogOpen(true)
  }

  // Handler to update medical history record
  const handleUpdateMedicalRecord = async () => {
    if (!editingMedicalRecord) return

    try {
      const updatedRecord = {
        ...editingMedicalRecord,
        condition: medicalEditForm.condition,
        description: medicalEditForm.description,
        date_diagnosed: medicalEditForm.date_diagnosed,
        treatment: medicalEditForm.treatment,
        severity: medicalEditForm.severity,
        status: medicalEditForm.status,
        medications: medicalEditForm.medications,
        notes: medicalEditForm.notes
      }

      await updateMedicalHistory(editingMedicalRecord.history_id, updatedRecord)
      
      // Refresh patient medical history
      if (selectedPatient) {
        const updatedHistory = await getMedicalHistoryByPatient(selectedPatient.patient_id)
        setPatientMedicalHistory(updatedHistory)
      }
      
      setIsEditMedicalDialogOpen(false)
      setEditingMedicalRecord(null)
      
      toast({
        title: "Success",
        description: "Medical record updated successfully"
      })
    } catch (error) {
      console.error("Error updating medical record:", error)
      toast({
        title: "Error",
        description: "Failed to update medical record",
        variant: "destructive"
      })
    }
  }

  // Handler to delete medical history record
  const handleDeleteMedicalRecord = async (record: any) => {
    console.log('Delete button clicked', record)
    if (window.confirm('Are you sure you want to delete this medical record?')) {
      try {
        // Delete logic would go here
        console.log('Deleting medical record:', record.history_id)
        // Refresh medical history after deletion
        if (selectedPatient) {
          const records = await getMedicalHistoryByPatient(selectedPatient.patient_id)
          setPatientMedicalHistory(records)
        }
        toast({
          title: "Success",
          description: "Medical record deleted successfully"
        })
      } catch (error) {
        console.error('Error deleting medical record:', error)
        toast({
          title: "Error",
          description: "Failed to delete medical record",
          variant: "destructive"
        })
      }
    }
  }

  const formatDate = (dateValue: string | any) => {
    if (!dateValue) return 'N/A'
    
    // Handle Firebase Timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toLocaleDateString()
    }
    
    // Handle regular date string
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toLocaleDateString()
    }
    
    // Handle Date object
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString()
    }
    
    return 'N/A'
  }

  // Get severity badge color
  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'mild': return 'bg-green-100 text-green-800 border-green-200'
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'severe': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200'
      case 'chronic': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'under treatment': return 'bg-orange-100 text-orange-800 border-orange-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Handle adding new medical record
  const handleAddMedicalRecord = async () => {
    if (!selectedPatient) return

    try {
      const medicalHistoryData = {
        patient_id: selectedPatient.patient_id,
        condition: newMedicalRecord.condition,
        date_diagnosed: newMedicalRecord.date_diagnosed,
        current_medical_conditions: newMedicalRecord.current_medical_conditions,
        past_medical_history: newMedicalRecord.past_medical_history,
        current_medications: newMedicalRecord.current_medications,
        known_allergies: newMedicalRecord.known_allergies,
        notes: newMedicalRecord.notes,
        severity: "moderate", // Default severity
        status: "active", // Default status
        treatment: "", // Default empty treatment
        doctor: "", // Default empty doctor
        attachments: [] // Default empty attachments
      }

      await addMedicalHistory(medicalHistoryData)
      
      // Reset form
      setNewMedicalRecord({
        condition: "",
        date_diagnosed: "",
        current_medical_conditions: [],
        past_medical_history: [],
        current_medications: [],
        known_allergies: [],
        notes: ""
      })
      
      // Close dialog
      setIsAddMedicalRecordOpen(false)
      
      // Refresh patient medical history
      if (selectedPatient) {
        const updatedHistory = await getMedicalHistoryByPatient(selectedPatient.patient_id)
        setPatientMedicalHistory(updatedHistory)
      }
      
      toast({
        title: "Success",
        description: "Medical record has been added successfully."
      })
    } catch (error) {
      console.error("Error adding medical record:", error)
      toast({
        title: "Error",
        description: "Failed to add medical record. Please try again.",
        variant: "destructive"
      })
    }
  }

  // Add missing ArrowLeft import
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Filter patients
  const filteredPatients = patients.filter(patient => 
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.contact_number?.toString().includes(searchTerm)
  )



  return (
    <div className="space-y-6 p-6">
      {!selectedPatient ? (
        /* Patient List View */
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-foreground">Medical Records</h1>
              <p className="text-xl text-muted-foreground">Select a patient to view their medical history records</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <User className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{patients.length}</div>
                <p className="text-xs text-muted-foreground">
                  Registered patients
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patients with Records</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(allMedicalHistories.map(h => h.patient_id)).size}
                </div>
                <p className="text-xs text-muted-foreground">
                  Have medical records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Conditions</CardTitle>
                <Heart className="h-4 w-4 text-red-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {allMedicalHistories.filter(h => h.status?.toLowerCase() === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all patients
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Records</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {allMedicalHistories.filter(h => {
                    const recordDate = new Date(h.date_diagnosed)
                    const weekAgo = new Date()
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    return recordDate >= weekAgo
                  }).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Diagnosed this week
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients by name or contact number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Patient List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patients
              </CardTitle>
              <CardDescription>
                Click on a patient to view their medical history records
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredPatients.length === 0 ? (
                <div className="text-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    {patients.length === 0 ? "No patients found" : "No patients match your search"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {patients.length === 0 
                      ? "Add patients from the Patient Management section" 
                      : "Try adjusting your search terms"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredPatients.map((patient) => (
                    <Card
                      key={patient.patient_id}
                      className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50"
                      onClick={() => handlePatientSelect(patient)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">
                              {patient.first_name} {patient.last_name}
                            </h3>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {patient.birthdate ? new Date().getFullYear() - new Date(patient.birthdate).getFullYear() : 'N/A'} years old
                              </p>
                              {patient.contact_number && (
                                <p className="flex items-center gap-1">
                                  <span className="h-3 w-3 rounded-full bg-green-500"></span>
                                  {patient.contact_number}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <Button variant="ghost" size="sm" className="p-2">
                              <Eye className="h-4 w-4" />
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
        </>
      ) : (
        /* Patient Medical History View */
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={handleBackToPatients}
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
                  Medical history for {selectedPatient.first_name} {selectedPatient.last_name}
                </p>
              </div>
            </div>
          </div>

          {/* Patient Info Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{selectedPatient.first_name} {selectedPatient.last_name}</h2>
                  <div className="flex items-center gap-6 text-muted-foreground mt-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {selectedPatient.birthdate ? `${new Date().getFullYear() - new Date(selectedPatient.birthdate).getFullYear()} years old` : 'Age not specified'}
                    </span>
                    {selectedPatient.contact_number && (
                      <span className="flex items-center gap-1">
                        <span className="h-4 w-4 rounded-full bg-green-500"></span>
                        {selectedPatient.contact_number}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {selectedPatient.gender || 'Not specified'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards for Patient */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{patientMedicalHistory.length}</div>
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
                <div className="text-2xl font-bold">
                  {patientMedicalHistory.filter(record => record.status === 'Active').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently active
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chronic Conditions</CardTitle>
                <Heart className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {patientMedicalHistory.filter(record => record.status === 'Chronic').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ongoing conditions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
                <Calendar className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {patientMedicalHistory.length > 0 
                    ? (() => {
                        const dates = patientMedicalHistory.map(r => {
                          if (r.updated_at && r.updated_at.toDate) {
                            return r.updated_at.toDate().getTime()
                          }
                          if (typeof r.updated_at === 'string') {
                            return new Date(r.updated_at).getTime()
                          }
                          return Date.now()
                        })
                        const maxDate = new Date(Math.max(...dates))
                        return maxDate.toLocaleDateString()
                      })()
                    : 'N/A'
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Most recent update
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Medical History Records */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Medical History Records
                  </CardTitle>
                  <CardDescription>
                    Complete medical history for {selectedPatient.first_name} {selectedPatient.last_name}
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setIsAddMedicalRecordOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add New Record
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPatientHistory ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading medical history records...</p>
                  </div>
                </div>
              ) : patientMedicalHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">
                    No medical history records found
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This patient doesn't have any medical history records yet
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Condition</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[100px]">Severity</TableHead>
                        <TableHead className="w-[200px]">Description</TableHead>
                        <TableHead className="w-[120px]">Date Diagnosed</TableHead>
                        <TableHead className="w-[150px]">Treatment</TableHead>
                        <TableHead className="w-[150px]">Medications</TableHead>
                        <TableHead className="w-[150px]">Allergies</TableHead>
                        <TableHead className="w-[100px]">Created</TableHead>
                        <TableHead className="w-[100px]">Updated</TableHead>
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientMedicalHistory.map((record) => (
                        <TableRow key={record.history_id}>
                          <TableCell className="font-medium text-sm">
                            {record.condition}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge className={`text-xs ${getStatusColor(record.status || '')}`}>
                              {record.status || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge className={`text-xs ${getSeverityColor(record.severity || '')}`}>
                              {record.severity || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="max-w-xs">
                              {record.description ? (
                                <div className="truncate" title={record.description}>
                                  {record.description}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">No description</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(record.date_diagnosed)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {record.treatment || 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="max-w-xs">
                              {record.medications || record.current_medications?.join(', ') || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="max-w-xs">
                              {record.allergies || record.known_allergies?.join(', ') || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(record.created_at)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(record.updated_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="View Details"
                                onClick={() => handleViewMedicalRecord(record)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Edit Record"
                                onClick={() => handleEditMedicalRecord(record)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Delete Record" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteMedicalRecord(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
        </>
      )}
      
      {/* View Medical Record Dialog */}
      <Dialog open={!!viewingMedicalRecord} onOpenChange={closeViewMedicalRecord}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Medical Record Details</DialogTitle>
            <DialogDescription>
              Detailed information about this medical record
            </DialogDescription>
          </DialogHeader>
          {viewingMedicalRecord && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Condition</Label>
                  <p className="text-sm font-semibold">{viewingMedicalRecord.condition}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={
                    viewingMedicalRecord.status === 'Active' 
                      ? 'bg-green-100 text-green-800' 
                      : viewingMedicalRecord.status === 'Resolved'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }>
                    {viewingMedicalRecord.status}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Severity</Label>
                  <Badge className={getSeverityColor(viewingMedicalRecord.severity || '')}>
                    {viewingMedicalRecord.severity || 'Not specified'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Date Diagnosed</Label>
                  <p className="text-sm">{formatDate(viewingMedicalRecord.date_diagnosed)}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                  {viewingMedicalRecord.description || 'No description provided'}
                </p>
              </div>

              {viewingMedicalRecord.treatment && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Treatment</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{viewingMedicalRecord.treatment}</p>
                </div>
              )}

              {(viewingMedicalRecord.medications || viewingMedicalRecord.current_medications) && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Medications</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                    {viewingMedicalRecord.medications || viewingMedicalRecord.current_medications?.join(', ')}
                  </p>
                </div>
              )}

              {(viewingMedicalRecord.allergies || viewingMedicalRecord.known_allergies) && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Allergies</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                    {viewingMedicalRecord.allergies || viewingMedicalRecord.known_allergies?.join(', ')}
                  </p>
                </div>
              )}

              {viewingMedicalRecord.notes && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">{viewingMedicalRecord.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(viewingMedicalRecord.created_at)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                  <p className="text-sm">{formatDate(viewingMedicalRecord.updated_at)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Medical Record Dialog */}
      <Dialog open={isEditMedicalDialogOpen} onOpenChange={setIsEditMedicalDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Medical Record</DialogTitle>
            <DialogDescription>
              Update the medical record information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-condition">Condition</Label>
                <Input
                  id="edit-condition"
                  value={medicalEditForm.condition}
                  onChange={(e) => setMedicalEditForm(prev => ({ ...prev, condition: e.target.value }))}
                  placeholder="Medical condition"
                />
              </div>
              <div>
                <Label htmlFor="edit-date-diagnosed">Date Diagnosed</Label>
                <Input
                  id="edit-date-diagnosed"
                  type="date"
                  value={medicalEditForm.date_diagnosed}
                  onChange={(e) => setMedicalEditForm(prev => ({ ...prev, date_diagnosed: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Input
                  id="edit-status"
                  value={medicalEditForm.status}
                  onChange={(e) => setMedicalEditForm(prev => ({ ...prev, status: e.target.value }))}
                  placeholder="e.g., Active, Resolved"
                />
              </div>
              <div>
                <Label htmlFor="edit-severity">Severity</Label>
                <Input
                  id="edit-severity"
                  value={medicalEditForm.severity}
                  onChange={(e) => setMedicalEditForm(prev => ({ ...prev, severity: e.target.value }))}
                  placeholder="e.g., Mild, Moderate, Severe"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={medicalEditForm.description}
                onChange={(e) => setMedicalEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed description of the condition"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit-treatment">Treatment</Label>
              <Textarea
                id="edit-treatment"
                value={medicalEditForm.treatment}
                onChange={(e) => setMedicalEditForm(prev => ({ ...prev, treatment: e.target.value }))}
                placeholder="Treatment plan or medications"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="edit-medications">Medications</Label>
              <Input
                id="edit-medications"
                value={medicalEditForm.medications}
                onChange={(e) => setMedicalEditForm(prev => ({ ...prev, medications: e.target.value }))}
                placeholder="Current medications"
              />
            </div>

            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={medicalEditForm.notes}
                onChange={(e) => setMedicalEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes"
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditMedicalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateMedicalRecord}>
              Update Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add New Medical Record Dialog */}
      <Dialog open={isAddMedicalRecordOpen} onOpenChange={setIsAddMedicalRecordOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Medical Record</DialogTitle>
            <DialogDescription>
              Add a new medical record for {selectedPatient?.first_name} {selectedPatient?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <Input
                  id="condition"
                  value={newMedicalRecord.condition}
                  onChange={(e) => setNewMedicalRecord(prev => ({ ...prev, condition: e.target.value }))}
                  placeholder="Enter medical condition"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date_diagnosed">Date Diagnosed</Label>
                <Input
                  id="date_diagnosed"
                  type="date"
                  value={newMedicalRecord.date_diagnosed}
                  onChange={(e) => setNewMedicalRecord(prev => ({ ...prev, date_diagnosed: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="current_conditions">Current Medical Conditions (comma-separated)</Label>
              <Input
                id="current_conditions"
                value={newMedicalRecord.current_medical_conditions.join(", ")}
                onChange={(e) => setNewMedicalRecord(prev => ({ 
                  ...prev, 
                  current_medical_conditions: e.target.value.split(",").map(item => item.trim()).filter(Boolean)
                }))}
                placeholder="e.g., Diabetes, Hypertension"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="past_history">Past Medical History (comma-separated)</Label>
              <Input
                id="past_history"
                value={newMedicalRecord.past_medical_history.join(", ")}
                onChange={(e) => setNewMedicalRecord(prev => ({ 
                  ...prev, 
                  past_medical_history: e.target.value.split(",").map(item => item.trim()).filter(Boolean)
                }))}
                placeholder="e.g., Surgery, Previous conditions"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="medications">Current Medications (comma-separated)</Label>
              <Input
                id="medications"
                value={newMedicalRecord.current_medications.join(", ")}
                onChange={(e) => setNewMedicalRecord(prev => ({ 
                  ...prev, 
                  current_medications: e.target.value.split(",").map(item => item.trim()).filter(Boolean)
                }))}
                placeholder="e.g., Metformin, Lisinopril"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="allergies">Known Allergies (comma-separated)</Label>
              <Input
                id="allergies"
                value={newMedicalRecord.known_allergies.join(", ")}
                onChange={(e) => setNewMedicalRecord(prev => ({ 
                  ...prev, 
                  known_allergies: e.target.value.split(",").map(item => item.trim()).filter(Boolean)
                }))}
                placeholder="e.g., Penicillin, Shellfish"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={newMedicalRecord.notes}
                onChange={(e) => setNewMedicalRecord(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes or observations"
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsAddMedicalRecordOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddMedicalRecord}
              disabled={!newMedicalRecord.condition || !newMedicalRecord.date_diagnosed}
            >
              Add Medical Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default MedicalRecords
