import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Clock, 
  User, 
  Heart, 
  AlertCircle, 
  CheckCircle, 
  Plus,
  Calendar,
  Users,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Activity,
  Thermometer,
  Pill,
  Utensils,
  MessageSquare,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getHandoverReports, 
  addHandoverReport, 
  updateHandoverReport,
  deleteHandoverReport,
  getReportsByStatus,
  getTodaysReports,
  getReportsByShiftType,
  type HandoverReport 
} from '@/services/firebase/handoverReports';
import { getPatients } from '@/services/firebase/patients';
import { getCaregivers } from '@/services/firebase/caregivers';
import { Patient, Caregiver } from '@/types';

// Mock data - replace with actual API calls
const mockReports = [
  {
    id: 1,
    patient_id: "P001",
    patient_name: "Margaret Johnson",
    caregiver_id: "C001",
    caregiver_name: "Sarah Wilson",
    shift_type: "Day",
    shift_date: "2025-01-31",
    shift_start: "07:00",
    shift_end: "19:00",
    handover_time: "18:45",
    vital_signs: {
      blood_pressure: "120/80",
      heart_rate: "78",
      temperature: "98.6°F",
      oxygen_saturation: "98%"
    },
    medications_given: [
      { name: "Lisinopril 10mg", time: "08:00", status: "Given" },
      { name: "Metformin 500mg", time: "12:00", status: "Given" },
      { name: "Vitamin D", time: "08:00", status: "Refused" }
    ],
    meals: {
      breakfast: "Ate 75% - enjoyed oatmeal and fruit",
      lunch: "Ate 50% - poor appetite today",
      dinner: "Not applicable (day shift)"
    },
    activities: "Assisted with morning shower, participated in chair exercises, watched TV in living room",
    behavioral_notes: "Patient was in good spirits, complained of mild knee pain around 2 PM, applied heat pack as ordered",
    concerns: "Decreased appetite at lunch, monitor food intake",
    instructions_for_next_shift: "Please encourage fluid intake, patient prefers room temperature water. Check on knee pain - may need PRN pain medication if continues.",
    status: "Normal",
    priority: "Medium",
    created_at: "2025-01-31T18:45:00Z"
  },
  {
    id: 2,
    patient_id: "P002",
    patient_name: "Robert Davis",
    caregiver_id: "C002",
    caregiver_name: "Michael Chen",
    shift_type: "Night",
    shift_date: "2025-01-30",
    shift_start: "19:00",
    shift_end: "07:00",
    handover_time: "06:45",
    vital_signs: {
      blood_pressure: "140/90",
      heart_rate: "82",
      temperature: "99.1°F",
      oxygen_saturation: "96%"
    },
    medications_given: [
      { name: "Atorvastatin 20mg", time: "21:00", status: "Given" },
      { name: "Melatonin 3mg", time: "22:00", status: "Given" }
    ],
    meals: {
      breakfast: "Not applicable (night shift)",
      lunch: "Not applicable (night shift)",
      dinner: "Ate well before shift started"
    },
    activities: "Assisted to bathroom twice during night, slept well from 23:00 to 05:30",
    behavioral_notes: "Patient reported difficulty breathing around 2 AM, administered oxygen for 30 minutes per protocol",
    concerns: "Elevated blood pressure and slight fever - contacted on-call nurse",
    instructions_for_next_shift: "Monitor vital signs closely, especially BP and temperature. Patient may need doctor visit if fever persists.",
    status: "Needs Attention",
    priority: "High",
    created_at: "2025-01-30T06:45:00Z"
  }
];

