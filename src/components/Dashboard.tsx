import { Activity, Users, Pill, Clock, Heart, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

const Dashboard = () => {
  // Mock data for demonstration
  const stats = {
    totalPatients: 24,
    totalCaregivers: 8,
    todayMedications: 45,
    activeShifts: 6
  }

  const recentAlerts = [
    { id: 1, patient: "Mary Johnson", type: "medication", message: "Missed morning medication", time: "10 minutes ago", severity: "high" },
    { id: 2, patient: "Robert Smith", type: "vitals", message: "Blood pressure reading high", time: "25 minutes ago", severity: "medium" },
    { id: 3, patient: "Eleanor Davis", type: "appointment", message: "Upcoming doctor appointment", time: "1 hour ago", severity: "low" }
  ]

  const upcomingMedications = [
    { id: 1, patient: "Mary Johnson", medication: "Metformin 500mg", time: "2:00 PM", status: "pending" },
    { id: 2, patient: "John Wilson", medication: "Lisinopril 10mg", time: "2:30 PM", status: "pending" },
    { id: 3, patient: "Sarah Brown", medication: "Vitamin D3", time: "3:00 PM", status: "pending" }
  ]

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "text-medical-critical"
      case "medium": return "text-medical-warning"
      case "low": return "text-medical-info"
      default: return "text-muted-foreground"
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high": return <AlertTriangle className="h-4 w-4" />
      case "medium": return <Clock className="h-4 w-4" />
      case "low": return <Activity className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Healthcare Dashboard</h1>
          <p className="text-muted-foreground">Overview of elderly care management system</p>
        </div>
        <Button className="gap-2">
          <Heart className="h-4 w-4" />
          Emergency Protocol
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalPatients}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +2 from last week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-medical-success/10 to-medical-success/20 border-medical-success/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Caregivers</CardTitle>
            <Activity className="h-4 w-4 text-medical-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-success">{stats.totalCaregivers}</div>
            <p className="text-xs text-muted-foreground">
              Currently on duty
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-medical-warning/10 to-medical-warning/20 border-medical-warning/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Medications</CardTitle>
            <Pill className="h-4 w-4 text-medical-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-warning">{stats.todayMedications}</div>
            <p className="text-xs text-muted-foreground">
              <CheckCircle className="inline h-3 w-3 mr-1" />
              38 completed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-medical-info/10 to-medical-info/20 border-medical-info/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shifts</CardTitle>
            <Clock className="h-4 w-4 text-medical-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-medical-info">{stats.activeShifts}</div>
            <p className="text-xs text-muted-foreground">
              Day & Night coverage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-medical-warning" />
              Recent Alerts
            </CardTitle>
            <CardDescription>
              Recent notifications and important updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={getSeverityColor(alert.severity)}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{alert.patient}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground">{alert.time}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Medications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" />
              Upcoming Medications
            </CardTitle>
            <CardDescription>
              Next scheduled medication times
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingMedications.map((med) => (
                <div key={med.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{med.patient}</p>
                    <p className="text-sm text-muted-foreground">{med.medication}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm text-primary">{med.time}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medication Adherence Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-medical-success" />
            Medication Adherence This Week
          </CardTitle>
          <CardDescription>
            Weekly medication compliance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Overall Adherence</p>
                <p className="text-2xl font-bold text-medical-success">92.5%</p>
              </div>
              <div className="w-32">
                <Progress value={92.5} className="h-2" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="text-center p-4 rounded-lg bg-medical-success/10">
                <p className="text-sm text-muted-foreground">Morning</p>
                <p className="text-xl font-bold text-medical-success">95%</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-medical-warning/10">
                <p className="text-sm text-muted-foreground">Afternoon</p>
                <p className="text-xl font-bold text-medical-warning">88%</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-medical-info/10">
                <p className="text-sm text-muted-foreground">Evening</p>
                <p className="text-xl font-bold text-medical-info">94%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard