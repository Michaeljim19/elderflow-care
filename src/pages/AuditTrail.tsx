import { useEffect, useMemo, useState } from "react"
import { orderBy, collection, getDocs, onSnapshot, query, Timestamp } from "firebase/firestore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/lib/firebase"
import { AlertCircle, ClipboardList, Loader2, RefreshCw, Search } from "lucide-react"

type AuditTrailRecord = {
  id: string
  action?: string
  caregiverId?: string
  caregiverName?: string
  createdAt?: Timestamp | Date | string | number | { toDate?: () => Date }
  details?: Record<string, unknown>
  entityId?: string
  entityName?: string
  entityType?: string
  patientIds?: string[]
  patientNames?: string[]
}

type FilterValue = "all" | "handover_report" | "reminder" | "music"

const entityTypeLabels: Record<string, string> = {
  handover_report: "Handover Report",
  reminder: "Reminder",
  music: "Music",
}

const actionLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
}

const auditTrailCollection = collection(db, "audit_trail")

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toDate = (value: AuditTrailRecord["createdAt"]): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === "number") return new Date(value)
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

const formatDateTime = (value: AuditTrailRecord["createdAt"]): string => {
  const date = toDate(value)
  return date ? date.toLocaleString() : "Unknown time"
}

const formatList = (items?: string[]): string => {
  if (!items || items.length === 0) return "Not specified"
  return items.join(", ")
}

