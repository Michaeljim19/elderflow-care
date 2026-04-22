import { useState, useEffect, useMemo } from "react"
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
import { getMedicalHistoryByPatient, getMedicalHistories, addMedicalHistoryWithAttachments, updateMedicalHistory, deleteMedicalHistoryWithAttachments } from "@/services/firebase/medicalHistory"
import { getFileInfoFromURL } from "@/services/firebase/storage"

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
  const [newMedicalRecordFile, setNewMedicalRecordFile] = useState<File | null>(null)
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

  const medicalHistoryStats = useMemo(() => {
    const recordsByPatient = new Map<string, MedicalHistory[]>()
    let activeConditionCount = 0
    let recentRecordCount = 0
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    for (const history of allMedicalHistories) {
      const records = recordsByPatient.get(history.patient_id) || []
      records.push(history)
      recordsByPatient.set(history.patient_id, records)

      if (history.status?.toLowerCase() === 'active') {
        activeConditionCount++
      }

      const recordDate = new Date(history.date_diagnosed)
      if (!Number.isNaN(recordDate.getTime()) && recordDate >= weekAgo) {
        recentRecordCount++
      }
    }

    const lastRecordByPatient = new Map<string, MedicalHistory>()
    recordsByPatient.forEach((records, patientId) => {
      const lastRecord = records.slice().sort((a, b) => {
        const aDate = a.date_diagnosed?.toDate ? a.date_diagnosed.toDate().getTime() : new Date(a.date_diagnosed).getTime()
        const bDate = b.date_diagnosed?.toDate ? b.date_diagnosed.toDate().getTime() : new Date(b.date_diagnosed).getTime()
        return bDate - aDate
      })[0]

      if (lastRecord) {
        lastRecordByPatient.set(patientId, lastRecord)
      }
    })

    return {
      patientCountWithRecords: recordsByPatient.size,
      activeConditionCount,
      recentRecordCount,
      recordsByPatient,
      lastRecordByPatient
    }
  }, [allMedicalHistories])

  const filteredPatients = useMemo(() => {
    const query = searchTerm.toLowerCase()
    return patients.filter(patient =>
      `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(query) ||
      patient.contact_number?.toString().includes(searchTerm)
    )
  }, [patients, searchTerm])

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

  const openAttachment = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
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
        await deleteMedicalHistoryWithAttachments(record.history_id)

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

  const calculateAge = (birthdate: string) => {
    if (!birthdate) return 'N/A'

    const birthDate = new Date(birthdate)
    if (Number.isNaN(birthDate.getTime())) return 'N/A'

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
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
    if (!selectedPatient || !newMedicalRecordFile) return

    const isAllowedType = newMedicalRecordFile.type === 'image/jpeg' || newMedicalRecordFile.type === 'application/pdf'

    if (!isAllowedType) {
      toast({
        title: "Invalid file type",
        description: "Please upload only a JPEG or PDF file.",
        variant: "destructive"
      })
      return
    }

    try {
      const derivedCondition = newMedicalRecordFile.name.replace(/\.[^.]+$/, '') || 'Medical Record'

      const medicalHistoryData = {
        patient_id: selectedPatient.patient_id,
        condition: derivedCondition,
        date_diagnosed: new Date().toISOString().split('T')[0],
        current_medical_conditions: [],
        past_medical_history: [],
        current_medications: [],
        known_allergies: [],
        notes: `Uploaded medical record file: ${newMedicalRecordFile.name}`,
        severity: "moderate", // Default severity
        status: "active", // Default status
        treatment: "", // Default empty treatment
        doctor: "", // Default empty doctor
        attachments: [] // Default empty attachments
      }

      await addMedicalHistoryWithAttachments(medicalHistoryData, [newMedicalRecordFile])
      
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
      setNewMedicalRecordFile(null)
      
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
                  {medicalHistoryStats.patientCountWithRecords}
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
                  {medicalHistoryStats.activeConditionCount}
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
                  {medicalHistoryStats.recentRecordCount}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead className="w-[120px]">Age</TableHead>
                        <TableHead className="w-[180px]">Contact</TableHead>
                        <TableHead className="w-[140px]">Records</TableHead>
                        <TableHead className="w-[160px]">Last Record</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPatients.map((patient) => {
                        const patientRecords = medicalHistoryStats.recordsByPatient.get(patient.patient_id) || []
                        const patientLastRecord = medicalHistoryStats.lastRecordByPatient.get(patient.patient_id)

                        return (
                          <TableRow
                            key={patient.patient_id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handlePatientSelect(patient)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                  <User className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                  <div className="font-semibold">
                                    {patient.first_name} {patient.last_name}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {patient.gender || 'Not specified'}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {calculateAge(patient.birthdate)} years old
                            </TableCell>
                            <TableCell className="text-sm">
                              {patient.contact_number || 'N/A'}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="secondary">{patientRecords.length}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {patientLastRecord ? formatDate(patientLastRecord.date_diagnosed) : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="gap-2">
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
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
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Medical Record Details</DialogTitle>
            <DialogDescription>
              Detailed information about this medical record
            </DialogDescription>
          </DialogHeader>
          {viewingMedicalRecord && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
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
              
              <div className="grid gap-4 md:grid-cols-2">
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

              {Array.isArray(viewingMedicalRecord.attachments) && viewingMedicalRecord.attachments.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Attachment{viewingMedicalRecord.attachments.length > 1 ? 's' : ''}</Label>
                  <div className="mt-2 space-y-3">
                    {viewingMedicalRecord.attachments.map((url: string) => {
                      const fileInfo = getFileInfoFromURL(url)

                      if (fileInfo.isImage) {
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={() => openAttachment(url)}
                            className="group block w-full max-w-full overflow-hidden rounded-lg border bg-background text-left"
                            title={`Open ${fileInfo.fileName}`}
                          >
                            <div className="relative flex w-full max-w-full justify-center bg-muted/40 p-3">
                              <img
                                src={url}
                                alt={fileInfo.fileName}
                                className="max-h-[420px] w-auto max-w-full rounded-md object-contain bg-white"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                                <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                                  Click to view full size
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{fileInfo.fileName}</p>
                                <p className="text-xs text-muted-foreground">Image preview</p>
                              </div>
                              <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                            </div>
                          </button>
                        )
                      }

                      return (
                        <div key={url} className="flex w-full max-w-full items-center justify-between gap-3 rounded-lg border bg-background p-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{fileInfo.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {fileInfo.fileExtension.toUpperCase() || 'FILE'}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openAttachment(url)}
                            className="shrink-0"
                          >
                            Open File
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
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
              Upload a JPEG or PDF medical record for {selectedPatient?.first_name} {selectedPatient?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="medical-record-file">Medical Record File</Label>
              <Input
                id="medical-record-file"
                type="file"
                accept="image/jpeg,.jpg,.jpeg,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  if (file && file.type !== 'image/jpeg' && file.type !== 'application/pdf') {
                    toast({
                      title: 'Invalid file type',
                      description: 'Please upload only a JPEG or PDF file.',
                      variant: 'destructive'
                    })
                    e.target.value = ''
                    setNewMedicalRecordFile(null)
                    return
                  }
                  setNewMedicalRecordFile(file)
                }}
              />
              <p className="text-xs text-muted-foreground">
                Accepted file types: JPEG or PDF only.
              </p>
              {newMedicalRecordFile && (
                <p className="text-xs text-muted-foreground">
                  Selected file: {newMedicalRecordFile.name}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddMedicalRecordOpen(false)
                setNewMedicalRecordFile(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddMedicalRecord}
              disabled={!newMedicalRecordFile}
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
