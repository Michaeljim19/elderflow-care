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
  ArrowLeft
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Patient, MedicalHistory } from "@/types"
import { getPatients } from "@/services/firebase/patients"
import { getMedicalHistoryByPatient, getMedicalHistories } from "@/services/firebase/medicalHistory"

const MedicalRecords = () => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [allMedicalHistories, setAllMedicalHistories] = useState<MedicalHistory[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientMedicalHistory, setPatientMedicalHistory] = useState<MedicalHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPatientHistory, setLoadingPatientHistory] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
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
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Medical History Records
              </CardTitle>
              <CardDescription>
                Complete medical history for {selectedPatient.first_name} {selectedPatient.last_name}
              </CardDescription>
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
                <div className="space-y-4">
                  {patientMedicalHistory.map((record) => (
                    <Card key={record.history_id} className="border-l-4 border-l-primary">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-lg font-semibold">{record.condition}</h3>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${getSeverityColor(record.severity || '')}`}>
                                  {record.severity || 'Not specified'}
                                </Badge>
                                <Badge className={`text-xs ${getStatusColor(record.status || '')}`}>
                                  {record.status || 'Not specified'}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                                <p className="text-sm">{record.description}</p>
                              </div>
                              
                              {record.treatment && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Treatment</h4>
                                  <p className="text-sm">{record.treatment}</p>
                                </div>
                              )}

                              {record.medications && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Medications</h4>
                                  <p className="text-sm">{record.medications}</p>
                                </div>
                              )}

                              {record.allergies && (
                                <div>
                                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Allergies</h4>
                                  <p className="text-sm">{record.allergies}</p>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Diagnosed: {formatDate(record.date_diagnosed)}
                                </span>
                                <span>•</span>
                                <span>Created: {formatDate(record.created_at)}</span>
                                {record.updated_at !== record.created_at && (
                                  <>
                                    <span>•</span>
                                    <span>Updated: {formatDate(record.updated_at)}</span>
                                  </>
                                )}
                              </div>
                            </div>
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
      )}
    </div>
  )
}

export default MedicalRecords
