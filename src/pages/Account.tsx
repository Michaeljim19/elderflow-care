import { useState, useEffect } from "react";
import { collection as fbCollection, query as fbQuery, where as fbWhere, getDocs as fbGetDocs, updateDoc as fbUpdateDoc, doc as fbDoc } from "firebase/firestore";
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Shield, 
  Heart,
  Loader2,
  Eye,
  EyeOff,
  UserPlus,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Key
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { sendAccountCreationEmail } from "@/services/emailjs";
import { getPatients } from "@/services/firebase/patients";
import { createAccount, getAccounts, updateAccount, deleteAccount, createFirebaseAuthForAccount, createFirebaseAuthForAllActiveAccounts } from "@/services/firebase/accounts";
import type { Caregiver, Patient, Account } from "@/types";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

// Self-contained getCaregivers function
const getCaregivers = async (): Promise<Caregiver[]> => {
  try {
    const q = query(collection(db, 'users'), where('user_lvl', '==', 'caregiver'));
    const querySnapshot = await getDocs(q);
    const caregiverUsers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));

    const caregivers = caregiverUsers.map((user: any) => ({
      caregiver_id: user.uid,
      user_id: user.uid,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      contact_number: user.phone ? parseInt(user.phone) : 0,
      shift_type: user.shift_type || 'Day',
      role: user.role || 'caregiver',
      hire_date: user.hire_date || new Date().toISOString(),
      status: user.status || 'Active',
      assigned_patients_count: user.assigned_patients_count || 0,
      max_patients: user.max_patients || 2,
      license_number: user.license_number || '',
      license_picture: user.license_image_base64 || user.license_picture || '',
      created_at: user.created_at,
      updated_at: user.updated_at,
      middle_name: user.middle_name,
      birthday: user.birthday || user.date_of_birth,
      address: user.address,
      shift_start_date: user.shift_start_date,
      shift_end_date: user.shift_end_date,
      specialization: user.specialization || user.specializations?.join(', '),
      contract_start_date: user.contract_start_date,
      contract_end_date: user.contract_end_date,
      temporary_schedule_reason: user.temporary_schedule_reason,
      original_shift_type: user.original_shift_type,
      original_shift_start_date: user.original_shift_start_date,
      original_shift_end_date: user.original_shift_end_date,
      auth_created: user.auth_created || false,
      generated_email: user.generated_email,
      generated_password: user.generated_password
    })) as Caregiver[];

    return caregivers.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    throw error;
  }
};

interface AccountFormData {
  email: string
  role: 'caregiver' | 'guardian'
  notes: string
  generated_email: string
  generated_password: string
}