const getEntityLabel = (entityType?: string): string => {
  if (!entityType) return "Record"
  return entityTypeLabels[entityType] || entityType.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

const getActionLabel = (action?: string, entityType?: string): string => {
  if (!action) return "Updated"
  if (action.toLowerCase() === "create" && entityType === "music") return "Uploaded"
  return actionLabels[action.toLowerCase()] || action.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

const getActionBadgeVariant = (action?: string): "default" | "secondary" | "destructive" | "outline" => {
  if (!action) return "secondary"
  const actionLower = action.toLowerCase()
  
  if (actionLower === "create" || actionLower === "login") return "default"
  if (actionLower === "update") return "secondary"
  if (actionLower === "delete" || actionLower === "logout") return "destructive"
  
  return "secondary"
}

const getDetailValue = (details: Record<string, unknown> | undefined, key: string): string | undefined => {
  if (!details) return undefined
  const value = details[key]
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  return undefined
}

const formatNotificationTimes = (details?: Record<string, unknown>): string | undefined => {
  const notificationTimes = details?.notificationTimes
  if (!Array.isArray(notificationTimes) || notificationTimes.length === 0) return undefined

  const times = notificationTimes
    .map((item) => {
      if (!isRecord(item)) return null
      const hour = item.hour
      const minute = item.minute
      if (typeof hour !== "number" || typeof minute !== "number") return null
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    })
    .filter((value): value is string => Boolean(value))

  return times.length > 0 ? times.join(", ") : undefined
}

const getActivityData = (record: AuditTrailRecord): {
  primaryLabel: string
  secondaryLabel: string
  metadata: string[]
} => {
  const caregiver = record.caregiverName || "Unknown caregiver"
  const patientNames = formatList(record.patientNames)
  const entityLabel = getEntityLabel(record.entityType)
  const metadata: string[] = []

  if (record.action?.toLowerCase() === "login") {
    return {
      primaryLabel: "Login",
      secondaryLabel: caregiver,
      metadata: []
    }
  }

  if (record.action?.toLowerCase() === "logout") {
    return {
      primaryLabel: "Logout",
      secondaryLabel: caregiver,
      metadata: []
    }
  }

  if (record.entityType === "handover_report") {
    const status = getDetailValue(record.details, "status")
    const priority = getDetailValue(record.details, "priority")
    const shiftType = getDetailValue(record.details, "shiftType")
    
    if (status) metadata.push(status)
    if (priority) metadata.push(priority)
    if (shiftType) metadata.push(shiftType)

    return {
      primaryLabel: entityLabel,
      secondaryLabel: patientNames !== "Not specified" ? `${caregiver} → ${patientNames}` : caregiver,
      metadata
    }
  }

  if (record.entityType === "reminder") {
    const reminderType = getDetailValue(record.details, "reminderType")
    const frequency = getDetailValue(record.details, "frequency")
    const notificationTimes = formatNotificationTimes(record.details)
    
    if (reminderType) metadata.push(reminderType)
    if (frequency) metadata.push(frequency)
    if (notificationTimes) metadata.push(`Times: ${notificationTimes}`)

    return {
      primaryLabel: entityLabel,
      secondaryLabel: caregiver,
      metadata
    }
  }

  if (record.entityType === "music") {
    const composer = getDetailValue(record.details, "composer")
    
    return {
      primaryLabel: entityLabel,
      secondaryLabel: caregiver,
      metadata: composer ? [composer] : []
    }
  }

  return {
    primaryLabel: entityLabel,
    secondaryLabel: caregiver,
    metadata: []
  }
}

const buildSummary = (record: AuditTrailRecord): string => {
  const actionLabel = getActionLabel(record.action, record.entityType).toLowerCase()
  const caregiver = record.caregiverName || "A caregiver"
  const patientNames = formatList(record.patientNames)
  const entityName = record.entityName || "this item"

  if (record.action?.toLowerCase() === "login") {
    return `${caregiver} logged in`
  }

  if (record.action?.toLowerCase() === "logout") {
    return `${caregiver} logged out`
  }

  if (record.entityType === "handover_report") {
    const status = getDetailValue(record.details, "status")
    const priority = getDetailValue(record.details, "priority")
    const shiftType = getDetailValue(record.details, "shiftType")
    const base = `${caregiver} ${actionLabel} a handover report for ${patientNames !== "Not specified" ? patientNames : entityName}`
    const context = [status, priority, shiftType].filter(Boolean).join(" • ")
    return context ? `${base} (${context})` : base
  }

  if (record.entityType === "reminder") {
    const reminderType = getDetailValue(record.details, "reminderType")
    const frequency = getDetailValue(record.details, "frequency")
    const notificationTimes = formatNotificationTimes(record.details)
    const base = `${caregiver} ${actionLabel} reminder "${entityName}" for ${patientNames !== "Not specified" ? patientNames : "assigned patients"}`
    const context = [reminderType, frequency, notificationTimes].filter(Boolean).join(" • ")
    return context ? `${base} (${context})` : base
  }

  if (record.entityType === "music") {
    const composer = getDetailValue(record.details, "composer")
    const base = `${caregiver} ${actionLabel} music "${entityName}" for ${patientNames !== "Not specified" ? patientNames : "assigned patients"}`
    return composer ? `${base} (Composer: ${composer})` : base
  }

  return `${caregiver} ${actionLabel} ${getEntityLabel(record.entityType).toLowerCase()} ${entityName}`
}

const getContextBadges = (record: AuditTrailRecord): string[] => {
  const badges = new Set<string>()
  const details = record.details || {}

  const add = (value?: string) => {
    if (value) badges.add(value)
  }

  add(record.entityType ? getEntityLabel(record.entityType) : undefined)
  add(record.action ? getActionLabel(record.action, record.entityType) : undefined)
  add(getDetailValue(details, "status"))
  add(getDetailValue(details, "priority"))
  add(getDetailValue(details, "shiftType"))
  add(getDetailValue(details, "frequency"))
  add(getDetailValue(details, "reminderType"))
  add(getDetailValue(details, "composer"))

  const notificationTimes = formatNotificationTimes(details)
  add(notificationTimes ? `Times: ${notificationTimes}` : undefined)

  return Array.from(badges)
}

const AuditTrail = () => {
  const [records, setRecords] = useState<AuditTrailRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [entityFilter, setEntityFilter] = useState<FilterValue>("all")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [selectedRecord, setSelectedRecord] = useState<AuditTrailRecord | null>(null)

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)

      const snapshot = await getDocs(query(auditTrailCollection, orderBy("createdAt", "desc")))
      const mappedRecords = snapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<AuditTrailRecord, "id">),
      }))

      setRecords(mappedRecords)
    } catch (loadError) {
      console.error("Failed to load audit trail:", loadError)
      setError("Unable to load the audit trail right now.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    setError(null)

    const unsubscribe = onSnapshot(
      query(auditTrailCollection, orderBy("createdAt", "desc")),
      (snapshot) => {
        const mappedRecords = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Omit<AuditTrailRecord, "id">),
        }))
        setRecords(mappedRecords)
        setLoading(false)
      },
      (error) => {
        console.error("Failed to load audit trail:", error)
        setError("Unable to load the audit trail right now.")
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()

    return records.filter((record) => {
      const matchesEntity = entityFilter === "all" || record.entityType === entityFilter
      const matchesAction = actionFilter === "all" || record.action?.toLowerCase() === actionFilter
      const haystack = [
        record.caregiverName,
        record.entityName,
        record.entityType,
        record.action,
        record.patientNames?.join(" "),
        record.patientIds?.join(" "),
        JSON.stringify(record.details || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      const matchesSearch = !search || haystack.includes(search)
      return matchesEntity && matchesAction && matchesSearch
    })
  }, [actionFilter, entityFilter, records, searchTerm])

  return (
    <div className="space-y-6 p-6">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">Audit Trail</CardTitle>
              <CardDescription>
                Activity synced from the CARE app. Entries are read-only and organized by the action and content of each record.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search caregiver, patient, entity, or details"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Select value={entityFilter} onValueChange={(value) => setEntityFilter(value as FilterValue)}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  <SelectItem value="handover_report">Handover Reports</SelectItem>
                  <SelectItem value="reminder">Reminders</SelectItem>
                  <SelectItem value="music">Music</SelectItem>
                </SelectContent>
              </Select>

              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div>
              Showing {filteredRecords.length} of {records.length} records
            </div>
            <Button variant="outline" size="sm" onClick={loadRecords} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-8 py-4">Action</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="px-6 py-4">Created</TableHead>
                  <TableHead className="text-right px-8 py-4">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16 text-center text-muted-foreground">
                      <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                      Loading audit trail...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16 text-center text-muted-foreground">
                      No audit trail entries match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const activityData = getActivityData(record)
                    return (
                      <TableRow key={record.id} className="align-top">
                        <TableCell className=" px-6 py-4">
                          <Badge variant={getActionBadgeVariant(record.action)}>{getActionLabel(record.action, record.entityType)}</Badge>
                        </TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-sm">{activityData.primaryLabel}</div>
                            <div className="text-xs text-muted-foreground">{activityData.secondaryLabel}</div>
                            {activityData.metadata.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {activityData.metadata.map((meta, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs font-normal">
                                    {meta}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm px-6 py-4">
                          {formatDateTime(record.createdAt)}
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(record)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRecord)} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedRecord ? buildSummary(selectedRecord) : "Audit trail details"}</DialogTitle>
            <DialogDescription>
              {selectedRecord ? `${getEntityLabel(selectedRecord.entityType)} • ${formatDateTime(selectedRecord.createdAt)}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-6 text-sm">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div><span className="font-medium">Action:</span> {getActionLabel(selectedRecord.action, selectedRecord.entityType)}</div>
                    <div><span className="font-medium">Entity:</span> {getEntityLabel(selectedRecord.entityType)}</div>
                    <div><span className="font-medium">Entity name:</span> {selectedRecord.entityName || "Not specified"}</div>
                    <div><span className="font-medium">Entity ID:</span> <span className="break-all">{selectedRecord.entityId || "Not specified"}</span></div>
                    <div><span className="font-medium">Created:</span> {formatDateTime(selectedRecord.createdAt)}</div>
                    <div><span className="font-medium">Caregiver:</span> {selectedRecord.caregiverName || "Unknown caregiver"}</div>
                    <div><span className="font-medium">Caregiver ID:</span> <span className="break-all">{selectedRecord.caregiverId || "Not specified"}</span></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Participants</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div><span className="font-medium">Patients:</span> {formatList(selectedRecord.patientNames)}</div>
                    <div><span className="font-medium">Patient IDs:</span> <span className="break-all">{formatList(selectedRecord.patientIds)}</span></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AuditTrail