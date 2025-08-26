import { useState, useEffect } from "react"
import { Calendar, Clock, Users, MapPin, Phone, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Activity, RotateCcw, RefreshCw, Plus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { 
  Caregiver, 
  Patient,
  CaregiverShift,
  canCaregiverTakeMorePatients, 
  getAvailablePatientSlots,
  getMaxPatientsForShift 
} from "@/types"
import { getCaregivers, updateCaregiver, generateMissingShiftRecords } from "@/services/firebase/caregivers"
import { getPatients } from "@/services/firebase/patients"
import { 
  addCaregiverShift,
  updateCaregiverShift,
  getCaregiverShifts,
  getShiftsByDateRange,
  getCurrentShifts,
  getCaregiverTodayShifts, 
  getShiftsByCaregiverAndDateRange 
} from "@/services/firebase/caregiverShifts"
import { Timestamp } from "firebase/firestore"

// Convert Firebase Timestamp to Date object
const timestampToDateObj = (timestamp: any): Date | null => {
  if (!timestamp) return null
  
  // Handle Firestore Timestamp
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  
  // Handle if it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp
  }
  
  // Handle if it has a toDate method (Firestore Timestamp-like object)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate()
  }
  
  // Handle string format (fallback for legacy data)
  if (typeof timestamp === 'string') {
    try {
      return new Date(timestamp)
    } catch (e) {
      console.warn('Could not parse timestamp:', timestamp)
      return null
    }
  }
  
  console.warn('Unknown timestamp format:', timestamp)
  return null
}

// Helper function to convert Firebase Timestamp to Date string
const timestampToDate = (timestamp: any): string => {
  if (!timestamp) return ""
  
  // Handle Firestore Timestamp
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString().split('T')[0]
  }
  
  // Handle if it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp.toISOString().split('T')[0]
  }
  
  // Handle if it has a toDate method (Firestore Timestamp-like object)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString().split('T')[0]
  }
  
  // Handle string format (fallback for legacy data)
  if (typeof timestamp === 'string') {
    // If it's already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
      return timestamp
    }
    // Try to parse as ISO string
    try {
      const date = new Date(timestamp)
      return date.toISOString().split('T')[0]
    } catch (e) {
      console.warn('Could not parse timestamp:', timestamp)
      return ""
    }
  }
  
  console.warn('Unknown timestamp format:', timestamp)
  return ""
}

// Convert date string to Firebase Timestamp
const dateToTimestamp = (dateString: string): Timestamp => {
  return Timestamp.fromDate(new Date(dateString))
}

// Convert time string (HH:MM) to Firebase Timestamp with today's date
const timeToTimestamp = (timeString: string): Timestamp => {
  const today = new Date()
  const [hours, minutes] = timeString.split(':').map(Number)
  today.setHours(hours, minutes, 0, 0)
  return Timestamp.fromDate(today)
}

// Convert Timestamp to time string (HH:MM)
const timestampToTime = (timestamp: any): string => {
  if (!timestamp) return ""
  
  // Handle Firestore Timestamp
  if (timestamp instanceof Timestamp) {
    const date = timestamp.toDate()
    return date.toTimeString().substring(0, 5) // HH:MM format
  }
  
  // Handle if it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp.toTimeString().substring(0, 5) // HH:MM format
  }
  
  // Handle if it has a toDate method (Firestore Timestamp-like object)
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    const date = timestamp.toDate()
    return date.toTimeString().substring(0, 5) // HH:MM format
  }
  
  // Handle string format (fallback for legacy data)
  if (typeof timestamp === 'string') {
    // If it's already in HH:MM format, return as is
    if (/^\d{2}:\d{2}$/.test(timestamp)) {
      return timestamp
    }
    // Try to parse as ISO string
    try {
      const date = new Date(timestamp)
      return date.toTimeString().substring(0, 5)
    } catch (e) {
      console.warn('Could not parse timestamp:', timestamp)
      return ""
    }
  }
  
  console.warn('Unknown timestamp format:', timestamp)
  return ""
}

// Check if a shift has ended
const hasShiftEnded = (caregiver: Caregiver): boolean => {
  const endDate = timestampToDateObj(caregiver.shift_end_date)
  if (!endDate) return false
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return endDate < today
}

// Check if today is the last day of a shift
const isLastDayOfShift = (caregiver: Caregiver): boolean => {
  const endDate = timestampToDateObj(caregiver.shift_end_date)
  if (!endDate) return false
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  endDate.setHours(0, 0, 0, 0)
  
  return endDate.getTime() === today.getTime()
}

// Get opposite shift type
const getOppositeShift = (currentShift: 'Day' | 'Night'): 'Day' | 'Night' => {
  return currentShift === 'Day' ? 'Night' : 'Day'
}

// Calculate when the next shift will start
const getNextShiftStartDate = (caregiver: Caregiver): Date | null => {
  const endDate = timestampToDateObj(caregiver.shift_end_date)
  if (!endDate) return null
  
  const nextShiftStart = new Date(endDate)
  
  // Night shift caregivers get 1 day break before next shift
  if (caregiver.shift_type === 'Night') {
    nextShiftStart.setDate(nextShiftStart.getDate() + 2) // 1 day break + 1 day for next shift start
  } else {
    nextShiftStart.setDate(nextShiftStart.getDate() + 1) // Day shift starts immediately the next day
  }
  
  return nextShiftStart
}

// Calculate new shift dates (4 days total: start date + 3 days)
const calculateNewShiftDates = (isManualRotation = false, currentShiftType?: 'Day' | 'Night') => {
  const startDate = new Date()
  
  if (isManualRotation) {
    // For manual rotation, start immediately (today)
    // Don't add a day - start the new shift right now
  } else {
    // For automatic rotation
    if (currentShiftType === 'Night') {
      // Night shift caregivers get 1 day break before next shift
      startDate.setDate(startDate.getDate() + 2) // 1 day break + 1 day for next shift start
    } else {
      // Day shift starts tomorrow (no break)
      startDate.setDate(startDate.getDate() + 1)
    }
  }
  
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 3) // 4 days total (start date + 3 additional days)
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

// Get week dates starting from a given date
const getWeekDates = (startDate: Date): Date[] => {
  const dates = []
  const currentDate = new Date(startDate)
  
  // Get the Monday of the current week
  const dayOfWeek = currentDate.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  currentDate.setDate(currentDate.getDate() + mondayOffset)
  
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(currentDate))
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return dates
}

