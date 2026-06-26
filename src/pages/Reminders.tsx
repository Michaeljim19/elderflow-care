import { useState, useEffect } from "react"
import { 
  Bell, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar,
  User,
  Loader2,
  Clock,
  Activity,
  ArrowLeft,
  Plus,
  CheckCircle,
  AlertCircle,
  XCircle,
  PlayCircle
} from "lucide-react"
import { Timestamp } from 'firebase/firestore'
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
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Patient, Medication, Reminder, ReminderLog, NotificationTime, Caregiver } from "@/types"
import { getPatients } from "@/services/firebase/patients"
import { getUsers } from "@/services/firebase/users"
import { getCaregivers } from "@/services/firebase/caregivers"
import { getMedications } from "@/services/firebase/medications"
import { 
  getReminders, 
  addReminder, 
  updateReminder, 
  deleteReminder
} from "@/services/firebase/reminders"
import { 
  getReminderLogs,
  acknowledgeReminder,
  markReminderAsMissed
} from "@/services/firebase/reminderLogs"

const Reminders = () => {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [reminderLogs, setReminderLogs] = useState<ReminderLog[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  // Dialog states
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false)
  const [viewingReminder, setViewingReminder] = useState<Reminder | null>(null)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)
  const [isEditReminderOpen, setIsEditReminderOpen] = useState(false)
  const [viewingReminderLog, setViewingReminderLog] = useState<ReminderLog | null>(null)

  // Form states
  const [newReminder, setNewReminder] = useState({
    caregiverRef: "",
    userId: "",
    type: "Task" as "Task" | "Medication" | "Appointment" | "Custom",
    title: "",
    description: "",
    repeat: "Daily" as "Daily" | "Weekly" | "Monthly" | "Once" | "Custom",
    is_active: true,
    notification_times: [] as NotificationTime[]
  })

  const [editForm, setEditForm] = useState({
    caregiverRef: "",
    userId: "",
    type: "Task" as "Task" | "Medication" | "Appointment" | "Custom",
    title: "",
    description: "",
    repeat: "Daily" as "Daily" | "Weekly" | "Monthly" | "Once" | "Custom",
    is_active: true,
    notification_times: [] as NotificationTime[]
  })

  const { toast } = useToast()

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        console.log('Loading reminders data...')
        
        const [remindersData, reminderLogsData, patientsData, usersData, caregiversData, medicationsData] = await Promise.all([
          getReminders(),
          getReminderLogs(),
          getPatients(),
          getUsers(),
          getCaregivers(),
          getMedications()
        ])
        
        console.log('Reminders data loaded:', remindersData)
        console.log('Sample reminder data structure:', remindersData[0])
        console.log('Reminder logs data loaded:', reminderLogsData)
        console.log('Sample reminder log data structure:', reminderLogsData[0])
        console.log('Patients data loaded:', patientsData)
        console.log('Users data loaded:', usersData)
        console.log('Caregivers data loaded:', caregiversData)
        console.log('Medications data loaded:', medicationsData)
        
        setReminders(remindersData)
        setReminderLogs(reminderLogsData)
        setPatients(patientsData)
        setUsers(usersData)
        setCaregivers(caregiversData)
        setMedications(medicationsData)
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: "Error",
          description: "Failed to load reminders data. Please try again.",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [toast])

  // Handler functions
  const handleViewReminder = (reminder: Reminder) => {
    console.log('View reminder clicked', reminder)
    setViewingReminder(reminder)
  }

  const closeViewReminder = () => {
    setViewingReminder(null)
  }

  const handleEditReminder = (reminder: Reminder) => {
    console.log('Edit reminder clicked', reminder)
    setEditingReminder(reminder)
    setEditForm({
      caregiverRef: reminder.caregiverRef,
      userId: reminder.userId,
      type: reminder.type,
      title: reminder.title,
      description: reminder.description || "",
      repeat: reminder.repeat,
      is_active: reminder.is_active,
      notification_times: reminder.notification_times || []
    })
    setIsEditReminderOpen(true)
  }

  const handleUpdateReminder = async () => {
    if (!editingReminder) return

    try {
      const updatedReminder = {
        caregiverRef: editForm.caregiverRef,
        userId: editForm.userId,
        type: editForm.type,
        title: editForm.title,
        description: editForm.description,
        repeat: editForm.repeat,
        is_active: editForm.is_active,
        notification_times: editForm.notification_times
      }

      await updateReminder(editingReminder.reminder_id, updatedReminder)
      
      // Refresh reminders
      const updatedReminders = await getReminders()
      setReminders(updatedReminders)
      
      setIsEditReminderOpen(false)
      setEditingReminder(null)
      
      toast({
        title: "Success",
        description: "Reminder updated successfully"
      })
    } catch (error) {
      console.error("Error updating reminder:", error)
      toast({
        title: "Error",
        description: "Failed to update reminder",
        variant: "destructive"
      })
    }
  }

  const handleDeleteReminder = async (reminder: Reminder) => {
    console.log('Delete reminder clicked', reminder)
    if (window.confirm('Are you sure you want to delete this reminder?')) {
      try {
        await deleteReminder(reminder.reminder_id)
        
        // Refresh reminders
        const updatedReminders = await getReminders()
        setReminders(updatedReminders)
        
        toast({
          title: "Success",
          description: "Reminder deleted successfully"
        })
      } catch (error) {
        console.error('Error deleting reminder:', error)
        toast({
          title: "Error",
          description: "Failed to delete reminder",
          variant: "destructive"
        })
      }
    }
  }

  const handleAddReminder = async () => {
    try {
      const reminderData = {
        caregiverRef: newReminder.caregiverRef,
        userId: newReminder.userId,
        type: newReminder.type,
        title: newReminder.title,
        description: newReminder.description,
        repeat: newReminder.repeat,
        is_active: newReminder.is_active,
        notification_times: newReminder.notification_times,
        createdTime: Timestamp.fromDate(new Date())
      }

      await addReminder(reminderData)
      
      // Reset form
      setNewReminder({
        caregiverRef: "",
        userId: "",
        type: "Task",
        title: "",
        description: "",
        repeat: "Daily",
        is_active: true,
        notification_times: []
      })
      
      // Close dialog
      setIsAddReminderOpen(false)
      
      // Refresh reminders
      const updatedReminders = await getReminders()
      setReminders(updatedReminders)
      
      toast({
        title: "Success",
        description: "Reminder has been added successfully."
      })
    } catch (error) {
      console.error("Error adding reminder:", error)
      toast({
        title: "Error",
        description: "Failed to add reminder. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleAcknowledgeReminder = async (reminderLog: ReminderLog) => {
    const reminderLogDocId = reminderLog.id || reminderLog.reminder_id
    if (!reminderLogDocId) {
      toast({
        title: "Error",
        description: "Unable to find reminder log ID",
        variant: "destructive"
      })
      return
    }

    try {
      await acknowledgeReminder(reminderLogDocId, "System", "Acknowledged via Reminders page")
      
      // Refresh reminder logs
      const updatedLogs = await getReminderLogs()
      setReminderLogs(updatedLogs)
      
      toast({
        title: "Success",
        description: "Reminder acknowledged successfully"
      })
    } catch (error) {
      console.error("Error acknowledging reminder:", error)
      toast({
        title: "Error",
        description: "Failed to acknowledge reminder",
        variant: "destructive"
      })
    }
  }

  const handleMarkAsMissed = async (reminderLog: ReminderLog) => {
    const reminderLogDocId = reminderLog.id || reminderLog.reminder_id
    if (!reminderLogDocId) {
      toast({
        title: "Error",
        description: "Unable to find reminder log ID",
        variant: "destructive"
      })
      return
    }

    try {
      await markReminderAsMissed(reminderLogDocId, "Marked as missed via Reminders page")
      
      // Refresh reminder logs
      const updatedLogs = await getReminderLogs()
      setReminderLogs(updatedLogs)
      
      toast({
        title: "Success",
        description: "Reminder marked as missed"
      })
    } catch (error) {
      console.error("Error marking reminder as missed:", error)
      toast({
        title: "Error",
        description: "Failed to mark reminder as missed",
        variant: "destructive"
      })
    }
  }

  // Utility functions
  const formatDate = (dateValue: any) => {
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

  const formatDateTime = (dateValue: any) => {
    if (!dateValue) return 'N/A'
    
    // Handle Firebase Timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate().toLocaleString()
    }
    
    // Handle regular date string
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toLocaleString()
    }
    
    // Handle Date object
    if (dateValue instanceof Date) {
      return dateValue.toLocaleString()
    }
    
    return 'N/A'
  }

  const formatNotificationTimes = (times: NotificationTime[]) => {
    if (!times || times.length === 0) return 'N/A'
    return times.map(time => `${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}`).join(', ')
  }

  const normalizeStatus = (status?: string) => (status || '').trim().toLowerCase()

  const toStatusLabel = (status?: string) => {
    const normalized = normalizeStatus(status)
    if (!normalized) return 'N/A'
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  const extractRefId = (value: any): string => {
    if (!value) return ''
    if (typeof value === 'string') return value.split('/').pop() || value
    if (typeof value === 'object') {
      if (value.id) return value.id
      if (value.path) return String(value.path).split('/').pop() || String(value.path)
    }
    const asString = String(value)
    return asString.includes('/') ? asString.split('/').pop() || asString : asString
  }

  const getUserName = (userId: any) => {
    if (!userId) return 'Unknown Patient'

    const userKey = typeof userId === 'object'
      ? userId.id || userId.user_id || userId.uid || extractRefId(userId)
      : extractRefId(userId)

    const user = users.find(item =>
      item.id === userKey || item.user_id === userKey || item.uid === userKey
    )

    if (!user) {
      return 'Unknown Patient'
    }

    return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || 'Unknown Patient'
  }

  const getCaregiverName = (caregiverRef: any) => {
    if (!caregiverRef) return 'Unknown Caregiver'

    const caregiverId = typeof caregiverRef === 'object'
      ? caregiverRef.id || caregiverRef.caregiver_id || caregiverRef.user_id || caregiverRef.uid || extractRefId(caregiverRef)
      : extractRefId(caregiverRef)

    const caregiver = caregivers.find(item =>
      item.caregiver_id === caregiverId || item.user_id === caregiverId || item.id === caregiverId
    )

    if (caregiver) {
      return [caregiver.first_name, caregiver.last_name].filter(Boolean).join(' ').trim() || 'Unknown Caregiver'
    }

    const user = users.find(item =>
      item.id === caregiverId || item.user_id === caregiverId || item.uid === caregiverId
    )

    if (user) {
      return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || 'Unknown Caregiver'
    }

    return 'Unknown Caregiver'
  }

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId)
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient'
  }

  const getMedicationName = (medicationId: string) => {
    const medication = medications.find(m => m.id === medicationId)
    return medication ? medication.name : 'Unknown Medication'
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'sent': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'acknowledged': return 'bg-green-100 text-green-800 border-green-200'
      case 'skipped': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'missed': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getReminderTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'medication': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'appointment': return 'bg-green-100 text-green-800 border-green-200'
      case 'custom': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getReminderScheduleStatus = (reminder: Reminder) => {
    if (reminder.status) {
      return reminder.status
    }

    return reminder.is_active ? 'Scheduled' : 'Inactive'
  }

  const getReminderFromLog = (log: ReminderLog) => {
    const reminderId = extractRefId(log.reminderRef) || log.reminder_id
    if (!reminderId) return null
    return reminders.find(item => item.id === reminderId || item.reminder_id === reminderId) || null
  }

  const getReminderTitleFromLog = (log: ReminderLog) => {
    const reminderFromLog = getReminderFromLog(log)
    return reminderFromLog?.title || extractRefId(log.reminderRef) || log.reminder_id || 'N/A'
  }

  const getUserNameFromLog = (log: ReminderLog) => {
    return getUserName(log.userId || log.userRef || log.patient_id || '')
  }

  const getCaregiverNameFromLog = (log: ReminderLog) => {
    const reminderFromLog = getReminderFromLog(log)
    return getCaregiverName(log.caregiverRef || reminderFromLog?.caregiverRef || '')
  }

  const getReminderScheduledTime = (log: ReminderLog) => {
    return log.scheduledInstanceTime || log.scheduled_time || log.timestamp || log.completed_at || log.capture_time
  }

  const getReminderNote = (log: ReminderLog) => {
    return log.note || log.notes || 'N/A'
  }

  const getReminderEvidenceUrl = (log: ReminderLog) => {
    return log.media_url || log.evidence_photo_url || log.evidence_video_url || null
  }

  const getReminderEvidenceType = (log: ReminderLog): 'image' | 'video' | 'unknown' => {
    if (log.evidence_video_url) return 'video'
    if (log.evidence_photo_url) return 'image'

    const url = getReminderEvidenceUrl(log)
    if (!url) return 'unknown'

    if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url)) return 'video'
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)) return 'image'

    return 'unknown'
  }

  // Filter data
  const filteredReminders = reminders.filter(reminder => {
    const matchesSearch = reminder.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getUserName(reminder.userId).toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getCaregiverName(reminder.caregiverRef).toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || reminder.type.toLowerCase() === filterType.toLowerCase()
    return matchesSearch && matchesType
  })

  const filteredReminderLogs = reminderLogs.filter(log => {
    const userName = getUserNameFromLog(log)
    const caregiverName = getCaregiverNameFromLog(log)
    const reminderTitle = getReminderTitleFromLog(log)
    const actionText = (log.action || '').toLowerCase()
    const notesText = (log.note || log.notes || '').toLowerCase()
    const matchesSearch = userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         caregiverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reminderTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         actionText.includes(searchTerm.toLowerCase()) ||
                         notesText.includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "all" || normalizeStatus(log.status) === normalizeStatus(filterStatus)
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold text-foreground">Reminders</h1>
          <p className="text-xl text-muted-foreground">Manage medication reminders and notifications</p>
          {reminders.length === 0 && !loading && (
            <p className="text-red-500 font-semibold mt-2">No reminders data found. Check console for debugging info.</p>
          )}
        </div>
        <Button 
          onClick={() => setIsAddReminderOpen(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add New Reminder
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reminders</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reminders.length}</div>
            <p className="text-xs text-muted-foreground">
              All reminder schedules
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reminders</CardTitle>
            <PlayCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reminders.filter(r => r.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reminderLogs.filter(log => {
                const normalized = normalizeStatus(log.status)
                return normalized === 'scheduled' || normalized === 'sent' || normalized === 'late'
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting response
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed Today</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reminderLogs.filter(log => {
                const reminderTime = getReminderScheduledTime(log)
                const logDate = reminderTime && (reminderTime as any).toDate ? 
                  (reminderTime as any).toDate() : 
                  typeof reminderTime === 'string' ? 
                    new Date(reminderTime) :
                    new Date()
                const today = new Date()
                return normalizeStatus(log.status) === 'missed' && 
                       logDate.toDateString() === today.toDateString()
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Today's missed reminders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reminders, patients, medications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="medication">Medication</SelectItem>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reminders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminder Schedules
          </CardTitle>
          <CardDescription>
            Manage and configure reminder schedules
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReminders.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {reminders.length === 0 ? "No reminders found" : "No reminders match your search"}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {reminders.length === 0 
                  ? "Create your first reminder to get started" 
                  : "Try adjusting your search terms"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Caregiver</TableHead>
                    <TableHead>Notification Times</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReminders.map((reminder) => (
                    <TableRow key={reminder.id}>
                      <TableCell className="font-medium">
                        {reminder.title}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getReminderTypeColor(reminder.type)}`}>
                          {reminder.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{getUserName(reminder.userId)}</TableCell>
                      <TableCell>{getCaregiverName(reminder.caregiverRef)}</TableCell>
                      <TableCell>{formatNotificationTimes(reminder.notification_times)}</TableCell>
                      <TableCell>{reminder.repeat}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getStatusColor(getReminderScheduleStatus(reminder))}`}>
                          {getReminderScheduleStatus(reminder)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="View Details"
                            onClick={() => handleViewReminder(reminder)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Edit Reminder"
                            onClick={() => handleEditReminder(reminder)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Delete Reminder" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteReminder(reminder)}
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

      {/* Reminder Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Reminder Activity Log
          </CardTitle>
          <CardDescription>
            Track reminder notifications and responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReminderLogs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                No reminder logs found
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Reminder activity will appear here as reminders are sent and responded to
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reminder</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Caregiver</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReminderLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{getReminderTitleFromLog(log)}</TableCell>
                      <TableCell>{getUserNameFromLog(log)}</TableCell>
                      <TableCell>{getCaregiverNameFromLog(log)}</TableCell>
                      <TableCell>{log.action || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getStatusColor(log.status)}`}>
                          {toStatusLabel(log.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(getReminderScheduledTime(log))}</TableCell>
                      <TableCell className="max-w-xs truncate">{getReminderNote(log)}</TableCell>
                      <TableCell>
                        {getReminderEvidenceUrl(log) ? (
                          <a
                            href={getReminderEvidenceUrl(log) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline"
                          >
                            View
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(normalizeStatus(log.status) === 'scheduled' || normalizeStatus(log.status) === 'sent') && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Mark as Acknowledged"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => handleAcknowledgeReminder(log)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Mark as Missed"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleMarkAsMissed(log)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="View Details"
                            onClick={() => setViewingReminderLog(log)}
                          >
                            <Eye className="h-4 w-4" />
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

      {/* View Reminder Dialog */}
      <Dialog open={!!viewingReminder} onOpenChange={closeViewReminder}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reminder Details</DialogTitle>
            <DialogDescription>
              Detailed information about this reminder
            </DialogDescription>
          </DialogHeader>
          {viewingReminder && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                  <p className="text-sm font-semibold">{viewingReminder.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                  <Badge className={getReminderTypeColor(viewingReminder.type)}>
                    {viewingReminder.type}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Patient</Label>
                  <p className="text-sm">{getUserName(viewingReminder.userId)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Caregiver</Label>
                  <p className="text-sm">{getCaregiverName(viewingReminder.caregiverRef)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={`text-xs ${getStatusColor(getReminderScheduleStatus(viewingReminder))}`}>
                    {getReminderScheduleStatus(viewingReminder)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Notification Times</Label>
                  <p className="text-sm">{formatNotificationTimes(viewingReminder.notification_times)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Frequency</Label>
                  <p className="text-sm">{viewingReminder.repeat}</p>
                </div>
              </div>

              {viewingReminder.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                    {viewingReminder.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={viewingReminder.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {viewingReminder.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm">{formatDate(viewingReminder.createdTime)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Reminder Dialog */}
      <Dialog open={isEditReminderOpen} onOpenChange={setIsEditReminderOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
            <DialogDescription>
              Update the reminder information
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Reminder title"
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select value={editForm.type} onValueChange={(value: "Task" | "Medication" | "Appointment" | "Custom") => setEditForm(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Task">Task</SelectItem>
                    <SelectItem value="Medication">Medication</SelectItem>
                    <SelectItem value="Appointment">Appointment</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <div>
                <Label htmlFor="edit-patient">Patient</Label>
                <Select value={editForm.userId} onValueChange={(value) => setEditForm(prev => ({ ...prev, userId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.patient_id} value={patient.patient_id}>
                        {patient.first_name} {patient.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-frequency">Frequency</Label>
                <Select value={editForm.repeat} onValueChange={(value: "Daily" | "Weekly" | "Monthly" | "Once" | "Custom") => setEditForm(prev => ({ ...prev, repeat: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Once">Once</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details about this reminder"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                title="Active"
                checked={editForm.is_active}
                onChange={(e) => setEditForm(prev => ({ ...prev, is_active: e.target.checked }))}
              />
              <Label htmlFor="edit-active">Active</Label>
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditReminderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateReminder}>
              Update Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Reminder Dialog */}
      <Dialog open={isAddReminderOpen} onOpenChange={setIsAddReminderOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Reminder</DialogTitle>
            <DialogDescription>
              Create a new reminder for medication or appointment
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newReminder.title}
                  onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter reminder title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={newReminder.type} onValueChange={(value: "Task" | "Medication" | "Appointment" | "Custom") => setNewReminder(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Task">Task</SelectItem>
                    <SelectItem value="Medication">Medication</SelectItem>
                    <SelectItem value="Appointment">Appointment</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patient">Patient</Label>
                <Select value={newReminder.userId} onValueChange={(value) => setNewReminder(prev => ({ ...prev, userId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.patient_id} value={patient.patient_id}>
                        {patient.first_name} {patient.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={newReminder.repeat} onValueChange={(value: "Daily" | "Weekly" | "Monthly" | "Once" | "Custom") => setNewReminder(prev => ({ ...prev, repeat: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Once">Once</SelectItem>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newReminder.description}
                onChange={(e) => setNewReminder(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details about this reminder"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                title="Active"
                checked={newReminder.is_active}
                onChange={(e) => setNewReminder(prev => ({ ...prev, is_active: e.target.checked }))}
              />
              <Label htmlFor="is_active">Active</Label>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsAddReminderOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddReminder}
              disabled={!newReminder.title || !newReminder.userId}
            >
              Add Reminder
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Reminder Log Dialog */}
      <Dialog open={!!viewingReminderLog} onOpenChange={() => setViewingReminderLog(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Reminder Log Details</DialogTitle>
            <DialogDescription>
              Information about this reminder notification
            </DialogDescription>
          </DialogHeader>
          {viewingReminderLog && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Patient</Label>
                  <p className="text-sm font-semibold">{getUserNameFromLog(viewingReminderLog)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Caregiver</Label>
                  <p className="text-sm">{getCaregiverNameFromLog(viewingReminderLog)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Reminder</Label>
                  <p className="text-sm">{getReminderTitleFromLog(viewingReminderLog)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(viewingReminderLog.status)}>
                    {toStatusLabel(viewingReminderLog.status)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Action</Label>
                  <p className="text-sm">{viewingReminderLog.action || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Scheduled Time</Label>
                  <p className="text-sm">{formatDateTime(getReminderScheduledTime(viewingReminderLog))}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Completed At</Label>
                  <p className="text-sm">{viewingReminderLog.completed_at ? formatDateTime(viewingReminderLog.completed_at) : 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Capture Time</Label>
                  <p className="text-sm">{viewingReminderLog.capture_time ? formatDateTime(viewingReminderLog.capture_time) : 'N/A'}</p>
                </div>
              </div>

              {viewingReminderLog.acknowledged_by && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Acknowledged By</Label>
                  <p className="text-sm">{viewingReminderLog.acknowledged_by}</p>
                </div>
              )}

              {(viewingReminderLog.note || viewingReminderLog.notes) && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Notes</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                    {viewingReminderLog.note || viewingReminderLog.notes}
                  </p>
                </div>
              )}

              {getReminderEvidenceUrl(viewingReminderLog) && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Evidence</Label>
                  <div className="mt-2 space-y-3">
                    {getReminderEvidenceType(viewingReminderLog) === 'image' && (
                      <img
                        src={getReminderEvidenceUrl(viewingReminderLog) || ''}
                        alt="Reminder evidence"
                        className="w-full max-h-80 object-contain rounded-md border bg-muted"
                      />
                    )}

                    {getReminderEvidenceType(viewingReminderLog) === 'video' && (
                      <video
                        controls
                        className="w-full max-h-80 rounded-md border bg-black"
                        poster={viewingReminderLog.evidence_video_thumbnail_url || undefined}
                      >
                        <source src={getReminderEvidenceUrl(viewingReminderLog) || ''} />
                        Your browser does not support video playback.
                      </video>
                    )}

                    <a
                      href={getReminderEvidenceUrl(viewingReminderLog) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      Open evidence file
                    </a>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm">{viewingReminderLog.created_at ? formatDateTime(viewingReminderLog.created_at) : 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                  <p className="text-sm">{viewingReminderLog.updated_at ? formatDateTime(viewingReminderLog.updated_at) : 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Reminders
