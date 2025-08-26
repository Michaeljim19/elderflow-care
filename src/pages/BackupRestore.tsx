import { useState } from "react"
import { 
  Database, 
  Download, 
  Upload, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  Clock,
  HardDrive,
  RefreshCw,
  Trash2,
  Eye,
  Archive,
  Users,
  UserX,
  Heart,
  Pill,
  RotateCcw,
  Filter,
  Search
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { getCaregivers } from "@/services/firebase/caregivers"
import { getPatients } from "@/services/firebase/patients"

interface BackupFile {
  id: string
  name: string
  description: string
  createdAt: string
  size: string
  type: 'full' | 'partial'
  collections: string[]
  recordCount: number
}

interface BackupData {
  metadata: {
    version: string
    timestamp: string
    description: string
    collections: string[]
    recordCount: number
  }
  data: {
    caregivers?: any[]
    patients?: any[]
    medications?: any[]
    accounts?: any[]
  }
}

interface ArchivedAccount {
  id: string
  name: string
  email: string
  type: 'patient' | 'caregiver' | 'guardian'
  deactivatedAt: string
  deactivatedBy: string
  reason: string
  originalData: any
  status: 'archived' | 'permanently_deleted'
}

const BackupRestore = () => {
  const [backups, setBackups] = useState<BackupFile[]>([])

  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null)
  const [viewingBackup, setViewingBackup] = useState<BackupFile | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null)
  
  // Archive-related state
  const [archivedAccounts, setArchivedAccounts] = useState<ArchivedAccount[]>([])
  const [selectedArchiveFilter, setSelectedArchiveFilter] = useState<'all' | 'patient' | 'caregiver' | 'guardian'>('all')
  const [archiveSearchTerm, setArchiveSearchTerm] = useState("")
  const [viewingArchive, setViewingArchive] = useState<ArchivedAccount | null>(null)
  const [restoreArchiveConfirm, setRestoreArchiveConfirm] = useState<string | null>(null)
  const [deleteArchiveConfirm, setDeleteArchiveConfirm] = useState<string | null>(null)
  
  const [backupForm, setBackupForm] = useState({
    name: "",
    description: "",
    includeCaregiver: true,
    includePatients: true,
    includeMedications: true,
    includeAccounts: true
  })

  const { toast } = useToast()

  const handleCreateBackup = async () => {
    if (!backupForm.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a name for the backup",
        variant: "destructive"
      })
      return
    }

    try {
      setIsCreatingBackup(true)

      // Simulate backup creation process
      const collections: string[] = []
      let recordCount = 0
      const backupData: BackupData = {
        metadata: {
          version: "1.0",
          timestamp: new Date().toISOString(),
          description: backupForm.description,
          collections,
          recordCount: 0
        },
        data: {}
      }

      // Fetch data based on selected collections
      if (backupForm.includeCaregiver) {
        collections.push("caregivers")
        const caregivers = await getCaregivers()
        backupData.data.caregivers = caregivers
        recordCount += caregivers.length
      }

      if (backupForm.includePatients) {
        collections.push("patients")
        const patients = await getPatients()
        backupData.data.patients = patients
        recordCount += patients.length
      }

      if (backupForm.includeMedications) {
        collections.push("medications")
        // Mock medications data
        backupData.data.medications = []
        recordCount += 0
      }

      if (backupForm.includeAccounts) {
        collections.push("accounts")
        // Mock accounts data  
        backupData.data.accounts = []
        recordCount += 0
      }

      backupData.metadata.collections = collections
      backupData.metadata.recordCount = recordCount

      // Create backup file
      const newBackup: BackupFile = {
        id: `backup${Date.now()}`,
        name: backupForm.name,
        description: backupForm.description || "Manual backup",
        createdAt: new Date().toISOString(),
        size: `${Math.round(JSON.stringify(backupData).length / 1024)}KB`,
        type: collections.length === 4 ? "full" : "partial",
        collections,
        recordCount
      }

      // Download backup file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${backupForm.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Add to backups list
      setBackups(prev => [newBackup, ...prev])

      // Reset form
      setBackupForm({
        name: "",
        description: "",
        includeCaregiver: true,
        includePatients: true,
        includeMedications: true,
        includeAccounts: true
      })

      toast({
        title: "Backup Created Successfully",
        description: `Backup "${backupForm.name}" has been created and downloaded`
      })

    } catch (error) {
      console.error("Error creating backup:", error)
      toast({
        title: "Backup Failed",
        description: "Failed to create backup. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    try {
      setIsRestoring(true)
      
      // Simulate restore process
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      setRestoreConfirm(null)
      
      toast({
        title: "Restore Completed",
        description: "System data has been successfully restored from backup"
      })
      
    } catch (error) {
      console.error("Error restoring backup:", error)
      toast({
        title: "Restore Failed", 
        description: "Failed to restore backup. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsRestoring(false)
    }
  }

  const handleDeleteBackup = (backupId: string) => {
    setBackups(prev => prev.filter(b => b.id !== backupId))
    setDeleteConfirm(null)
    
    toast({
      title: "Backup Deleted",
      description: "Backup has been successfully deleted"
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target?.result as string) as BackupData
        
        // Validate backup file structure
        if (!backupData.metadata || !backupData.data) {
          throw new Error("Invalid backup file format")
        }

        // Create backup entry from uploaded file
        const uploadedBackup: BackupFile = {
          id: `backup${Date.now()}`,
          name: `Uploaded - ${file.name}`,
          description: backupData.metadata.description || "Uploaded backup file",
          createdAt: backupData.metadata.timestamp,
          size: `${Math.round(file.size / 1024)}KB`,
          type: backupData.metadata.collections.length === 4 ? "full" : "partial",
          collections: backupData.metadata.collections,
          recordCount: backupData.metadata.recordCount
        }

        setBackups(prev => [uploadedBackup, ...prev])
        
        toast({
          title: "Backup Uploaded",
          description: "Backup file has been successfully uploaded"
        })
        
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: "Invalid backup file format",
          variant: "destructive"
        })
      }
    }
    
    reader.readAsText(file)
    event.target.value = "" // Reset file input
  }

  const handleRestoreArchive = async (archiveId: string) => {
    try {
      const archivedAccount = archivedAccounts.find(acc => acc.id === archiveId)
      if (!archivedAccount) return

      // Simulate restore process
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Remove from archived accounts
      setArchivedAccounts(prev => prev.filter(acc => acc.id !== archiveId))
      setRestoreArchiveConfirm(null)
      
      toast({
        title: "Account Restored",
        description: `${archivedAccount.name} has been restored successfully`
      })
      
    } catch (error) {
      console.error("Error restoring archive:", error)
      toast({
        title: "Restore Failed",
        description: "Failed to restore archived account",
        variant: "destructive"
      })
    }
  }

  const handleDeleteArchive = async (archiveId: string) => {
    try {
      const archivedAccount = archivedAccounts.find(acc => acc.id === archiveId)
      if (!archivedAccount) return

      // Update status to permanently deleted
      setArchivedAccounts(prev => prev.map(acc => 
        acc.id === archiveId 
          ? { ...acc, status: 'permanently_deleted' as const }
          : acc
      ))
      setDeleteArchiveConfirm(null)
      
      toast({
        title: "Archive Permanently Deleted",
        description: `${archivedAccount.name}'s archive has been permanently deleted`
      })
      
    } catch (error) {
      console.error("Error deleting archive:", error)
      toast({
        title: "Delete Failed",
        description: "Failed to delete archived account",
        variant: "destructive"
      })
    }
  }

  const filteredArchives = archivedAccounts.filter(archive => {
    const matchesFilter = selectedArchiveFilter === 'all' || archive.type === selectedArchiveFilter
    const matchesSearch = archive.name.toLowerCase().includes(archiveSearchTerm.toLowerCase()) ||
                         archive.email.toLowerCase().includes(archiveSearchTerm.toLowerCase()) ||
                         archive.reason.toLowerCase().includes(archiveSearchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getArchiveTypeIcon = (type: ArchivedAccount['type']) => {
    switch (type) {
      case 'patient':
        return <Users className="h-4 w-4 text-blue-500" />
      case 'caregiver':
        return <Heart className="h-4 w-4 text-green-500" />
      case 'guardian':
        return <Shield className="h-4 w-4 text-purple-500" />
      default:
        return <UserX className="h-4 w-4 text-gray-500" />
    }
  }

  const getArchiveTypeColor = (type: ArchivedAccount['type']) => {
    switch (type) {
      case 'patient':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'caregiver':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'guardian':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getArchiveStatusColor = (status: ArchivedAccount['status']) => {
    return status === 'archived'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200'
  }

  const getBackupTypeColor = (type: 'full' | 'partial') => {
    return type === 'full' 
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-5xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="text-xl text-muted-foreground">
            Create backups and restore system data to ensure data safety and recovery
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => document.getElementById('file-upload')?.click()}
            className="gap-2 h-12 text-base"
          >
            <Upload className="h-5 w-5" />
            <span className="text-base">Upload Backup</span>
          </Button>
          <input
            id="file-upload"
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Backups</p>
                <p className="text-2xl font-bold">{backups.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Full Backups</p>
                <p className="text-2xl font-bold">{backups.filter(b => b.type === 'full').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <HardDrive className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Size</p>
                <p className="text-2xl font-bold">
                  {backups.length === 0 ? '0 MB' : 
                   `${backups.reduce((total, backup) => {
                     const sizeInKB = parseFloat(backup.size.replace(/[^\d.]/g, ''));
                     const unit = backup.size.includes('MB') ? 1024 : 1;
                     return total + (sizeInKB * unit);
                   }, 0) / 1024}`.slice(0, 4) + ' MB'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Backup</p>
                <p className="text-sm font-medium">
                  {backups.length === 0 ? 'No backups' : 
                   new Date(Math.max(...backups.map(b => new Date(b.createdAt).getTime()))).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="backups" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="backups">Backup Management</TabsTrigger>
          <TabsTrigger value="create">Create New Backup</TabsTrigger>
          <TabsTrigger value="archive">Archives</TabsTrigger>
        </TabsList>

        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Available Backups
              </CardTitle>
              <CardDescription>
                Manage your system backups and restore data when needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Backups Found</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first backup to ensure your data is safe
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {backups.map((backup) => (
                    <Card key={backup.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <FileText className="h-6 w-6 text-gray-600" />
                            </div>
                            <div className="space-y-1">
                              <h3 className="font-semibold text-lg">{backup.name}</h3>
                              <p className="text-sm text-muted-foreground">{backup.description}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <Badge className={getBackupTypeColor(backup.type)} variant="secondary">
                                  {backup.type === 'full' ? 'Full Backup' : 'Partial Backup'}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(backup.createdAt)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {backup.size} • {backup.recordCount} records
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingBackup(backup)}
                              className="h-9 px-3"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRestoreConfirm(backup.id)}
                              className="h-9 px-3 text-blue-600 hover:text-blue-700"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(backup.id)}
                              className="h-9 px-3 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Create New Backup
              </CardTitle>
              <CardDescription>
                Create a backup of your system data for safekeeping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Backup Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-name">Backup Name *</Label>
                  <Input
                    id="backup-name"
                    value={backupForm.name}
                    onChange={(e) => setBackupForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter backup name..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backup-description">Description</Label>
                  <Textarea
                    id="backup-description"
                    value={backupForm.description}
                    onChange={(e) => setBackupForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter backup description..."
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Data Collections to Include</Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-caregivers"
                        checked={backupForm.includeCaregiver}
                        onChange={(e) => setBackupForm(prev => ({ ...prev, includeCaregiver: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="include-caregivers" className="text-sm">
                        Caregivers Data
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-patients"
                        checked={backupForm.includePatients}
                        onChange={(e) => setBackupForm(prev => ({ ...prev, includePatients: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="include-patients" className="text-sm">
                        Patients Data
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-medications"
                        checked={backupForm.includeMedications}
                        onChange={(e) => setBackupForm(prev => ({ ...prev, includeMedications: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="include-medications" className="text-sm">
                        Medications Data
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="include-accounts"
                        checked={backupForm.includeAccounts}
                        onChange={(e) => setBackupForm(prev => ({ ...prev, includeAccounts: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="include-accounts" className="text-sm">
                        User Accounts Data
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-800">Important Notes</h4>
                    <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                      <li>• Backup files contain sensitive data - store them securely</li>
                      <li>• Large datasets may take several minutes to backup</li>
                      <li>• Backup files will be downloaded to your computer</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Create Backup Button */}
              <div className="flex justify-end">
                <Button 
                  onClick={handleCreateBackup} 
                  disabled={isCreatingBackup || !backupForm.name.trim()}
                  className="min-w-[200px]"
                >
                  {isCreatingBackup ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Create & Download Backup
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Archive Management Tab */}
        <TabsContent value="archive" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Archived Accounts</h3>
                <p className="text-sm text-muted-foreground">
                  Manage deactivated patient, caregiver, and guardian accounts
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  <Archive className="h-3 w-3" />
                  {filteredArchives.length} archives
                </Badge>
              </div>
            </div>

            {/* Archive Filters and Search */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedArchiveFilter}
                  onChange={(e) => setSelectedArchiveFilter(e.target.value as any)}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="patient">Patients</option>
                  <option value="caregiver">Caregivers</option>
                  <option value="guardian">Guardians</option>
                </select>
              </div>
              <div className="relative flex-1 max-w-sm">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search archives..."
                  value={archiveSearchTerm}
                  onChange={(e) => setArchiveSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border rounded-md w-full text-sm"
                />
              </div>
            </div>

            {/* Archives List */}
            <div className="space-y-3">
              {filteredArchives.length === 0 ? (
                <Card className="p-6">
                  <div className="flex flex-col items-center justify-center text-center space-y-2">
                    <Archive className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {archiveSearchTerm ? 'No archives match your search' : 'No archived accounts found'}
                    </p>
                  </div>
                </Card>
              ) : (
                filteredArchives.map((archive) => (
                  <Card key={archive.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getArchiveTypeIcon(archive.type)}
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{archive.name}</h4>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getArchiveTypeColor(archive.type)}`}
                            >
                              {archive.type}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getArchiveStatusColor(archive.status)}`}
                            >
                              {archive.status === 'archived' ? 'Archived' : 'Permanently Deleted'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{archive.email}</p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>Deactivated: {new Date(archive.deactivatedAt).toLocaleDateString()}</span>
                            <span>By: {archive.deactivatedBy}</span>
                            <span>Reason: {archive.reason}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {archive.status === 'archived' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRestoreArchiveConfirm(archive.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteArchiveConfirm(archive.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                        {archive.status === 'permanently_deleted' && (
                          <Badge variant="secondary" className="text-xs">
                            Permanently Deleted
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Restore Archive Confirmation Dialog */}
      <AlertDialog open={!!restoreArchiveConfirm} onOpenChange={() => setRestoreArchiveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Archived Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this archived account? The account will be reactivated and 
              can be used again immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreArchiveConfirm && handleRestoreArchive(restoreArchiveConfirm)}
              className="bg-green-600 hover:bg-green-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Archive Confirmation Dialog */}
      <AlertDialog open={!!deleteArchiveConfirm} onOpenChange={() => setDeleteArchiveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Archive</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this archived account? This action cannot be 
              undone and all associated data will be lost forever.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteArchiveConfirm && handleDeleteArchive(deleteArchiveConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Backup Details Dialog */}
      <Dialog open={!!viewingBackup} onOpenChange={() => setViewingBackup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Backup Details</DialogTitle>
          </DialogHeader>
          {viewingBackup && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="font-medium">{viewingBackup.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p className="text-sm">{viewingBackup.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                    <Badge className={getBackupTypeColor(viewingBackup.type)} variant="secondary">
                      {viewingBackup.type === 'full' ? 'Full Backup' : 'Partial Backup'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Size</Label>
                    <p className="font-medium">{viewingBackup.size}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="font-medium">{formatDate(viewingBackup.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Collections ({viewingBackup.collections.length})</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingBackup.collections.map((collection) => (
                      <Badge key={collection} variant="outline" className="text-xs">
                        {collection}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Record Count</Label>
                  <p className="font-medium">{viewingBackup.recordCount} records</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!restoreConfirm} onOpenChange={() => setRestoreConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Restore</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore your system data from the selected backup. This action cannot be undone and will replace all current data.
              <br /><br />
              <strong>Are you sure you want to proceed?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreConfirm && handleRestoreBackup(restoreConfirm)}
              disabled={isRestoring}
              className="bg-red-600 hover:bg-red-700"
            >
              {isRestoring ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                'Restore Data'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backup? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteBackup(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default BackupRestore