const Account = () => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [caregivers, setCaregivers] = useState<Caregiver[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null)
  const [suspendingAccount, setSuspendingAccount] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [creatingFirebaseAuth, setCreatingFirebaseAuth] = useState(false)
  const [creatingAuthForAccount, setCreatingAuthForAccount] = useState<string | null>(null)
  const { toast } = useToast()

  // Auto-generate credentials functions
  const generateUsername = (name: string, role: string): string => {
    const cleanName = name.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, '.')
      .trim()
    
    const rolePrefix = role.toLowerCase()
    const timestamp = Date.now().toString().slice(-4)
    
    return `${cleanName}.${rolePrefix}${timestamp}@elderflowcare.com`
  }

  const generateSecurePassword = (): string => {
    const length = 10
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%^&*'
    
    let password = ''
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    const allChars = uppercase + lowercase + numbers + symbols
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  // Form state for creating new account
  const [formData, setFormData] = useState<AccountFormData>({
    email: "",
    role: 'caregiver',
    notes: "",
    generated_email: "",
    generated_password: ""
  })

  // Initialize form with generated credentials
  useEffect(() => {
    const { generatedEmail, generatedPassword } = generateLoginCredentials('caregiver', 'caregiver')
    setFormData(prev => ({
      ...prev,
      generated_email: generatedEmail,
      generated_password: generatedPassword
    }))
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [caregiversData, patientsData, accountsData] = await Promise.all([
          getCaregivers(),
          getPatients(),
          getAccounts()
        ])
        setCaregivers(caregiversData)
        setPatients(patientsData)
        setAccounts(accountsData)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: "Error",
          description: "Failed to fetch caregivers and patients data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleInputChange = (field: keyof AccountFormData, value: any) => {
    if (field === 'role') {
      const roleName = value === 'caregiver' ? 'caregiver' : 'guardian'
      const { generatedEmail, generatedPassword } = generateLoginCredentials(roleName, value)
      setFormData(prev => ({ 
        ...prev, 
        [field]: value, 
        email: "",
        generated_email: generatedEmail,
        generated_password: generatedPassword
      }))
    } else if (field === 'email') {
      const isValidEmail = formData.role === 'caregiver' 
        ? caregivers.some(caregiver => caregiver.email === value)
        : patients.some(patient => patient.guardian_email === value)
      if (isValidEmail) {
        let personName = 'user';
        if (formData.role === 'caregiver') {
          const selectedCaregiver = caregivers.find(caregiver => caregiver.email === value);
          if (selectedCaregiver) {
            personName = `${selectedCaregiver.first_name}${selectedCaregiver.last_name}`;
          }
        } else {
          const selectedPatient = patients.find(patient => patient.guardian_email === value);
          if (selectedPatient) {
            personName = `${selectedPatient.first_name}${selectedPatient.last_name}guardian`;
          }
        }
        const { generatedEmail, generatedPassword } = generateLoginCredentials(personName, formData.role);
        setFormData(prev => ({ ...prev, [field]: value, generated_email: generatedEmail, generated_password: generatedPassword }));
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }))
    }
  }

  const generateTemporaryPassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const generateLoginCredentials = (name: string, role: string) => {
    const cleanName = name.toLowerCase().replace(/\s+/g, '')
    const roleType = role === 'caregiver' ? 'caregiver' : 'guardian'
    const generatedEmail = `${cleanName}.${roleType}@elderflow.com`
    const generatedPassword = generateTemporaryPassword()
    return { generatedEmail, generatedPassword }
  }

  const resetForm = () => {
    const { generatedEmail, generatedPassword } = generateLoginCredentials('caregiver', 'caregiver')
    setFormData({
      email: "",
      role: 'caregiver',
      notes: "",
      generated_email: generatedEmail,
      generated_password: generatedPassword
    })
  }

  const validateForm = () => {
    if (!formData.email || !formData.role) return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) return false
    return true
  }

  const handleCreateAccount = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields with valid information",
        variant: "destructive"
      })
      return
    }

    try {
      setCreatingAccount(true)
      const generatedEmail = formData.generated_email
      const generatedPassword = formData.generated_password
      const verificationToken = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');

      let userDocId = null;
      if (formData.role === 'caregiver') {
        const caregiversRef = collection(db, 'users');
        const q = query(caregiversRef, where('email', '==', formData.email), where('user_lvl', '==', 'caregiver'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docRef = doc(db, 'users', snapshot.docs[0].id);
          await updateDoc(docRef, {
            generated_email: generatedEmail,
            generated_password: generatedPassword,
            auth_created: false,
            status: 'pending',
            verification_token: verificationToken,
            verified: false,
            updated_at: serverTimestamp(),
          });
          userDocId = snapshot.docs[0].id;
        } else {
          const newAccountRef = await createAccount({
            email: formData.email,
            generated_email: generatedEmail,
            generated_password: generatedPassword,
            name: 'Caregiver Account',
            role: 'caregiver',
            status: 'pending',
            verified: false,
            password_changed: false,
            verification_token: verificationToken
          });
          userDocId = newAccountRef;
        }
      } else {
        const newAccountRef = await createAccount({
          email: formData.email,
          generated_email: generatedEmail,
          generated_password: generatedPassword,
          name: 'Guardian Account',
          role: 'guardian',
          status: 'pending',
          verified: false,
          password_changed: false,
          verification_token: verificationToken
        });
        userDocId = newAccountRef;
      }

      let actualEmail = generatedEmail;
      let actualToken = verificationToken;
      if (userDocId) {
        const userDocSnap = await getDoc(doc(db, 'users', userDocId));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.generated_email) actualEmail = userData.generated_email;
          if (userData.verification_token) actualToken = userData.verification_token;
        }
      }

      const verificationUrl = `${window.location.origin}/verify-account?token=${actualToken}&email=${encodeURIComponent(actualEmail)}`;
      await sendAccountCreationEmail({
        to_email: formData.email,
        to_name: formData.role === 'caregiver' ? 'Caregiver' : 'Guardian',
        account_type: formData.role,
        username: actualEmail,
        temporary_password: generatedPassword,
        login_url: window.location.origin + "/login",
        verification_url: verificationUrl,
        confirmation_url: verificationUrl,
        admin_notes: formData.notes || `Welcome to ElderFlow Care! Your login email is: ${actualEmail}`
      });

      const updatedAccounts = await getAccounts();
      setAccounts(updatedAccounts);
      resetForm();
      setIsCreateDialogOpen(false);

      toast({
        title: "Account Created Successfully",
        description: `Login credentials sent to ${formData.email}. Login email: ${actualEmail}`,
      });
    } catch (error) {
      console.error("Error creating account:", error);
      toast({
        title: "Error",
        description: "Failed to create account and send email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCreatingAccount(false);
    }
  }

  const handleCreateFirebaseAuthForAll = async () => {
    try {
      setCreatingFirebaseAuth(true)
      const result = await createFirebaseAuthForAllActiveAccounts()
      toast({
        title: "Firebase Auth Creation Complete",
        description: `Successfully created ${result.success} Firebase Auth users. ${result.errors} errors occurred.`,
        variant: result.errors > 0 ? "destructive" : "default"
      })
    } catch (error) {
      console.error("Error creating Firebase Auth users:", error)
      toast({
        title: "Error",
        description: "Failed to create Firebase Auth users. Please try again.",
        variant: "destructive"
      })
    } finally {
      setCreatingFirebaseAuth(false)
    }
  }

  const handleCreateFirebaseAuthForAccount = async (accountId: string) => {
    try {
      setCreatingAuthForAccount(accountId)
      await createFirebaseAuthForAccount(accountId)
      toast({
        title: "Firebase Auth User Created",
        description: "Firebase authentication user created successfully for this account.",
      })
    } catch (error: any) {
      console.error("Error creating Firebase Auth user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create Firebase Auth user. Please try again.",
        variant: "destructive"
      })
    } finally {
      setCreatingAuthForAccount(null)
    }
  }

  const handleSuspendAccount = async (accountId: string) => {
    try {
      const account = accounts.find(acc => acc.id === accountId)
      if (!account) return
      if (account.status === 'suspended') {
        await updateAccount(accountId, { status: 'active' })
      } else {
        await updateAccount(accountId, { 
          status: 'suspended',
          suspension_reason: 'Suspended by administrator'
        })
      }
      const updatedAccounts = await getAccounts()
      setAccounts(updatedAccounts)
      setSuspendingAccount(null)
      toast({
        title: "Account Updated",
        description: "Account status has been changed successfully",
      })
    } catch (error) {
      console.error("Error updating account:", error)
      toast({
        title: "Error",
        description: "Failed to update account status",
        variant: "destructive"
      })
    }
  }

  // --- END OF ALL HANDLER/HELPER FUNCTIONS ---

  // MAIN RETURN for Account component (must be at top level of Account function)
  const filteredAccounts = accounts.filter(account =>
    account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.role.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const caregiverAccounts = filteredAccounts.filter(acc => acc.role === 'caregiver');
  const guardianAccounts = filteredAccounts.filter(acc => acc.role === 'guardian');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-5xl font-bold text-gray-900">Account Management</h1>
          <p className="text-xl text-muted-foreground">
            Create and manage accounts for caregivers and patient guardians
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleCreateFirebaseAuthForAll}
            disabled={creatingFirebaseAuth}
            className="gap-2 h-12 text-base"
          >
            {creatingFirebaseAuth ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-base">Creating Auth Users...</span>
              </>
            ) : (
              <>
                <Key className="h-5 w-5" />
                <span className="text-base">Create Firebase Auth for All Active</span>
              </>
            )}
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2 h-12 text-base">
            <UserPlus className="h-5 w-5" />
            <span className="text-base">Create Account</span>
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search accounts by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 text-base"
              />
            </div>
            <Badge variant="outline" className="gap-2 px-3 py-2">
              <Users className="h-3 w-3" />
              {accounts.length} Total Accounts
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="caregivers">Caregivers ({caregiverAccounts.length})</TabsTrigger>
          <TabsTrigger value="guardians">Guardians ({guardianAccounts.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending ({accounts.filter(a => a.status === 'pending').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <AccountList 
            accounts={filteredAccounts} 
            caregivers={caregivers}
            patients={patients}
            onViewAccount={setViewingAccount} 
            onSuspendAccount={setSuspendingAccount}
            onCreateFirebaseAuth={handleCreateFirebaseAuthForAccount}
            creatingAuthForAccount={creatingAuthForAccount}
          />
        </TabsContent>

        <TabsContent value="caregivers">
          <AccountList 
            accounts={caregiverAccounts} 
            caregivers={caregivers}
            patients={patients}
            onViewAccount={setViewingAccount} 
            onSuspendAccount={setSuspendingAccount}
            onCreateFirebaseAuth={handleCreateFirebaseAuthForAccount}
            creatingAuthForAccount={creatingAuthForAccount}
          />
        </TabsContent>

        <TabsContent value="guardians">
          <AccountList 
            accounts={guardianAccounts} 
            caregivers={caregivers}
            patients={patients}
            onViewAccount={setViewingAccount} 
            onSuspendAccount={setSuspendingAccount}
            onCreateFirebaseAuth={handleCreateFirebaseAuthForAccount}
            creatingAuthForAccount={creatingAuthForAccount}
          />
        </TabsContent>

        <TabsContent value="pending">
          <AccountList 
            accounts={accounts.filter(a => a.status === 'pending')} 
            caregivers={caregivers}
            patients={patients}
            onViewAccount={setViewingAccount} 
            onSuspendAccount={setSuspendingAccount}
            onCreateFirebaseAuth={handleCreateFirebaseAuthForAccount}
            creatingAuthForAccount={creatingAuthForAccount}
          />
        </TabsContent>
      </Tabs>

      {/* Create Account Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
            <DialogDescription>
              Create a new account for a caregiver or patient guardian. An email with login credentials will be sent automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Basic Information</h3>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-base font-medium">Account Role *</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value) => handleInputChange("role", value)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select account role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caregiver" className="text-base">
                      <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-blue-500" />
                        <span className="text-base">Caregiver</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="guardian" className="text-base">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-500" />
                        <span className="text-base">Patient Guardian</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium">Contact Email Address *</Label>
                <Select 
                  value={formData.email} 
                  onValueChange={(value) => handleInputChange("email", value)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder={`Select ${formData.role} email`} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.role === 'caregiver' && caregivers
                      .filter(caregiver => caregiver.email && caregiver.email.trim() !== '') // Filter out empty emails
                      .filter((caregiver, index, arr) => 
                        arr.findIndex(c => c.email === caregiver.email) === index) // Remove duplicates
                      .map((caregiver) => (
                        <SelectItem key={`caregiver-${caregiver.caregiver_id}`} value={caregiver.email} className="text-base">
                          {caregiver.email} - {caregiver.first_name} {caregiver.last_name}
                        </SelectItem>
                      ))}
                    {formData.role === 'guardian' && patients
                      .filter(patient => patient.guardian_email && patient.guardian_email.trim() !== '') // Use guardian_email and filter out empty
                      .filter((patient, index, arr) => 
                        arr.findIndex(p => p.guardian_email === patient.guardian_email) === index) // Remove duplicates
                      .map((patient) => (
                        <SelectItem key={`guardian-${patient.patient_id}`} value={patient.guardian_email!} className="text-base">
                          {patient.guardian_email} - {patient.first_name} {patient.last_name} (Guardian)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-base text-muted-foreground">
                  This email will receive the auto-generated login credentials
                </p>
              </div>
            </div>

            {/* Generated Credentials Preview */}
            {formData.generated_email && formData.generated_password && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Generated Login Credentials Preview</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Generated Login Email</Label>
                    <Input
                      value={formData.generated_email}
                      readOnly
                      className="font-mono text-blue-600 bg-white text-base h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-medium">Generated Password</Label>
                    <Input
                      value={formData.generated_password}
                      readOnly
                      className="font-mono text-green-600 bg-white text-base h-12"
                    />
                  </div>
                  <p className="text-base text-muted-foreground">
                    These credentials will be sent to the selected contact email address
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base font-medium">Welcome Message (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Enter a welcome message that will be included in the account creation email..."
                rows={3}
                className="text-base"
              />
              <p className="text-base text-muted-foreground">
                The email will include a verification link that the user must click to activate their account and confirm it's ready for login.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <Button variant="outline" onClick={() => {
              resetForm()
              setIsCreateDialogOpen(false)
            }} className="h-12 text-base">
              Cancel
            </Button>
            <Button onClick={handleCreateAccount} disabled={creatingAccount} className="min-w-[160px] h-12 text-base">
              {creatingAccount ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  <span className="text-base">Creating Account...</span>
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-5 w-5" />
                  <span className="text-base">Create & Send Email</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Account Dialog */}
      <Dialog open={!!viewingAccount} onOpenChange={() => setViewingAccount(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Account Details</DialogTitle>
          </DialogHeader>
          {viewingAccount && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                {getRoleIcon(viewingAccount.role)}
                <div>
                  <h3 className="font-semibold text-lg">{getAccountDisplayName(viewingAccount)}</h3>
                  {viewingAccount.generated_email && (
                    <div className="space-y-1">
                      <p className="text-sm text-blue-600 font-medium">Login Email: {viewingAccount.generated_email}</p>
                      <p className="text-sm text-muted-foreground">Contact Email: {viewingAccount.email}</p>
                    </div>
                  )}
                  {!viewingAccount.generated_email && (
                    <p className="text-sm text-muted-foreground">{viewingAccount.email}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                  <p className="capitalize font-medium">{viewingAccount.role}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <Badge className={getStatusColor(viewingAccount.status)}>
                    {viewingAccount.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Verification Status</Label>
                  <Badge 
                    className={viewingAccount.verified 
                      ? 'bg-green-100 text-green-800 border-green-200' 
                      : 'bg-orange-100 text-orange-800 border-orange-200'
                    } 
                    variant="outline"
                  >
                    {viewingAccount.verified ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Unverified
                      </>
                    )}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="font-medium">{viewingAccount.createdAt?.seconds ? new Date(viewingAccount.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</p>
                </div>
                {viewingAccount.verified && viewingAccount.verifiedAt && (
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-muted-foreground">Verified</Label>
                    <p className="font-medium">{viewingAccount.verifiedAt?.seconds ? new Date(viewingAccount.verifiedAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-muted-foreground">Last Login</Label>
                  <p className="font-medium">{viewingAccount.lastLogin?.seconds ? new Date(viewingAccount.lastLogin.seconds * 1000).toLocaleDateString() : 'Never'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend Account Confirmation */}
      <AlertDialog open={!!suspendingAccount} onOpenChange={() => setSuspendingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change this account's status? This action can be reversed later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendingAccount && handleSuspendAccount(suspendingAccount)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Account List Component
const AccountList = ({ 
  accounts, 
  caregivers, 
  patients, 
  onViewAccount, 
  onSuspendAccount,
  onCreateFirebaseAuth,
  creatingAuthForAccount
}: {
  accounts: Account[]
  caregivers: Caregiver[]
  patients: Patient[]
  onViewAccount: (account: Account) => void
  onSuspendAccount: (id: string) => void
  onCreateFirebaseAuth: (accountId: string) => void
  creatingAuthForAccount: string | null
}) => {
  const getStatusColor = (status: Account['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'suspended':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRoleIcon = (role: Account['role']) => {
    return role === 'caregiver' ? (
      <Heart className="h-4 w-4 text-blue-500" />
    ) : (
      <Shield className="h-4 w-4 text-green-500" />
    )
  }

  const getAccountDisplayName = (account: Account) => {
    if (account.role === 'caregiver') {
      const caregiver = caregivers.find(c => c.email === account.email)
      return caregiver ? `${caregiver.first_name} ${caregiver.last_name}` : account.email
    } else {
      const patient = patients.find(p => p.guardian_email === account.email)
      return patient ? `Guardian of ${patient.first_name} ${patient.last_name}` : account.email
    }
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="p-4 bg-gray-50 rounded-full mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No accounts found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Create your first account to get started with managing caregiver and guardian access.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <Card key={account.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  {getRoleIcon(account.role)}
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base">{getAccountDisplayName(account)}</h3>
                  <p className="text-sm text-muted-foreground">{account.email}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge className={getStatusColor(account.status)} variant="secondary">
                      {account.status}
                    </Badge>
                    <Badge 
                      className={account.verified 
                        ? 'bg-green-100 text-green-800 border-green-200' 
                        : 'bg-orange-100 text-orange-800 border-orange-200'
                      } 
                      variant="outline"
                    >
                      {account.verified ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Unverified
                        </>
                      )}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">
                      {account.role === 'caregiver' ? 'Caregiver Account' : 'Guardian Account'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewAccount(account)}
                  className="h-9 px-3"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                
                {/* Firebase Auth Creation Button - only show for active and verified accounts */}
                {account.status === 'active' && account.verified && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCreateFirebaseAuth(account.id)}
                    disabled={creatingAuthForAccount === account.id}
                    className="h-9 px-3 text-blue-600 hover:text-blue-700"
                    title="Create Firebase Auth User"
                  >
                    {creatingAuthForAccount === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSuspendAccount(account.id)}
                  className={`h-9 px-3 ${account.status === 'suspended' ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'}`}
                >
                  {account.status === 'suspended' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
export default Account
