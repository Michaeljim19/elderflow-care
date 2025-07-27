import { useState } from "react";
import { Plus, Edit, Trash2, Mail, Phone, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Caregiver, CaregiverStatus, ShiftType } from "@/types";

// Mock data
const initialCaregivers: Caregiver[] = [
  {
    caregiver_id: "1",
    first_name: "Sarah",
    last_name: "Johnson",
    email: "sarah.johnson@healthcare.com",
    contact_number: "+1-555-0101",
    shift_type: "Day",
    role: "Senior Nurse",
    status: "Active"
  },
  {
    caregiver_id: "2",
    first_name: "Michael",
    last_name: "Chen",
    email: "michael.chen@healthcare.com",
    contact_number: "+1-555-0102",
    shift_type: "Night",
    role: "Registered Nurse",
    status: "Active"
  },
  {
    caregiver_id: "3",
    first_name: "Emma",
    last_name: "Davis",
    email: "emma.davis@healthcare.com",
    contact_number: "+1-555-0103",
    shift_type: "Both",
    role: "Care Assistant",
    status: "Inactive"
  }
];

const mockPatients = [
  { patient_id: "1", name: "John Smith" },
  { patient_id: "2", name: "Mary Wilson" },
  { patient_id: "3", name: "Robert Brown" }
];

export default function Caregivers() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>(initialCaregivers);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCaregiver, setEditingCaregiver] = useState<Caregiver | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    shift_type: "Day" as ShiftType,
    role: "",
    status: "Active" as CaregiverStatus
  });

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      contact_number: "",
      shift_type: "Day",
      role: "",
      status: "Active"
    });
  };

  const handleAdd = () => {
    const newCaregiver: Caregiver = {
      caregiver_id: Date.now().toString(),
      ...formData
    };
    setCaregivers([...caregivers, newCaregiver]);
    resetForm();
    setIsAddDialogOpen(false);
    toast.success("Caregiver added successfully");
  };

  const handleEdit = (caregiver: Caregiver) => {
    setEditingCaregiver(caregiver);
    setFormData({
      first_name: caregiver.first_name,
      last_name: caregiver.last_name,
      email: caregiver.email,
      contact_number: caregiver.contact_number,
      shift_type: caregiver.shift_type,
      role: caregiver.role || "",
      status: caregiver.status
    });
  };

  const handleUpdate = () => {
    if (!editingCaregiver) return;
    
    setCaregivers(caregivers.map(c => 
      c.caregiver_id === editingCaregiver.caregiver_id 
        ? { ...editingCaregiver, ...formData }
        : c
    ));
    setEditingCaregiver(null);
    resetForm();
    toast.success("Caregiver updated successfully");
  };

  const handleDelete = (caregiverId: string) => {
    setCaregivers(caregivers.filter(c => c.caregiver_id !== caregiverId));
    toast.success("Caregiver deleted successfully");
  };

  const filteredCaregivers = caregivers.filter(caregiver =>
    caregiver.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caregiver.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caregiver.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCaregivers = caregivers.filter(c => c.status === "Active").length;
  const dayCaregivers = caregivers.filter(c => c.shift_type === "Day" || c.shift_type === "Both").length;
  const nightCaregivers = caregivers.filter(c => c.shift_type === "Night" || c.shift_type === "Both").length;

  const getShiftBadgeColor = (shiftType: ShiftType) => {
    switch (shiftType) {
      case "Day": return "bg-primary/10 text-primary border-primary/20";
      case "Night": return "bg-purple/10 text-purple border-purple/20";
      case "Both": return "bg-accent/10 text-accent-foreground border-accent/20";
      default: return "bg-muted/10 text-muted-foreground border-muted/20";
    }
  };

  const getStatusBadgeColor = (status: CaregiverStatus) => {
    return status === "Active" 
      ? "bg-success/10 text-success border-success/20"
      : "bg-warning/10 text-warning border-warning/20";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Caregiver Management</h1>
          <p className="text-muted-foreground mt-1">Manage healthcare staff and their assignments</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Caregiver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Caregiver</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                  placeholder="Enter contact number"
                />
              </div>
              
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  placeholder="e.g., Senior Nurse, Care Assistant"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shift_type">Shift Type</Label>
                  <Select value={formData.shift_type} onValueChange={(value: ShiftType) => setFormData({...formData, shift_type: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Day</SelectItem>
                      <SelectItem value="Night">Night</SelectItem>
                      <SelectItem value="Both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: CaregiverStatus) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button onClick={handleAdd} className="w-full">
                Add Caregiver
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Caregivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{caregivers.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Caregivers</CardTitle>
            <Users className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{activeCaregivers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Day Shift</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dayCaregivers}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Night Shift</CardTitle>
            <Clock className="h-4 w-4 text-purple" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nightCaregivers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <Input
          placeholder="Search caregivers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Caregivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Caregivers List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCaregivers.map((caregiver) => (
                <TableRow key={caregiver.caregiver_id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {caregiver.first_name} {caregiver.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {caregiver.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3" />
                      {caregiver.contact_number}
                    </div>
                  </TableCell>
                  <TableCell>{caregiver.role}</TableCell>
                  <TableCell>
                    <Badge className={getShiftBadgeColor(caregiver.shift_type)}>
                      {caregiver.shift_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeColor(caregiver.status)}>
                      {caregiver.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog open={editingCaregiver?.caregiver_id === caregiver.caregiver_id} 
                              onOpenChange={(open) => !open && setEditingCaregiver(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(caregiver)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit Caregiver</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="edit_first_name">First Name</Label>
                                <Input
                                  id="edit_first_name"
                                  value={formData.first_name}
                                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit_last_name">Last Name</Label>
                                <Input
                                  id="edit_last_name"
                                  value={formData.last_name}
                                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                                />
                              </div>
                            </div>
                            
                            <div>
                              <Label htmlFor="edit_email">Email</Label>
                              <Input
                                id="edit_email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="edit_contact_number">Contact Number</Label>
                              <Input
                                id="edit_contact_number"
                                value={formData.contact_number}
                                onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="edit_role">Role</Label>
                              <Input
                                id="edit_role"
                                value={formData.role}
                                onChange={(e) => setFormData({...formData, role: e.target.value})}
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="edit_shift_type">Shift Type</Label>
                                <Select value={formData.shift_type} onValueChange={(value: ShiftType) => setFormData({...formData, shift_type: value})}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Day">Day</SelectItem>
                                    <SelectItem value="Night">Night</SelectItem>
                                    <SelectItem value="Both">Both</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label htmlFor="edit_status">Status</Label>
                                <Select value={formData.status} onValueChange={(value: CaregiverStatus) => setFormData({...formData, status: value})}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <Button onClick={handleUpdate} className="w-full">
                              Update Caregiver
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Caregiver</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {caregiver.first_name} {caregiver.last_name}? 
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(caregiver.caregiver_id)}>
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
        </CardContent>
      </Card>
    </div>
  );
}