// Format date for display
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  })
}

// Check if caregiver has employment period covering the date (for general availability)
const hasEmploymentOnDate = (caregiver: Caregiver, date: Date): boolean => {
  const startDate = timestampToDate(caregiver.shift_start_date)
  const endDate = timestampToDate(caregiver.shift_end_date)
  
  if (!startDate || !endDate) return false
  
  const dateStr = date.toISOString().split('T')[0]
  const startDateStr = new Date(startDate).toISOString().split('T')[0]
  const endDateStr = new Date(endDate).toISOString().split('T')[0]
  
  return dateStr >= startDateStr && dateStr <= endDateStr
}

// Check if caregiver is available on a specific date by examining their scheduled shifts
const checkCaregiverAvailabilityOnDate = async (caregiverId: string, date: Date): Promise<{
  isAvailable: boolean
  shifts: CaregiverShift[]
  conflictType: 'none' | 'same-day' | 'overlapping'
}> => {
  try {
    const dateStr = date.toISOString().split('T')[0]
    
    // Get shifts for the specific date
    const shifts = await getShiftsByCaregiverAndDateRange(caregiverId, dateStr, dateStr)
    
    if (shifts.length === 0) {
      return {
        isAvailable: true,
        shifts: [],
        conflictType: 'none'
      }
    }
    
    // Check for conflicts
    const hasConflict = shifts.some(shift => {
      // If there's any shift on this date, consider it a conflict for scheduling purposes
      return timestampToDate(shift.shift_date) === dateStr
    })
    
    return {
      isAvailable: !hasConflict,
      shifts: shifts,
      conflictType: hasConflict ? 'same-day' : 'none'
    }
  } catch (error) {
    console.error('Error checking caregiver availability:', error)
    return {
      isAvailable: false,
      shifts: [],
      conflictType: 'none'
    }
  }
}

// Check caregiver availability for today
const checkCaregiverAvailabilityToday = async (caregiverId: string): Promise<{
  isAvailable: boolean
  shifts: CaregiverShift[]
  status: 'available' | 'scheduled' | 'busy'
}> => {
  try {
    const todayShifts = await getCaregiverTodayShifts(caregiverId)
    
    if (todayShifts.length === 0) {
      return {
        isAvailable: true,
        shifts: [],
        status: 'available'
      }
    }
    
    // Check if any shift is currently active (between start and end time)
    const now = new Date()
    const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    
    const activeShift = todayShifts.find(shift => {
      const startTime = timestampToTime(shift.start_time)
      const endTime = timestampToTime(shift.end_time)
      return currentTime >= startTime && currentTime <= endTime
    })
    
    return {
      isAvailable: false,
      shifts: todayShifts,
      status: activeShift ? 'busy' : 'scheduled'
    }
  } catch (error) {
    console.error('Error checking caregiver availability today:', error)
    return {
      isAvailable: false,
      shifts: [],
      status: 'available'
    }
  }
}

// Get availability status badge component
const getAvailabilityBadge = (availability: { isAvailable: boolean, status: string, shifts: CaregiverShift[] }) => {
  const getTooltipText = () => {
    if (availability.shifts.length === 0) {
      return "No shifts scheduled for today"
    }
    return availability.shifts.map(shift => 
      `${shift.shift_type} shift: ${shift.start_time} - ${shift.end_time}`
    ).join(', ')
  }

  switch (availability.status) {
    case 'available':
      return (
        <Badge 
          className="bg-green-100 text-green-800 border-green-300 cursor-help" 
          title={getTooltipText()}
        >
          Available
        </Badge>
      )
    case 'scheduled':
      return (
        <Badge 
          className="bg-blue-100 text-blue-800 border-blue-300 cursor-help"
          title={getTooltipText()}
        >
          Scheduled
        </Badge>
      )
    case 'busy':
      return (
        <Badge 
          className="bg-red-100 text-red-800 border-red-300 cursor-help"
          title={getTooltipText()}
        >
          On Duty
        </Badge>
      )
    default:
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-300">
          Unknown
        </Badge>
      )
  }
}