const PatientHandoverReports = () => {
  const [reports, setReports] = useState<HandoverReport[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [selectedReport, setSelectedReport] = useState<HandoverReport | null>(null);
  const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
  const [isViewReportOpen, setIsViewReportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterShift, setFilterShift] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  
  const { userData } = useAuth();
  const { toast } = useToast();

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsData, patientsData, caregiversData] = await Promise.all([
        getHandoverReports(),
        getPatients(),
        getCaregivers()
      ]);
      
      setReports(reportsData);
      setPatients(patientsData);
      setCaregivers(caregiversData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load handover reports data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // New report form data type
  interface NewReportForm {
    patient_id: string;
    patient_name: string;
    caregiver_id: string;
    caregiver_name: string;
    shift_type: "Day" | "Night" | "";
    shift_date: string;
    shift_start: string;
    shift_end: string;
    handover_time: string;
    vital_signs: {
      blood_pressure: string;
      heart_rate: string;
      temperature: string;
      oxygen_saturation: string;
    };
    medications_given: Array<{
      name: string;
      time: string;
      status: 'Given' | 'Refused' | 'Missed';
    }>;
    meals: {
      breakfast: string;
      lunch: string;
      dinner: string;
    };
    activities: string;
    behavioral_notes: string;
    concerns: string;
    instructions_for_next_shift: string;
    status: "Normal" | "Needs Attention" | "Critical";
    priority: "Low" | "Medium" | "High";
  }

  const [newReport, setNewReport] = useState<NewReportForm>({
    patient_id: "",
    patient_name: "",
    caregiver_id: "",
    caregiver_name: "",
    shift_type: "",
    shift_date: new Date().toISOString().split('T')[0],
    shift_start: "",
    shift_end: "",
    handover_time: "",
    vital_signs: {
      blood_pressure: "",
      heart_rate: "",
      temperature: "",
      oxygen_saturation: ""
    },
    medications_given: [],
    meals: {
      breakfast: "",
      lunch: "",
      dinner: ""
    },
    activities: "",
    behavioral_notes: "",
    concerns: "",
    instructions_for_next_shift: "",
    status: "Normal",
    priority: "Low"
  });

  const filteredReports = reports.filter(report => {
    const matchesSearch = (report.patient_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (report.caregiver_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesShift = filterShift === "all" || report.shift_type === filterShift;
    const matchesStatus = filterStatus === "all" || report.status === filterStatus;
    
    return matchesSearch && matchesShift && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Normal':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Needs Attention':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Medium':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'High':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewReport = (report) => {
    setSelectedReport(report);
    setIsViewReportOpen(true);
  };

  const handleCreateReport = async () => {
    try {
      setLoading(true);
      
      // Get selected patient and caregiver details
      const selectedPatient = patients.find(p => p.patient_id === newReport.patient_id);
      const selectedCaregiver = caregivers.find(c => c.caregiver_id === newReport.caregiver_id);
      
      if (!selectedPatient || !selectedCaregiver) {
        toast({
          title: "Error",
          description: "Please select both patient and caregiver",
          variant: "destructive"
        });
        return;
      }

      const reportData: Omit<HandoverReport, 'id'> = {
        patient_id: newReport.patient_id,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        caregiver_id: newReport.caregiver_id,
        caregiver_name: `${selectedCaregiver.first_name} ${selectedCaregiver.last_name}`,
        shift_type: newReport.shift_type as "Day" | "Night",
        shift_date: newReport.shift_date,
        shift_start: newReport.shift_start,
        shift_end: newReport.shift_end,
        handover_time: newReport.handover_time || new Date().toTimeString().split(' ')[0].slice(0, 5),
        vital_signs: newReport.vital_signs,
        medications_given: newReport.medications_given,
        meals: newReport.meals,
        activities: newReport.activities,
        behavioral_notes: newReport.behavioral_notes,
        concerns: newReport.concerns,
        instructions_for_next_shift: newReport.instructions_for_next_shift,
        status: newReport.status as "Normal" | "Needs Attention" | "Critical",
        priority: newReport.priority as "Low" | "Medium" | "High",
        created_at: null, // Will be set by the service
        updated_at: null  // Will be set by the service
      };
      
      const reportId = await addHandoverReport(reportData);
      
      toast({
        title: "Success",
        description: "Handover report created successfully"
      });
      
      // Reload reports to get the updated list
      await loadData();
      setIsCreateReportOpen(false);
      
      // Reset form
      setNewReport({
        patient_id: "",
        patient_name: "",
        caregiver_id: "",
        caregiver_name: "",
        shift_type: "",
        shift_date: new Date().toISOString().split('T')[0],
        shift_start: "",
        shift_end: "",
        handover_time: "",
        vital_signs: {
          blood_pressure: "",
          heart_rate: "",
          temperature: "",
          oxygen_saturation: ""
        },
        medications_given: [],
        meals: {
          breakfast: "",
          lunch: "",
          dinner: ""
        },
        activities: "",
        behavioral_notes: "",
        concerns: "",
        instructions_for_next_shift: "",
        status: "Normal",
        priority: "Low"
      });
      
    } catch (error) {
      console.error('Error creating handover report:', error);
      toast({
        title: "Error",
        description: "Failed to create handover report",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string, reportPatientName: string) => {
    try {
      await deleteHandoverReport(reportId);
      
      toast({
        title: "Success",
        description: `Handover report for ${reportPatientName} has been deleted`
      });
      
      // Reload reports to get the updated list
      await loadData();
    } catch (error) {
      console.error('Error deleting handover report:', error);
      toast({
        title: "Error",
        description: "Failed to delete handover report",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 text-foreground dark:bg-background">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="mb-2 text-5xl font-bold text-foreground md:text-6xl dark:text-white">
              Patient Handover Reports
            </h1>
            <p className="text-xl text-muted-foreground dark:text-slate-300">
              Seamless care transitions between caregivers
            </p>
          </div>
          <Dialog open={isCreateReportOpen} onOpenChange={setIsCreateReportOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-12 text-base">
                <Plus className="h-5 w-5" />
                <span className="text-base">New Handover Report</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Handover Report</DialogTitle>
                <DialogDescription>
                  Document your shift activities and patient status for the next caregiver
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient">Patient</Label>
                    <Select value={newReport.patient_id} onValueChange={(value) => setNewReport(prev => ({ ...prev, patient_id: value }))}>
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
                  <div className="space-y-2">
                    <Label htmlFor="caregiver">Caregiver</Label>
                    <Select value={newReport.caregiver_id} onValueChange={(value) => setNewReport(prev => ({ ...prev, caregiver_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select caregiver" />
                      </SelectTrigger>
                      <SelectContent>
                        {caregivers.map((caregiver) => (
                          <SelectItem key={caregiver.caregiver_id} value={caregiver.caregiver_id}>
                            {caregiver.first_name} {caregiver.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shift_type">Shift Type</Label>
                    <Select value={newReport.shift_type} onValueChange={(value) => setNewReport(prev => ({ ...prev, shift_type: value as "Day" | "Night" | "" }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select shift" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Day">Day Shift (7AM - 7PM)</SelectItem>
                        <SelectItem value="Night">Night Shift (7PM - 7AM)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shift_date">Shift Date</Label>
                    <Input
                      type="date"
                      value={newReport.shift_date}
                      onChange={(e) => setNewReport(prev => ({ ...prev, shift_date: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Vital Signs */}
                <Card className="border-border bg-card shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Thermometer className="h-5 w-5" />
                      Vital Signs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bp">Blood Pressure</Label>
                        <Input 
                          id="bp"
                          placeholder="120/80"
                          value={newReport.vital_signs.blood_pressure}
                          onChange={(e) => setNewReport(prev => ({
                            ...prev,
                            vital_signs: { ...prev.vital_signs, blood_pressure: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hr">Heart Rate</Label>
                        <Input 
                          id="hr"
                          placeholder="78 bpm"
                          value={newReport.vital_signs.heart_rate}
                          onChange={(e) => setNewReport(prev => ({
                            ...prev,
                            vital_signs: { ...prev.vital_signs, heart_rate: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="temp">Temperature</Label>
                        <Input 
                          id="temp"
                          placeholder="98.6°F"
                          value={newReport.vital_signs.temperature}
                          onChange={(e) => setNewReport(prev => ({
                            ...prev,
                            vital_signs: { ...prev.vital_signs, temperature: e.target.value }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="o2">Oxygen Saturation</Label>
                        <Input 
                          id="o2"
                          placeholder="98%"
                          value={newReport.vital_signs.oxygen_saturation}
                          onChange={(e) => setNewReport(prev => ({
                            ...prev,
                            vital_signs: { ...prev.vital_signs, oxygen_saturation: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Activities & Care */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="activities">Activities & Care Provided</Label>
                    <Textarea
                      id="activities"
                      placeholder="Describe activities, personal care, mobility assistance, etc."
                      value={newReport.activities}
                      onChange={(e) => setNewReport(prev => ({ ...prev, activities: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="behavioral">Behavioral Notes</Label>
                    <Textarea
                      id="behavioral"
                      placeholder="Patient mood, behavior, communication, any concerns..."
                      value={newReport.behavioral_notes}
                      onChange={(e) => setNewReport(prev => ({ ...prev, behavioral_notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Concerns & Instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="concerns">Concerns / Issues</Label>
                    <Textarea
                      id="concerns"
                      placeholder="Any health concerns, incidents, or issues to monitor..."
                      value={newReport.concerns}
                      onChange={(e) => setNewReport(prev => ({ ...prev, concerns: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="instructions">Instructions for Next Shift</Label>
                    <Textarea
                      id="instructions"
                      placeholder="Specific instructions, follow-up tasks, things to monitor..."
                      value={newReport.instructions_for_next_shift}
                      onChange={(e) => setNewReport(prev => ({ ...prev, instructions_for_next_shift: e.target.value }))}
                      rows={4}
                    />
                  </div>
                </div>

                {/* Status & Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Patient Status</Label>
                    <Select value={newReport.status} onValueChange={(value) => setNewReport(prev => ({ ...prev, status: value as "Normal" | "Needs Attention" | "Critical" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Needs Attention">Needs Attention</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={newReport.priority} onValueChange={(value) => setNewReport(prev => ({ ...prev, priority: value as "Low" | "Medium" | "High" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateReportOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateReport}>
                    Save Handover Report
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by patient or caregiver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>
          
          <Select value={filterShift} onValueChange={setFilterShift}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="Day">Day Shift</SelectItem>
              <SelectItem value="Night">Night Shift</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="Needs Attention">Needs Attention</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Handover Reports
          </CardTitle>
          <CardDescription>
            Patient handover reports organized in an easy-to-read table format
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No handover reports found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterShift !== 'all' || filterStatus !== 'all' 
                  ? 'Try adjusting your filters or search terms'
                  : 'Create your first handover report to get started'
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Caregiver</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Vital Signs</TableHead>
                  <TableHead>Concerns</TableHead>
                  <TableHead>Instructions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {report.patient_name}
                    </TableCell>
                    <TableCell>
                      {report.caregiver_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={report.shift_type === 'Day' ? 'bg-yellow-50 text-yellow-700' : 'bg-blue-50 text-blue-700'}>
                        {report.shift_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <div className="font-medium">{report.shift_date}</div>
                        <div className="text-muted-foreground">{formatTime(report.created_at)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(report.status)} variant="outline">
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(report.priority)} variant="outline">
                        {report.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="space-y-1">
                        <div><span className="text-muted-foreground">BP:</span> {report.vital_signs?.blood_pressure || 'N/A'}</div>
                        <div><span className="text-muted-foreground">HR:</span> {report.vital_signs?.heart_rate || 'N/A'}</div>
                        <div><span className="text-muted-foreground">Temp:</span> {report.vital_signs?.temperature || 'N/A'}</div>
                        <div><span className="text-muted-foreground">O2:</span> {report.vital_signs?.oxygen_saturation || 'N/A'}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {report.concerns ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                            <div className="flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-yellow-700 truncate">{report.concerns}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No concerns</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {report.instructions_for_next_shift ? (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <div className="flex items-start gap-1">
                              <ArrowRight className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-blue-700 truncate">{report.instructions_for_next_shift}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No instructions</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReport(report)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete Report"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Handover Report</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this handover report for {report.patient_name}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteReport(report.id, report.patient_name)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Report Modal */}
      <Dialog open={isViewReportOpen} onOpenChange={setIsViewReportOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Handover Report - {selectedReport?.patient_name}
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.shift_type} shift report by {selectedReport?.caregiver_name} on {selectedReport?.shift_date}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6 py-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Shift Type</Label>
                  <p className="font-medium">{selectedReport.shift_type}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Shift Time</Label>
                  <p className="font-medium">{selectedReport.shift_start} - {selectedReport.shift_end}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Status</Label>
                  <Badge className={getStatusColor(selectedReport.status)} variant="outline">
                    {selectedReport.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Priority</Label>
                  <Badge className={getPriorityColor(selectedReport.priority)} variant="outline">
                    {selectedReport.priority}
                  </Badge>
                </div>
              </div>

              {/* Vital Signs */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Vital Signs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm text-gray-500">Blood Pressure</Label>
                      <p className="font-medium">{selectedReport.vital_signs?.blood_pressure || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Heart Rate</Label>
                      <p className="font-medium">{selectedReport.vital_signs?.heart_rate || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Temperature</Label>
                      <p className="font-medium">{selectedReport.vital_signs?.temperature || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-500">Oxygen Saturation</Label>
                      <p className="font-medium">{selectedReport.vital_signs?.oxygen_saturation || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Medications */}
                <Card className="border-border bg-card shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="h-5 w-5" />
                    Medications Given
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedReport.medications_given?.length > 0 ? (
                      selectedReport.medications_given.map((med, index) => (
                        <div key={index} className="flex items-center justify-between rounded border border-border bg-muted/60 p-2 dark:border-slate-700 dark:bg-slate-900/70">
                          <span className="font-medium text-foreground dark:text-slate-100">{med.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground dark:text-slate-300">{med.time}</span>
                            <Badge variant={med.status === 'Given' ? 'default' : 'destructive'}>
                              {med.status}
                            </Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground dark:text-slate-400">No medications recorded</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Activities & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border bg-card shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Activities & Care
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedReport.activities}</p>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Behavioral Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedReport.behavioral_notes}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Concerns & Instructions */}
              {(selectedReport.concerns || selectedReport.instructions_for_next_shift) && (
                <div className="space-y-4">
                  {selectedReport.concerns && (
                    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-950/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                          <AlertCircle className="h-5 w-5" />
                          Concerns / Issues
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-yellow-700 dark:text-yellow-100">{selectedReport.concerns}</p>
                      </CardContent>
                    </Card>
                  )}

                  {selectedReport.instructions_for_next_shift && (
                    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                          <ArrowRight className="h-5 w-5" />
                          Instructions for Next Shift
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-blue-700 dark:text-blue-100">{selectedReport.instructions_for_next_shift}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsViewReportOpen(false)}>
                  Close
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export Report
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientHandoverReports;