const Schedule = () => {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [caregiverShifts, setCaregiverShifts] = useState<CaregiverShift[]>([])
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [selectedShift, setSelectedShift] = useState<'all' | 'Day' | 'Night'>('all')
  const [showTemporaryOnly, setShowTemporaryOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rotatingShifts, setRotatingShifts] = useState(false)
  const [clearingTemporary, setClearingTemporary] = useState(false)
  const [isTemporaryScheduleOpen, setIsTemporaryScheduleOpen] = useState(false)
  const [addingTemporarySchedule, setAddingTemporarySchedule] = useState(false)
  const [selectedCaregiverForHistory, setSelectedCaregiverForHistory] = useState<Caregiver | null>(null)
  const [selectedCaregiversForCalendar, setSelectedCaregiversForCalendar] = useState<string[]>([])
  const [isShiftHistoryOpen, setIsShiftHistoryOpen] = useState(false)
  const [showTodaySchedules, setShowTodaySchedules] = useState(false) // Add state for Today's Active Schedules visibility
  const [caregiverAvailability, setCaregiverAvailability] = useState<Record<string, { isAvailable: boolean, status: string, shifts: CaregiverShift[] }>>({})
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const { toast } = useToast()

  // Temporary schedule form data
  const [tempScheduleData, setTempScheduleData] = useState({
    caregiver_id: "",
    start_date: "",
    end_date: "",
    shift_type: "" as "Day" | "Night" | "",
    reason: ""
  })

  const weekDates = getWeekDates(currentWeek)
  
  // Debug: Log the week dates being displayed
  console.log(`ðŸ“… Calendar week dates:`, weekDates.map(d => d.toISOString().split('T')[0]))

  // Function to check and generate missing shift records for caregivers
  const checkAndGenerateMissingShiftRecords = async (caregiversData: Caregiver[], shiftsData: CaregiverShift[]) => {
    try {
      const caregiversWithoutShifts = caregiversData.filter(caregiver => {
        // Check if caregiver has any shift records
        const caregiverShifts = shiftsData.filter(shift => shift.caregiver_id === caregiver.caregiver_id)
        return caregiverShifts.length === 0 && caregiver.shift_start_date && caregiver.shift_end_date
      })
      
      if (caregiversWithoutShifts.length > 0) {
        console.log(`ðŸ”„ Found ${caregiversWithoutShifts.length} caregivers without shift records, generating...`)
        
        for (const caregiver of caregiversWithoutShifts) {
          try {
            await generateMissingShiftRecords(caregiver.caregiver_id)
            console.log(` Generated shift records for ${caregiver.first_name} ${caregiver.last_name}`)
          } catch (error) {
            console.error(` Failed to generate shift records for ${caregiver.first_name} ${caregiver.last_name}:`, error)
          }
        }
        
        // Reload shift data after generating missing records
        console.log(' Reloading shift data after generating missing records...')
        const updatedShifts = await getCaregiverShifts()
        setCaregiverShifts(updatedShifts)
        console.log(` Updated shift data: ${updatedShifts.length} total shifts`)
      } else {
        console.log(' All caregivers have shift records')
      }
    } catch (error) {
      console.error('Error checking for missing shift records:', error)
    }
  }

  // Automatic shift rotation check
  const checkAndRotateExpiredShifts = async () => {
    const expiredCaregivers = caregivers.filter(hasShiftEnded)
    
    if (expiredCaregivers.length === 0) return

    console.log(`Auto-rotating ${expiredCaregivers.length} expired shifts...`)
    
    for (const caregiver of expiredCaregivers) {
      try {
        const newShiftType = getOppositeShift(caregiver.shift_type)
        const { startDate, endDate } = calculateNewShiftDates(false, caregiver.shift_type) // false = automatic rotation, pass current shift type
        const newMaxPatients = getMaxPatientsForShift(newShiftType)

        const updates = {
          shift_type: newShiftType,
          shift_start_date: dateToTimestamp(startDate),
          shift_end_date: dateToTimestamp(endDate),
          max_patients: newMaxPatients,
          updated_at: Timestamp.now()
        }

        await updateCaregiver(caregiver.caregiver_id, updates)
        console.log(`Auto-rotated ${caregiver.first_name} ${caregiver.last_name} from ${caregiver.shift_type} to ${newShiftType}`)
      } catch (error) {
        console.error(`Error auto-rotating caregiver ${caregiver.caregiver_id}:`, error)
      }
    }

    // Refresh data after auto-rotation
    if (expiredCaregivers.length > 0) {
      const updatedCaregiversData = await getCaregivers()
      setCaregivers(updatedCaregiversData)
      
      toast({
        title: "Automatic Shift Rotation",
        description: `${expiredCaregivers.length} expired shifts have been automatically rotated`,
      })
    }
  }

  // Load caregiver availability status
  const loadCaregiverAvailability = async (caregiverIds: string[]) => {
    try {
      setLoadingAvailability(true)
      const availabilityPromises = caregiverIds.map(async (id) => {
        const availability = await checkCaregiverAvailabilityToday(id)
        return { id, availability }
      })
      
      const results = await Promise.all(availabilityPromises)
      const availabilityMap: Record<string, { isAvailable: boolean, status: string, shifts: CaregiverShift[] }> = {}
      
      results.forEach(({ id, availability }) => {
        availabilityMap[id] = availability
      })
      
      setCaregiverAvailability(availabilityMap)
    } catch (error) {
      console.error("Error loading caregiver availability:", error)
      toast({
        title: "Error",
        description: "Failed to load caregiver availability status",
        variant: "destructive"
      })
    } finally {
      setLoadingAvailability(false)
    }
  }

  // Load caregivers, patients, and shifts data
  const loadData = async () => {
    try {
      setLoading(true)
      console.log(' Schedule: Loading data...')
      const [caregiversData, patientsData, shiftsData] = await Promise.all([
        getCaregivers(),
        getPatients(),
        getCaregiverShifts()
      ])
      setCaregivers(caregiversData)
      setPatients(patientsData)
      setCaregiverShifts(shiftsData)
      
      console.log(' Schedule: Data loaded successfully', {
        caregivers: caregiversData.length,
        patients: patientsData.length,
        shifts: shiftsData.length
      })
      
      // Debug logging for loaded shifts
      console.log(` Loaded data:`, {
        caregivers: caregiversData.length,
        patients: patientsData.length,
        shifts: shiftsData.length,
        shiftSample: shiftsData.slice(0, 3).map(s => {
          try {
            return {
              caregiver_id: s.caregiver_id,
              shift_date: timestampToDate(s.shift_date),
              shift_type: s.shift_type,
              start_time: timestampToTime(s.start_time),
              end_time: timestampToTime(s.end_time),
              raw_start_time: s.start_time,
              raw_end_time: s.end_time
            }
          } catch (error) {
            console.error('Error processing shift:', s, error)
            return {
              caregiver_id: s.caregiver_id,
              error: 'Failed to process shift data'
            }
          }
        })
      })
      
      // Load caregiver availability after loading caregivers
      if (caregiversData.length > 0) {
        const caregiverIds = caregiversData.map(c => c.caregiver_id)
        await loadCaregiverAvailability(caregiverIds)
        
        // Check for caregivers without shift records and generate them
        await checkAndGenerateMissingShiftRecords(caregiversData, shiftsData)
      }
      
      // Check for expired shifts after loading data
      setTimeout(() => {
        if (caregiversData.length > 0) {
          checkAndRotateExpiredShifts()
        }
      }, 1000)
    } catch (error) {
      console.error("Error loading schedule data:", error)
      toast({
        title: "Error",
        description: "Failed to load caregiver schedules. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [toast])

  // Refresh data manually
  const refreshData = async () => {
    toast({
      title: "Refreshing data...",
      description: "Loading latest schedule information."
    })
    await loadData()
    toast({
      title: "Data refreshed",
      description: "Schedule information has been updated."
    })
  }

  // Refresh only availability status
  const refreshAvailability = async () => {
    if (caregivers.length > 0) {
      const caregiverIds = caregivers.map(c => c.caregiver_id)
      await loadCaregiverAvailability(caregiverIds)
      toast({
        title: "Availability Updated",
        description: "Caregiver availability status has been refreshed."
      })
    }
  }

  // Auto-rotation timer - check every 30 seconds
  useEffect(() => {
    if (caregivers.length === 0) return

    const autoRotationInterval = setInterval(() => {
      checkAndRotateExpiredShifts()
    }, 30000) // Check every 30 seconds

    return () => clearInterval(autoRotationInterval)
  }, [caregivers])

  // Filter caregivers based on selected shift and temporary schedule status
  const filteredCaregivers = caregivers.filter(caregiver => {
    // Filter by shift type
    const shiftMatch = selectedShift === 'all' || caregiver.shift_type === selectedShift
    
    // Filter by temporary schedule status
    const tempMatch = !showTemporaryOnly || !!caregiver.temporary_schedule_reason
    
    return shiftMatch && tempMatch
  })

  // Navigate weeks
  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeek(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeek(newDate)
  }

  const goToToday = () => {
    setCurrentWeek(new Date())
  }

  const getShiftColor = (shiftType: string) => {
    return shiftType === 'Day' 
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-blue-100 text-blue-800 border-blue-200"
  }

  const getShiftTimes = (shiftType: string) => {
    return shiftType === 'Day' ? '7AM - 7PM' : '7PM - 7AM'
  }

  // Get shift records for a caregiver for a specific date
  const getCaregiverShiftsForDate = (caregiverId: string, date: string): CaregiverShift[] => {
    return caregiverShifts.filter(shift => 
      shift.caregiver_id === caregiverId && timestampToDate(shift.shift_date) === date
    )
  }

  // Check if caregiver has shift on specific date - checks for actual shift records
  const hasShiftOnDate = (caregiver: Caregiver, date: Date): boolean => {
    // Check if caregiver has actual shifts for the specific date
    const dateStr = date.toISOString().split('T')[0]
    const caregiverTodayShifts = caregiverShifts.filter(shift => {
      if (shift.caregiver_id !== caregiver.caregiver_id) return false
      
      // Convert Timestamp to date string for comparison
      const shiftDateStr = timestampToDate(shift.shift_date)
      return shiftDateStr === dateStr
    })
    
    // Enhanced debug logging
    console.log(` Checking ${caregiver.first_name} ${caregiver.last_name} for date ${dateStr}:`, {
      totalShifts: caregiverShifts.filter(s => s.caregiver_id === caregiver.caregiver_id).length,
      shiftsOnDate: caregiverTodayShifts.length,
      shiftDates: caregiverShifts
        .filter(s => s.caregiver_id === caregiver.caregiver_id)
        .map(s => timestampToDate(s.shift_date))
        .slice(0, 5) // Show first 5 dates
    })
    
    if (caregiverTodayShifts.length > 0) {
      console.log(` ${caregiver.first_name} ${caregiver.last_name} has ${caregiverTodayShifts.length} shift(s) on ${dateStr}`)
    }
    
    return caregiverTodayShifts.length > 0
  }

  // Get recent shifts for a caregiver (last 7 days)
  const getRecentShiftsForCaregiver = (caregiverId: string): CaregiverShift[] => {
    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    return caregiverShifts
      .filter(shift => {
        const shiftDate = timestampToDateObj(shift.shift_date)
        return shift.caregiver_id === caregiverId && 
               shiftDate && shiftDate >= sevenDaysAgo && 
               shiftDate <= today
      })
      .sort((a, b) => {
        const dateA = timestampToDateObj(b.shift_date)
        const dateB = timestampToDateObj(a.shift_date)
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0)
      })
  }

  // Get all shifts for a caregiver (for history view)
  const getAllShiftsForCaregiver = (caregiverId: string): CaregiverShift[] => {
    return caregiverShifts
      .filter(shift => shift.caregiver_id === caregiverId)
      .sort((a, b) => {
        const dateA = timestampToDateObj(b.shift_date)
        const dateB = timestampToDateObj(a.shift_date)
        return (dateA?.getTime() || 0) - (dateB?.getTime() || 0)
      })
  }

  // Open shift history modal
  const openShiftHistory = (caregiver: Caregiver) => {
    setSelectedCaregiverForHistory(caregiver)
    setIsShiftHistoryOpen(true)
  }

  // Get assigned patients for a caregiver based on their shift
  const getAssignedPatients = (caregiverId: string, shiftType?: string): Patient[] => {
    return patients.filter(patient => {
      // If shift type is specified, check only for that shift
      if (shiftType) {
        if (shiftType === 'Day') {
          return patient.assigned_day_caregiver_id === caregiverId
        } else if (shiftType === 'Night') {
          return patient.assigned_night_caregiver_id === caregiverId
        }
      }
      
      // If no shift type specified, check if this caregiver is assigned to the patient for any shift
      return patient.assigned_day_caregiver_id === caregiverId || 
             patient.assigned_night_caregiver_id === caregiverId ||
             patient.assigned_caregiver_id === caregiverId // backward compatibility
    })
  }

  // Rotate shift for a single caregiver
  const rotateCaregiver = async (caregiver: Caregiver, isManualRotation = false) => {
    try {
      const newShiftType = getOppositeShift(caregiver.shift_type)
      const newMaxPatients = getMaxPatientsForShift(newShiftType)

      let updates: any = {
        shift_type: newShiftType,
        max_patients: newMaxPatients,
        updated_at: Timestamp.now()
      }

      let shiftStartDate: string, shiftEndDate: string

      // Only change dates for automatic rotation, keep existing dates for manual rotation
      if (!isManualRotation) {
        const { startDate, endDate } = calculateNewShiftDates(false, caregiver.shift_type)
        updates.shift_start_date = dateToTimestamp(startDate)
        updates.shift_end_date = dateToTimestamp(endDate)
        shiftStartDate = startDate
        shiftEndDate = endDate
      } else {
        // For manual rotation, use existing dates or default to today + 7 days
        shiftStartDate = timestampToDate(caregiver.shift_start_date) || new Date().toISOString().split('T')[0]
        shiftEndDate = timestampToDate(caregiver.shift_end_date) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }

      // Create shift records for the new schedule
      const startDate = new Date(shiftStartDate)
      const endDate = new Date(shiftEndDate)
      const shiftRecords: Promise<string>[] = []

      // Calculate shift times based on new shift type
      const { startTimeStr, endTimeStr } = newShiftType === 'Day' 
        ? { startTimeStr: '07:00', endTimeStr: '19:00' }
        : { startTimeStr: '19:00', endTimeStr: '07:00' }

      // Create shift records for each day in the range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const shiftData = {
          caregiver_id: caregiver.caregiver_id,
          shift_date: Timestamp.fromDate(new Date(date)),
          shift_type: newShiftType,
          start_time: timeToTimestamp(startTimeStr),
          end_time: timeToTimestamp(endTimeStr),
          notes: isManualRotation ? "Manual shift rotation" : "Automatic shift rotation",
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        }
        
        shiftRecords.push(addCaregiverShift(shiftData))
      }

      // Wait for shift records and caregiver update
      await Promise.all([
        ...shiftRecords,
        updateCaregiver(caregiver.caregiver_id, updates)
      ])

      toast({
        title: "Shift Rotated",
        description: `${caregiver.first_name} ${caregiver.last_name} moved from ${caregiver.shift_type} to ${newShiftType} shift${isManualRotation ? ' (keeping current schedule)' : ''}`,
      })

      return true
    } catch (error) {
      console.error("Error rotating caregiver shift:", error)
      toast({
        title: "Error",
        description: `Failed to rotate shift for ${caregiver.first_name} ${caregiver.last_name}`,
        variant: "destructive"
      })
      return false
    }
  }

  // Auto-rotate expired shifts
  const autoRotateExpiredShifts = async () => {
    const expiredCaregivers = caregivers.filter(hasShiftEnded)
    
    if (expiredCaregivers.length === 0) {
      toast({
        title: "No Expired Shifts",
        description: "All caregiver shifts are still active",
      })
      return
    }

    setRotatingShifts(true)
    let successCount = 0
    
    for (const caregiver of expiredCaregivers) {
      const success = await rotateCaregiver(caregiver, false) // false = automatic rotation
      if (success) successCount++
    }

    // Refresh caregiver data
    try {
      await loadData()
    } catch (error) {
      console.error("Error refreshing data:", error)
    }

    setRotatingShifts(false)

    if (successCount > 0) {
      toast({
        title: "Shifts Rotated",
        description: `Successfully rotated ${successCount} expired shifts`,
      })
    }
  }

  // Manual rotate single caregiver
  const manualRotateCaregiver = async (caregiver: Caregiver) => {
    setRotatingShifts(true)
    const success = await rotateCaregiver(caregiver, true) // true = manual rotation
    
    if (success) {
      try {
        await loadData()
      } catch (error) {
        console.error("Error refreshing data:", error)
      }
    }
    
    setRotatingShifts(false)
  }

  // Handle temporary schedule form input changes
  const handleTempScheduleInputChange = (field: string, value: string) => {
    setTempScheduleData(prev => ({ ...prev, [field]: value }))
  }

  // Reset temporary schedule form
  const resetTempScheduleForm = () => {
    setTempScheduleData({
      caregiver_id: "",
      start_date: "",
      end_date: "",
      shift_type: "" as "Day" | "Night" | "",
      reason: ""
    })
  }

  // Restore original schedule for caregiver
  const restoreOriginalSchedule = async (caregiver: Caregiver) => {
    if (!caregiver.original_shift_type) {
      toast({
        title: "Error",
        description: "No original schedule found for this caregiver",
        variant: "destructive"
      })
      return
    }

    try {
      setRotatingShifts(true)

      const maxPatients = getMaxPatientsForShift(caregiver.original_shift_type)

      const updates = {
        shift_type: caregiver.original_shift_type,
        shift_start_date: caregiver.original_shift_start_date,
        shift_end_date: caregiver.original_shift_end_date,
        max_patients: maxPatients,
        updated_at: Timestamp.now(),
        // Clear temporary schedule fields
        temporary_schedule_reason: null,
        original_shift_type: null,
        original_shift_start_date: null,
        original_shift_end_date: null
      }

      await updateCaregiver(caregiver.caregiver_id, updates)
      
      // Refresh caregivers data
      const updatedCaregiversData = await getCaregivers()
      setCaregivers(updatedCaregiversData)
      
      toast({
        title: "Success",
        description: `${caregiver.first_name} ${caregiver.last_name} has been restored to their original schedule`,
      })
      
    } catch (error) {
      console.error("Error restoring original schedule:", error)
      toast({
        title: "Error",
        description: "Failed to restore original schedule",
        variant: "destructive"
      })
    } finally {
      setRotatingShifts(false)
    }
  }

  // Clear all temporary schedules
  const clearAllTemporarySchedules = async () => {
    const caregiversWithTemporary = caregivers.filter(c => c.temporary_schedule_reason)
    
    if (caregiversWithTemporary.length === 0) {
      toast({
        title: "No Temporary Schedules",
        description: "There are no temporary schedules to clear",
      })
      return
    }

    try {
      setClearingTemporary(true)
      
      let successCount = 0
      
      for (const caregiver of caregiversWithTemporary) {
        try {
          if (caregiver.original_shift_type) {
            const maxPatients = getMaxPatientsForShift(caregiver.original_shift_type)

            const updates = {
              shift_type: caregiver.original_shift_type,
              shift_start_date: caregiver.original_shift_start_date,
              shift_end_date: caregiver.original_shift_end_date,
              max_patients: maxPatients,
              updated_at: Timestamp.now(),
              // Clear temporary schedule fields
              temporary_schedule_reason: null,
              original_shift_type: null,
              original_shift_start_date: null,
              original_shift_end_date: null
            }

            await updateCaregiver(caregiver.caregiver_id, updates)
            successCount++
          }
        } catch (error) {
          console.error(`Error clearing temporary schedule for ${caregiver.first_name} ${caregiver.last_name}:`, error)
        }
      }

      // Refresh caregivers data
      const updatedCaregiversData = await getCaregivers()
      setCaregivers(updatedCaregiversData)
      
      toast({
        title: "Success",
        description: `Cleared ${successCount} temporary schedules and restored original assignments`,
      })
      
    } catch (error) {
      console.error("Error clearing temporary schedules:", error)
      toast({
        title: "Error",
        description: "Failed to clear some temporary schedules",
        variant: "destructive"
      })
    } finally {
      setClearingTemporary(false)
    }
  }

  // Handle temporary schedule creation
  const handleAddTemporarySchedule = async () => {
    if (!tempScheduleData.caregiver_id || !tempScheduleData.start_date || !tempScheduleData.end_date || !tempScheduleData.shift_type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setAddingTemporarySchedule(true)
      
      // Find the selected caregiver
      const selectedCaregiver = caregivers.find(c => c.caregiver_id === tempScheduleData.caregiver_id)
      if (!selectedCaregiver) {
        throw new Error("Selected caregiver not found")
      }

      // Calculate max patients for the selected shift type
      const maxPatients = getMaxPatientsForShift(tempScheduleData.shift_type)

      // Create detailed shift records for each day in the date range
      const startDate = new Date(tempScheduleData.start_date)
      const endDate = new Date(tempScheduleData.end_date)
      const shiftRecords: Promise<string>[] = []

      // Calculate shift times based on shift type
      const { startTimeStr, endTimeStr } = tempScheduleData.shift_type === 'Day' 
        ? { startTimeStr: '07:00', endTimeStr: '19:00' }
        : { startTimeStr: '19:00', endTimeStr: '07:00' }

      // Create shift records for each day in the range
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const shiftData = {
          caregiver_id: tempScheduleData.caregiver_id,
          shift_date: Timestamp.fromDate(new Date(date)),
          shift_type: tempScheduleData.shift_type,
          start_time: timeToTimestamp(startTimeStr),
          end_time: timeToTimestamp(endTimeStr),
          notes: tempScheduleData.reason || "Temporary schedule assignment",
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        }
        
        // Create the shift record
        shiftRecords.push(addCaregiverShift(shiftData))
      }

      // Wait for all shift records to be created
      const createdShiftIds = await Promise.all(shiftRecords)
      console.log(` Created ${createdShiftIds.length} shift records for ${selectedCaregiver.first_name} ${selectedCaregiver.last_name}`)

      // Update caregiver record with new schedule
      const updates = {
        shift_type: tempScheduleData.shift_type,
        shift_start_date: dateToTimestamp(tempScheduleData.start_date),
        shift_end_date: dateToTimestamp(tempScheduleData.end_date),
        max_patients: maxPatients,
        updated_at: Timestamp.now(),
        // Save original schedule if this is the first temporary assignment
        original_shift_type: selectedCaregiver.original_shift_type || selectedCaregiver.shift_type,
        original_shift_start_date: selectedCaregiver.original_shift_start_date || selectedCaregiver.shift_start_date,
        original_shift_end_date: selectedCaregiver.original_shift_end_date || selectedCaregiver.shift_end_date,
        // Add a note about this being a temporary schedule
        temporary_schedule_reason: tempScheduleData.reason || "Temporary schedule assignment"
      }

      await updateCaregiver(tempScheduleData.caregiver_id, updates)
      console.log('Updated caregiver with new schedule')
      
      // Refresh data with a small delay to ensure Firebase consistency
      console.log('Refreshing schedule data...')
      await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for Firebase consistency
      await loadData()
      console.log('Schedule data refreshed')
      console.log(` Updated caregiver ${selectedCaregiver.first_name} ${selectedCaregiver.last_name} with new schedule`)
      
      // Refresh data with a small delay to ensure Firebase consistency
      console.log(' Refreshing schedule data...')
      await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for Firebase consistency
      await loadData()
      console.log('Schedule data refreshed')
      
      // Reset form and close dialog
      resetTempScheduleForm()
      setIsTemporaryScheduleOpen(false)
      
      toast({
        title: "Success",
        description: `Temporary schedule created for ${selectedCaregiver.first_name} ${selectedCaregiver.last_name}`,
      })
      
    } catch (error) {
      console.error("Error creating temporary schedule:", error)
      toast({
        title: "Error",
        description: "Failed to create temporary schedule",
        variant: "destructive"
      })
    } finally {
      setAddingTemporarySchedule(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Clock className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading schedules...</p>
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
          <h1 className="text-5xl font-bold text-foreground">Schedule Management</h1>
          <p className="text-xl text-muted-foreground">View and manage caregiver schedules and shifts</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={refreshData} 
            disabled={loading}
            className="gap-2 h-12 text-base"
          >
            {loading ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={refreshAvailability} 
            disabled={loadingAvailability}
            className="gap-2"
            title="Refresh caregiver availability status"
          >
            {loadingAvailability ? (
              <Activity className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            Check Availability
          </Button>
          <Select value={selectedShift} onValueChange={(value: 'all' | 'Day' | 'Night') => setSelectedShift(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="Day">Day Shift</SelectItem>
              <SelectItem value="Night">Night Shift</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant={showTemporaryOnly ? "default" : "outline"}
            onClick={() => setShowTemporaryOnly(!showTemporaryOnly)}
            className="gap-2"
          >
            ðŸ”„ {showTemporaryOnly ? "Show All" : "Temporary Only"}
          </Button>
          <Button 
            variant="destructive" 
            onClick={clearAllTemporarySchedules} 
            disabled={clearingTemporary || caregivers.filter(c => c.temporary_schedule_reason).length === 0}
            className="gap-2"
          >
            {clearingTemporary ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Clear All Temporary
          </Button>
          <Button 
            variant="outline" 
            onClick={autoRotateExpiredShifts} 
            disabled={rotatingShifts}
            className="gap-2"
          >
            {rotatingShifts ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Auto Rotate Shifts
          </Button>
          <Dialog open={isTemporaryScheduleOpen} onOpenChange={setIsTemporaryScheduleOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Temporary Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Temporary Schedule</DialogTitle>
                <DialogDescription>
                  Create a temporary schedule assignment for a caregiver.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="caregiver">Caregiver *</Label>
                  <Select 
                    value={tempScheduleData.caregiver_id} 
                    onValueChange={(value) => handleTempScheduleInputChange("caregiver_id", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select caregiver" />
                    </SelectTrigger>
                    <SelectContent>
                      {caregivers.map((caregiver) => (
                        <SelectItem key={caregiver.caregiver_id} value={caregiver.caregiver_id}>
                          {caregiver.first_name} {caregiver.last_name} - Current: {caregiver.shift_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input 
                      id="startDate" 
                      type="date"
                      value={tempScheduleData.start_date}
                      onChange={(e) => handleTempScheduleInputChange("start_date", e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input 
                      id="endDate" 
                      type="date"
                      value={tempScheduleData.end_date}
                      onChange={(e) => handleTempScheduleInputChange("end_date", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shiftType">Shift Type *</Label>
                  <Select 
                    value={tempScheduleData.shift_type} 
                    onValueChange={(value) => handleTempScheduleInputChange("shift_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select shift type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day Shift</SelectItem>
                      <SelectItem value="Night">Night Shift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Input 
                    id="reason" 
                    placeholder="e.g., Cover for sick caregiver, Holiday coverage"
                    value={tempScheduleData.reason}
                    onChange={(e) => handleTempScheduleInputChange("reason", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsTemporaryScheduleOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddTemporarySchedule} disabled={addingTemporarySchedule}>
                  {addingTemporarySchedule ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Schedule"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Expired Shifts Alert */}
      {caregivers.filter(hasShiftEnded).length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Clock className="h-5 w-5" />
              Expired Shifts Detected
            </CardTitle>
            <CardDescription className="text-orange-700">
              The following caregivers have expired shifts and need to be rotated to the opposite shift.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {caregivers.filter(hasShiftEnded).map((caregiver) => (
                <div key={caregiver.caregiver_id} className="flex items-center justify-between p-3 bg-white rounded-md border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {caregiver.first_name} {caregiver.last_name}
                    </div>
                    <Badge className={getShiftColor(caregiver.shift_type)} variant="outline">
                      {caregiver.shift_type} Shift
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Ended: {timestampToDate(caregiver.shift_end_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      â†’ Rotate to {getOppositeShift(caregiver.shift_type)} Shift
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => manualRotateCaregiver(caregiver)}
                      disabled={rotatingShifts}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Rotate Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Caregivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.length}</div>
            <p className="text-xs text-muted-foreground">Active caregivers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Day Shift</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.filter(c => c.shift_type === 'Day').length}</div>
            <p className="text-xs text-muted-foreground">7AM - 7PM</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Night Shift</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.filter(c => c.shift_type === 'Night').length}</div>
            <p className="text-xs text-muted-foreground">7PM - 7AM</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temporary Schedules</CardTitle>
            <RefreshCw className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {caregivers.filter(c => c.temporary_schedule_reason).length}
            </div>
            <p className="text-xs text-muted-foreground">Active temporary assignments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {caregivers.reduce((total, caregiver) => total + getAvailablePatientSlots(caregiver), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Patient slots available</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Schedule Summary */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setShowTodaySchedules(!showTodaySchedules)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Today's Active Schedules
              </CardTitle>
              <CardDescription>
                Caregivers currently on duty - {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              {showTodaySchedules ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {showTodaySchedules && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              const today = new Date()
              const todayStr = today.toISOString().split('T')[0]
              const activeToday = caregivers.filter(caregiver => hasShiftOnDate(caregiver, today))
              
              console.log(`ðŸ“… Today's Active Schedules (${todayStr}):`)
              console.log(`   Total caregivers: ${caregivers.length}`)
              console.log(`   Active today: ${activeToday.length}`)
              console.log(`   Total shifts loaded: ${caregiverShifts.length}`)
              console.log(`   Today's shifts: ${caregiverShifts.filter(s => timestampToDate(s.shift_date) === todayStr).length}`)
              
              return activeToday.length === 0 ? (
                <div className="col-span-2 text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No active schedules today</p>
                  <p className="text-sm text-muted-foreground mt-2">No caregivers are scheduled to work today</p>
                </div>
              ) : (
                activeToday
                  .sort((a, b) => {
                    // First sort by shift type (Day first, then Night)
                    if (a.shift_type !== b.shift_type) {
                      return a.shift_type === 'Day' ? -1 : 1
                    }
                    // Then sort alphabetically by name
                    const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
                    const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
                    return nameA.localeCompare(nameB)
                  })
                .map((caregiver) => {
                  const assignedPatients = getAssignedPatients(caregiver.caregiver_id, caregiver.shift_type)
                  return (
                    <Card 
                      key={caregiver.caregiver_id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedCaregiversForCalendar.includes(caregiver.caregiver_id)
                          ? 'ring-2 ring-primary border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => {
                        setSelectedCaregiversForCalendar(prev => {
                          if (prev.includes(caregiver.caregiver_id)) {
                            // Remove caregiver if already selected
                            return prev.filter(id => id !== caregiver.caregiver_id)
                          } else {
                            // Add caregiver to selection
                            return [...prev, caregiver.caregiver_id]
                          }
                        })
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-medium">
                            {caregiver.first_name} {caregiver.last_name}
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getShiftColor(caregiver.shift_type)} variant="outline">
                              {caregiver.shift_type} - {getShiftTimes(caregiver.shift_type)}
                            </Badge>
                            {loadingAvailability ? (
                              <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                                Checking...
                              </Badge>
                            ) : caregiverAvailability[caregiver.caregiver_id] ? (
                              getAvailabilityBadge(caregiverAvailability[caregiver.caregiver_id])
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800 border-gray-300">
                                Unknown
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {caregiver.contact_number}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3" />
                            {assignedPatients.length} of {caregiver.max_patients || getMaxPatientsForShift(caregiver.shift_type)} patients assigned
                          </div>
                          {assignedPatients.length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs font-medium mb-1">Assigned Patients:</div>
                              <div className="flex flex-wrap gap-1">
                                {assignedPatients.map((patient, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {patient.first_name} {patient.last_name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )
            })()}
          </div>
        </CardContent>
        )}
      </Card>

      {/* Weekly Schedule Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-lg font-semibold">
                {weekDates[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <Button variant="outline" size="sm" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Week of {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="space-y-4">
            {/* NEW: Caregiver List */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-foreground">Caregivers - Select to View Calendar</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select
                    value=""
                    onValueChange={(caregiverId) => {
                      if (caregiverId && !selectedCaregiversForCalendar.includes(caregiverId)) {
                        setSelectedCaregiversForCalendar(prev => [...prev, caregiverId])
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a caregiver to view their calendar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCaregivers.length === 0 ? (
                        <SelectItem value="no-caregivers" disabled>
                          {selectedShift === 'all' 
                            ? "No caregivers are currently registered" 
                            : `No caregivers found for ${selectedShift} shift`}
                        </SelectItem>
                      ) : (
                        filteredCaregivers
                          .sort((a, b) => {
                            if (a.shift_type !== b.shift_type) {
                              return a.shift_type === 'Day' ? -1 : 1
                            }
                            const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
                            const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
                            return nameA.localeCompare(nameB)
                          })
                          .map((caregiver) => (
                            <SelectItem 
                              key={caregiver.caregiver_id} 
                              value={caregiver.caregiver_id}
                              disabled={selectedCaregiversForCalendar.includes(caregiver.caregiver_id)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span>
                                  {caregiver.first_name} {caregiver.last_name}
                                </span>
                                <Badge 
                                  variant={caregiver.shift_type === 'Day' ? 'default' : 'secondary'}
                                  className="text-xs ml-2"
                                >
                                  {caregiver.shift_type}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedCaregiversForCalendar.length > 0 && (
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedCaregiversForCalendar([])}
                    className="shrink-0"
                  >
                    Clear All ({selectedCaregiversForCalendar.length})
                  </Button>
                )}
              </div>
              
              {/* Show selected caregivers as badges */}
              {selectedCaregiversForCalendar.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Selected Caregivers ({selectedCaregiversForCalendar.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCaregiversForCalendar.map(caregiverId => {
                      const caregiver = filteredCaregivers.find(c => c.caregiver_id === caregiverId)
                      if (!caregiver) return null
                      
                      return (
                        <Badge 
                          key={caregiverId}
                          variant="secondary" 
                          className="flex items-center gap-2 px-3 py-1"
                        >
                          <span>{caregiver.first_name} {caregiver.last_name}</span>
                          <Badge 
                            variant={caregiver.shift_type === 'Day' ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {caregiver.shift_type}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => {
                              setSelectedCaregiversForCalendar(prev => 
                                prev.filter(id => id !== caregiverId)
                              )
                            }}
                          >
                            ×
                          </Button>
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
                {filteredCaregivers.length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">
                      No caregivers found
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {selectedShift === 'all' 
                        ? "No caregivers are currently registered" 
                        : `No caregivers found for ${selectedShift} shift`}
                    </p>
                  </div>
                ) : (
                  filteredCaregivers
                    .sort((a, b) => {
                      if (a.shift_type !== b.shift_type) {
                        return a.shift_type === 'Day' ? -1 : 1
                      }
                      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
                      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
                      return nameA.localeCompare(nameB)
                    })
                    .map((caregiver) => (
                      <Card 
                        key={caregiver.caregiver_id} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedCaregiversForCalendar.includes(caregiver.caregiver_id)
                            ? 'ring-2 ring-primary border-primary bg-primary/5' 
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedCaregiversForCalendar(prev => {
                            if (prev.includes(caregiver.caregiver_id)) {
                              // Remove caregiver if already selected
                              return prev.filter(id => id !== caregiver.caregiver_id)
                            } else {
                              // Add caregiver to selection
                              return [...prev, caregiver.caregiver_id]
                            }
                          })
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-base">
                                {caregiver.first_name} {caregiver.last_name}
                              </div>
                              <Badge 
                                variant={caregiver.shift_type === 'Day' ? 'default' : 'secondary'}
                                className="text-sm"
                              >
                                {caregiver.shift_type}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {selectedCaregiversForCalendar.includes(caregiver.caregiver_id) 
                                ? 'ðŸ“… Calendar shown below' 
                                : 'Click to show calendar'
                              }
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            </div>

            {/* NEW: Multiple Selected Caregivers Calendars */}
            {selectedCaregiversForCalendar.length > 0 && (
              <div className="space-y-6 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                    📅 Calendars ({selectedCaregiversForCalendar.length} selected)
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedCaregiversForCalendar([])}
                  >
                    Hide All Calendars
                  </Button>
                </div>
                
                {selectedCaregiversForCalendar.map(caregiverId => {
                  const selectedCaregiver = filteredCaregivers.find(c => c.caregiver_id === caregiverId)
                  if (!selectedCaregiver) return null
                  
                  return (
                    <div key={caregiverId} className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">
                       Calendar for {selectedCaregiver.first_name} {selectedCaregiver.last_name}
                    </h3>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedCaregiversForCalendar([])}
                    >
                      Hide Calendar
                    </Button>
                  </div>
                  
                  {/* Week Header */}
                  <div className="grid grid-cols-7 gap-4">
                    {weekDates.map((date, index) => (
                      <div key={index} className="text-center">
                        <div className="font-medium text-sm">{formatDate(date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {date.toDateString() === new Date().toDateString() && (
                            <Badge variant="outline" className="text-xs">Today</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Calendar Row for Selected Caregiver */}
                  <div className="grid grid-cols-7 gap-4 py-3 border rounded-lg bg-muted/20">
                    {weekDates.map((date, index) => {
                      const assignedPatients = getAssignedPatients(selectedCaregiver.caregiver_id, selectedCaregiver.shift_type)
                      const isShiftDay = hasShiftOnDate(selectedCaregiver, date)
                      const isShiftExpired = hasShiftEnded(selectedCaregiver)
                      const isTodayLastDay = isLastDayOfShift(selectedCaregiver) && date.toDateString() === new Date().toDateString()
                      
                      return (
                        <div key={index} className="min-h-[120px]">
                          {isShiftDay ? (
                            <div className={`
                              w-full h-full rounded-md p-2 text-xs 
                              ${selectedCaregiver.shift_type === 'Day' 
                                ? 'bg-yellow-100 border border-yellow-300 text-yellow-900' 
                                : 'bg-purple-100 border border-purple-300 text-purple-900'
                              }
                            `}>
                              <div className="font-semibold mb-1">
                                {selectedCaregiver.shift_type} Shift
                              </div>
                              <div className="text-xs opacity-75 mb-2">
                                {getShiftTimes(selectedCaregiver.shift_type)}
                              </div>
                              
                              {/* Patient assignments */}
                              {assignedPatients.length > 0 && !isShiftExpired && (
                                <div className="mt-1 space-y-1">
                                  <div className="text-xs font-medium">Patients:</div>
                                  {assignedPatients.slice(0, 2).map((patient, idx) => (
                                    <div key={idx} className="text-xs bg-white/20 rounded px-1 py-0.5">
                                      {patient.first_name} {patient.last_name.charAt(0)}.
                                    </div>
                                  ))}
                                  {assignedPatients.length > 2 && (
                                    <div className="text-xs opacity-75">
                                      +{assignedPatients.length - 2} more
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* Status badges */}
                              <div className="text-xs space-y-1 mt-2">
                                {isShiftExpired ? (
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-600 text-xs">
                                    Auto-Rotating
                                  </Badge>
                                ) : isTodayLastDay ? (
                                  <Badge className="bg-orange-100 text-orange-800 border-orange-600 text-xs">
                                    Last Day
                                  </Badge>
                                ) : canCaregiverTakeMorePatients(selectedCaregiver) ? (
                                  <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                    Available
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-red-600 border-red-600 text-xs">
                                    Full
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full rounded-md border border-dashed border-gray-300 
                              flex items-center justify-center text-xs text-muted-foreground">
                              Off
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Schedule
