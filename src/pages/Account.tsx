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
  Key,
  Settings,
  Trash2,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { deleteUser } from "@/services/firebase/users";
import { createAccount, getAccounts, updateAccount, deleteAccount, createFirebaseAuthForAccount, createFirebaseAuthForAllActiveAccounts, verifyAccount } from "@/services/firebase/accounts";
import type { Caregiver, Patient, Account } from "@/types";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { migrateGuardianToPatient } from "@/scripts/migrateGuardianToPatient";

// Self-contained getCaregivers function
const getCaregivers = async (): Promise<Caregiver[]> => {
  try {
    console.log('🔍 Account.tsx - Fetching caregivers using import');
    // Use the centralized getCaregivers function
    const { getCaregivers: getCaregiversService } = await import('@/services/firebase/caregivers');
    const caregivers = await getCaregiversService();
    console.log('🔍 Account.tsx - Got caregivers:', caregivers.length);
    console.log('🔍 Account.tsx - Caregiver emails:', caregivers.map(c => c.email).filter(e => e));
    return caregivers;
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    throw error;
  }
};

interface AccountFormData {
  email: string
  role: 'caregiver' | 'patient'
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

  // Helper functions
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
      // For patients, find by email (User-centered approach) 
      const patient = patients.find(p => p.email === account.email)
      return patient ? `${patient.first_name} ${patient.last_name}` : account.email
    }
  }

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
        console.log('🔍 Account.tsx: Starting fetchData...');
        setLoading(true)
        console.log('🔍 Account.tsx: About to call getCaregivers, getPatients, getAccounts...');
        
        // Call them one by one to see which one fails
        console.log('🔍 Account.tsx: Calling getCaregivers()...');
        let caregiversData;
        try {
          caregiversData = await getCaregivers();
          console.log('🔍 Account.tsx: getCaregivers() completed, result length:', caregiversData.length);
          console.log('🔍 Account.tsx: getCaregivers() full result:', caregiversData);
        } catch (caregiverError) {
          console.error('🔍 Account.tsx: getCaregivers() ERROR:', caregiverError);
          caregiversData = []; // fallback to empty array
        }
        
        console.log('🔍 Account.tsx: Calling getPatients()...');
        const patientsData = await getPatients();
        console.log('🔍 Account.tsx: getPatients() completed');
        
        console.log('🔍 Account.tsx: Calling getAccounts()...');
        const accountsData = await getAccounts();
        console.log('🔍 Account.tsx: getAccounts() completed');
        
        setCaregivers(caregiversData)
        setPatients(patientsData)
        
        // Debug: Log the data to see what we have
        console.log('🔍 Account.tsx: Loaded caregivers:', caregiversData);
        console.log('🔍 Account.tsx: Loaded patients:', patientsData);
        
        // Only show explicitly created accounts, no virtual accounts
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
      const roleName = value === 'caregiver' ? 'caregiver' : 'patient'
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
        : patients.some(patient => patient.email === value)
      if (isValidEmail) {
        let personName = 'user';
        if (formData.role === 'caregiver') {
          const selectedCaregiver = caregivers.find(caregiver => caregiver.email === value);
          if (selectedCaregiver) {
            personName = `${selectedCaregiver.first_name}${selectedCaregiver.last_name}`;
          }
        } else {
          const selectedPatient = patients.find(patient => patient.email === value);
          if (selectedPatient) {
            personName = `${selectedPatient.first_name}${selectedPatient.last_name}`;
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
    const roleType = role === 'caregiver' ? 'caregiver' : 'patient'
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
      let accountId = null;
      
      if (formData.role === 'caregiver') {
        // Find the caregiver by email to get their real name
        const selectedCaregiver = caregivers.find(c => c.email === formData.email);
        const caregiverName = selectedCaregiver 
          ? `${selectedCaregiver.first_name} ${selectedCaregiver.last_name}`.trim()
          : 'Caregiver Account';
        
        // Create account in accounts collection
        accountId = await createAccount({
          email: formData.email,
          generated_email: generatedEmail,
          generated_password: generatedPassword,
          name: caregiverName,
          role: 'caregiver',
          status: 'pending',
          verified: false,
          password_changed: false,
          verification_token: verificationToken
        });

        // Find existing user record and update it with accountId
        if (selectedCaregiver) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', formData.email));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const userDocRef = doc(db, 'users', snapshot.docs[0].id);
            const userDoc = snapshot.docs[0];
            
            await updateDoc(userDocRef, {
              accountId: accountId,
              generated_email: generatedEmail,
              generated_password: generatedPassword,
              auth_created: false,
              verification_token: verificationToken,
              verified: false,
              updated_at: serverTimestamp(),
            });
            userDocId = userDoc.id;
            
            console.log(`✅ Updated existing user ${userDocId} with accountId: ${accountId}`);
          } else {
            console.warn(`⚠️ No existing user found for caregiver email: ${formData.email}`);
          }
        }
      } else {
        // Find the patient by email to get their real name
        const selectedPatient = patients.find(p => p.email === formData.email);
        const patientName = selectedPatient 
          ? `${selectedPatient.first_name} ${selectedPatient.last_name}`.trim()
          : 'Patient Account';
        
        // Create account in accounts collection
        accountId = await createAccount({
          email: formData.email,
          generated_email: generatedEmail,
          generated_password: generatedPassword,
          name: patientName,
          role: 'patient',
          status: 'pending',
          verified: false,
          password_changed: false,
          verification_token: verificationToken
        });

        // Find existing patient/user record and update it with accountId
        if (selectedPatient) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', formData.email));
          const snapshot = await getDocs(q);
          
          if (!snapshot.empty) {
            const userDocRef = doc(db, 'users', snapshot.docs[0].id);
            await updateDoc(userDocRef, {
              accountId: accountId,
              generated_email: generatedEmail,
              generated_password: generatedPassword,
              auth_created: false,
              verification_token: verificationToken,
              verified: false,
              updated_at: serverTimestamp(),
            });
            userDocId = snapshot.docs[0].id;
            console.log(`✅ Updated existing user ${userDocId} with accountId: ${accountId}`);
          } else {
            console.warn(`⚠️ No existing user found for patient email: ${formData.email}`);
          }
        }
      }

      // Use the accountId for further processing
      userDocId = accountId;

      // Prefer token and generated_email from the accounts collection if available
      let actualEmail = generatedEmail;
      let actualToken = verificationToken;
      if (userDocId) {
        // Try reading accounts collection doc first (createAccount returns accounts doc id)
        try {
          const accountDocRef = doc(db, 'accounts', userDocId)
          const accountSnap = await getDoc(accountDocRef)
          if (accountSnap.exists()) {
            const accountData = accountSnap.data()
            if (accountData.generated_email) actualEmail = accountData.generated_email
            if (accountData.verification_token) actualToken = accountData.verification_token
          } else {
            // Fallback to users collection doc
            const userDocSnap = await getDoc(doc(db, 'users', userDocId))
            if (userDocSnap.exists()) {
              const userData = userDocSnap.data()
              if (userData.generated_email) actualEmail = userData.generated_email
              if (userData.verification_token) actualToken = userData.verification_token
            }
          }
        } catch (e) {
          console.warn('Could not read account/user doc to fetch verification token:', e)
        }
      }

      const verificationUrl = `${window.location.origin}/verify-account?token=${actualToken}&email=${encodeURIComponent(actualEmail)}`;
      await sendAccountCreationEmail({
        to_email: formData.email,
        to_name: formData.role === 'caregiver' ? 'Caregiver' : 'Patient',
        account_type: formData.role,
        username: actualEmail,
        temporary_password: generatedPassword,
        login_url: window.location.origin + "/login",
        verification_url: verificationUrl,
        confirmation_url: verificationUrl,
        admin_notes: formData.notes || `Welcome to Care! Your login email is: ${actualEmail}`
      });

      // Account will remain unverified until user clicks verification link in email

      const updatedAccounts = await getAccounts();
      setAccounts(updatedAccounts);
      resetForm();
      setIsCreateDialogOpen(false);

      toast({
        title: "Account Created Successfully",
        description: `Account created and verification email sent to ${formData.email}. Please check email to verify account. Login email: ${actualEmail}`,
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

  const handleDeleteSpecificUser = async () => {
    try {
      const userId = "bMnzyBvAXcg6ZsekHOSr";
      await deleteUser(userId);
      toast({
        title: "User Deleted",
        description: `Successfully deleted user with ID: ${userId}`,
        variant: "default"
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive"
      });
    }
  }

  // Debug function to check document ID mismatches
  const handleDebugDocumentIds = async () => {
    try {
      console.log('=== DEBUGGING DOCUMENT ID MISMATCHES ===');
      
      // Get all patients and users
      const patientsData = await getPatients();
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      console.log('📋 All Patients:', patientsData.map(p => ({
        patient_id: p.patient_id,
        user_id: p.user_id,
        name: `${p.first_name} ${p.last_name}`,
        email: p.email
      })));
      
      console.log('📋 All Users:', usersData.map((u: any) => ({
        documentId: u.documentId,
        user_id: u.user_id,
        name: `${u.first_name} ${u.last_name}`,
        email: u.email,
        role: u.role
      })));
      
      // Check for mismatches
      const patientUsers = usersData.filter((u: any) => u.role === 'Patient');
      console.log('📋 Patient Users Only:', patientUsers);
      
      // Check each patient's document ID alignment
      for (const patient of patientsData) {
        const correspondingUser = usersData.find((u: any) => u.user_id === patient.user_id || u.email === patient.email);
        console.log(`🔍 Patient ${patient.first_name} ${patient.last_name}:`, {
          patient_document_id: patient.patient_id,
          patient_user_id_field: patient.user_id,
          user_document_id: correspondingUser?.documentId,
          user_user_id_field: correspondingUser?.user_id,
          ids_match: patient.patient_id === correspondingUser?.documentId,
          user_found: !!correspondingUser
        });
      }
      
      toast({
        title: "Debug Complete",
        description: "Check the browser console for detailed document ID analysis."
      });
    } catch (error) {
      console.error("Error debugging document IDs:", error);
      toast({
        title: "Debug Error",
        description: "Failed to debug document IDs. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Migration function to fix document ID mismatches for caregivers
  const handleMigrateCaregiverDocumentIds = async () => {
    try {
      console.log('=== STARTING CAREGIVER DOCUMENT ID MIGRATION ===');
      
      // Get all caregivers from caregivers collection (raw Firestore data)
      const caregiversSnapshot = await getDocs(collection(db, 'caregivers'));
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const caregiversData = caregiversSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      const usersData = usersSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      let migratedCount = 0;
      const caregiverUsers = usersData.filter((u: any) => u.role === 'Caregiver');
      
      for (const caregiverUser of caregiverUsers) {
        // Find corresponding caregiver document by user_id or email
        const correspondingCaregiver = caregiversData.find((c: any) => 
          c.user_id === caregiverUser.user_id || 
          c.user_id === caregiverUser.documentId ||
          c.email === caregiverUser.email
        );
        
        if (correspondingCaregiver && correspondingCaregiver.documentId !== caregiverUser.documentId) {
          console.log(`🔄 Migrating caregiver: ${caregiverUser.first_name} ${caregiverUser.last_name}`);
          console.log(`   User doc ID: ${caregiverUser.documentId}`);
          console.log(`   Caregiver doc ID: ${correspondingCaregiver.documentId}`);
          console.log(`   Will create new caregiver doc with unified ID: ${caregiverUser.documentId}`);
          
          // Create new caregiver document with user's document ID
          const newCaregiverData = {
            ...correspondingCaregiver,
            caregiver_id: caregiverUser.documentId,
            user_id: caregiverUser.documentId,
            updated_at: serverTimestamp()
          };
          
          // Remove the old documentId field from the data
          delete newCaregiverData.documentId;
          
          // Use setDoc to create the caregiver document with unified ID
          await setDoc(doc(db, 'caregivers', caregiverUser.documentId), newCaregiverData);
          
          // Delete the old caregiver document if it's different
          if (correspondingCaregiver.documentId !== caregiverUser.documentId) {
            await deleteDoc(doc(db, 'caregivers', correspondingCaregiver.documentId));
          }
          
          migratedCount++;
          console.log(`✅ Migrated caregiver: ${caregiverUser.first_name} ${caregiverUser.last_name}`);
        }
      }
      
      console.log(`=== CAREGIVER MIGRATION COMPLETE: ${migratedCount} caregivers migrated ===`);
      
      toast({
        title: "Caregiver Migration Complete",
        description: `Successfully migrated ${migratedCount} caregivers to unified document IDs.`,
      });
      
      // Refresh the page data
      window.location.reload();
      
    } catch (error) {
      console.error("Error migrating caregiver document IDs:", error);
      toast({
        title: "Caregiver Migration Error",
        description: "Failed to migrate caregiver document IDs. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Migration function to fix document ID mismatches for patients
  const handleMigrateDocumentIds = async () => {
    try {
      console.log('=== STARTING DOCUMENT ID MIGRATION ===');
      
      // Get all patients from patients collection (raw Firestore data)
      const patientsSnapshot = await getDocs(collection(db, 'patients'));
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const patientsData = patientsSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      const usersData = usersSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      let migratedCount = 0;
      const patientUsers = usersData.filter((u: any) => u.role === 'Patient');
      
      for (const patientUser of patientUsers) {
        // Find corresponding patient document by user_id or email
        const correspondingPatient = patientsData.find((p: any) => 
          p.user_id === patientUser.user_id || 
          p.user_id === patientUser.documentId ||
          p.email === patientUser.email
        );
        
        if (correspondingPatient && correspondingPatient.documentId !== patientUser.documentId) {
          console.log(`🔄 Migrating patient: ${patientUser.first_name} ${patientUser.last_name}`);
          console.log(`   User doc ID: ${patientUser.documentId}`);
          console.log(`   Patient doc ID: ${correspondingPatient.documentId}`);
          console.log(`   Will create new patient doc with unified ID: ${patientUser.documentId}`);
          
          // Create new patient document with user's document ID
          const newPatientData = {
            ...correspondingPatient,
            patient_id: patientUser.documentId,
            user_id: patientUser.documentId,
            updated_at: serverTimestamp()
          };
          
          // Remove the old documentId field from the data
          delete newPatientData.documentId;
          
          // Use setDoc to create or update the patient document with unified ID
          await setDoc(doc(db, 'patients', patientUser.documentId), newPatientData);
          
          // Delete the old patient document if it's different
          if (correspondingPatient.documentId !== patientUser.documentId) {
            await deleteDoc(doc(db, 'patients', correspondingPatient.documentId));
          }
          
          migratedCount++;
          console.log(`✅ Migrated patient: ${patientUser.first_name} ${patientUser.last_name}`);
        }
      }
      
      console.log(`=== MIGRATION COMPLETE: ${migratedCount} patients migrated ===`);
      
      toast({
        title: "Migration Complete",
        description: `Successfully migrated ${migratedCount} patients to unified document IDs.`,
      });
      
      // Refresh the page data
      window.location.reload();
      
    } catch (error) {
      console.error("Error migrating document IDs:", error);
      toast({
        title: "Migration Error",
        description: "Failed to migrate document IDs. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Update patient and medical records to unified ID
  const handleUpdatePatientToUnifiedId = async () => {
    try {
      const oldPatientId = prompt('Enter the old patient ID:');
      const newUserId = prompt('Enter the new user ID (Firebase Auth UID):');
      
      if (!oldPatientId || !newUserId) {
        toast({
          title: "Invalid Input",
          description: "Both old patient ID and new user ID are required.",
          variant: "destructive"
        });
        return;
      }
      
      console.log('=== STARTING PATIENT TO UNIFIED ID UPDATE ===');
      console.log(`Old Patient ID: ${oldPatientId}`);
      console.log(`New User ID: ${newUserId}`);
      
      // Import the update function
      const { updatePatientToUnifiedId } = await import('@/services/firebase/patients');
      
      // Perform the update
      await updatePatientToUnifiedId(oldPatientId, newUserId);
      
      toast({
        title: "Update Complete",
        description: `Successfully updated patient ${oldPatientId} to unified ID ${newUserId}`,
      });
      
      // Refresh the page data
      window.location.reload();
      
    } catch (error) {
      console.error("Error updating patient to unified ID:", error);
      toast({
        title: "Update Error",
        description: "Failed to update patient to unified ID. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Sync all medical records for all patients
  const handleSyncAllMedicalRecords = async () => {
    try {
      console.log('=== STARTING MEDICAL RECORDS SYNC FOR ALL PATIENTS ===');
      
      // Get all patients
      const patientsSnapshot = await getDocs(collection(db, 'patients'));
      const medicalHistorySnapshot = await getDocs(collection(db, 'medical_history'));
      const medicationsSnapshot = await getDocs(collection(db, 'medications'));
      
      const patients = patientsSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      let updatedMedHistoryCount = 0;
      let updatedMedicationsCount = 0;
      
      // Check each patient's medical records
      for (const patient of patients) {
        const patientId = patient.documentId;
        console.log(`🔍 Checking medical records for patient ${patientId}...`);
        
        // Update medical history records that don't match the patient's current ID
        for (const medHistoryDoc of medicalHistorySnapshot.docs) {
          const medHistoryData = medHistoryDoc.data();
          
          // Check if this medical history belongs to this patient but has wrong patient_id
          if (medHistoryData.patient_id !== patientId && 
              (medHistoryData.patient_email === patient.email ||
               (medHistoryData.patient_first_name === patient.first_name && 
                medHistoryData.patient_last_name === patient.last_name))) {
            
            console.log(`📋 Updating medical history ${medHistoryDoc.id} from patient_id ${medHistoryData.patient_id} to ${patientId}`);
            
            await updateDoc(doc(db, 'medical_history', medHistoryDoc.id), {
              patient_id: patientId,
              updated_at: serverTimestamp()
            });
            
            updatedMedHistoryCount++;
          }
        }
        
        // Update medication records that don't match the patient's current ID
        for (const medicationDoc of medicationsSnapshot.docs) {
          const medicationData = medicationDoc.data();
          
          // Check if this medication belongs to this patient but has wrong patient_id
          if (medicationData.patient_id !== patientId && 
              (medicationData.patient_email === patient.email ||
               (medicationData.patient_first_name === patient.first_name && 
                medicationData.patient_last_name === patient.last_name))) {
            
            console.log(`💊 Updating medication ${medicationDoc.id} from patient_id ${medicationData.patient_id} to ${patientId}`);
            
            await updateDoc(doc(db, 'medications', medicationDoc.id), {
              patient_id: patientId,
              updated_at: new Date().toISOString()
            });
            
            updatedMedicationsCount++;
          }
        }
      }
      
      console.log(`=== SYNC COMPLETE ===`);
      console.log(`📊 Results:
        - Medical history records updated: ${updatedMedHistoryCount}
        - Medication records updated: ${updatedMedicationsCount}`);
      
      toast({
        title: "Sync Complete",
        description: `Updated ${updatedMedHistoryCount} medical history and ${updatedMedicationsCount} medication records.`,
      });
      
    } catch (error) {
      console.error("Error syncing medical records:", error);
      toast({
        title: "Sync Error",
        description: "Failed to sync medical records. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Sync patient with Firebase Auth UID
  const handleSyncPatientWithAuth = async () => {
    try {
      const currentPatientId = prompt('Enter the current patient document ID:');
      const firebaseAuthUid = prompt('Enter the Firebase Auth UID:');
      
      if (!currentPatientId || !firebaseAuthUid) {
        toast({
          title: "Invalid Input",
          description: "Both current patient ID and Firebase Auth UID are required.",
          variant: "destructive"
        });
        return;
      }
      
      console.log('=== STARTING PATIENT FIREBASE AUTH SYNC ===');
      console.log(`Current Patient ID: ${currentPatientId}`);
      console.log(`Firebase Auth UID: ${firebaseAuthUid}`);
      
      // Import the sync function
      const { syncPatientWithFirebaseAuth } = await import('@/services/firebase/patients');
      
      // Perform the sync
      await syncPatientWithFirebaseAuth(currentPatientId, firebaseAuthUid);
      
      toast({
        title: "Sync Complete",
        description: `Successfully synced patient ${currentPatientId} with Firebase Auth UID ${firebaseAuthUid}`,
      });
      
      // Refresh the page data
      window.location.reload();
      
    } catch (error) {
      console.error("Error syncing patient with Firebase Auth:", error);
      toast({
        title: "Sync Error",
        description: "Failed to sync patient with Firebase Auth. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Detect and fix patient-medical history sync issues
  const handleDetectAndFixSyncIssues = async () => {
    try {
      console.log('=== DETECTING PATIENT-MEDICAL HISTORY SYNC ISSUES ===');
      
      // Get all data
      const patientsSnapshot = await getDocs(collection(db, 'patients'));
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const medicalHistorySnapshot = await getDocs(collection(db, 'medical_history'));
      const medicationsSnapshot = await getDocs(collection(db, 'medications'));
      
      const patients = patientsSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      const users = usersSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      const medicalHistories = medicalHistorySnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      const medications = medicationsSnapshot.docs.map(doc => ({
        documentId: doc.id,
        ...doc.data()
      })) as any[];
      
      console.log(`📊 Data Summary:
        - Patients: ${patients.length}
        - Users: ${users.length}
        - Medical Histories: ${medicalHistories.length}
        - Medications: ${medications.length}`);
      
      let issuesFound = [];
      let autoFixedCount = 0;
      
      // Check each patient for sync issues
      for (const patient of patients) {
        const patientId = patient.documentId;
        const userId = patient.user_id;
        
        // Find corresponding user
        const correspondingUser = users.find(u => u.documentId === patientId || u.documentId === userId);
        
        // Check if patient document ID matches user document ID
        if (!correspondingUser || correspondingUser.documentId !== patientId) {
          issuesFound.push({
            type: 'patient_user_mismatch',
            patientId: patientId,
            userId: userId,
            patientName: `${patient.first_name} ${patient.last_name}`,
            issue: `Patient document ID ${patientId} doesn't match user document ID`
          });
        }
        
        // Check medical history records
        const patientMedicalHistories = medicalHistories.filter(mh => 
          mh.patient_id === patientId || 
          mh.patient_id === userId ||
          (mh.patient_email && mh.patient_email === patient.email)
        );
        
        for (const medHistory of patientMedicalHistories) {
          if (medHistory.patient_id !== patientId) {
            issuesFound.push({
              type: 'medical_history_mismatch',
              patientId: patientId,
              medicalHistoryId: medHistory.documentId,
              wrongPatientId: medHistory.patient_id,
              correctPatientId: patientId,
              patientName: `${patient.first_name} ${patient.last_name}`,
              canAutoFix: true
            });
          }
        }
        
        // Check medication records
        const patientMedications = medications.filter(med => 
          med.patient_id === patientId || 
          med.patient_id === userId ||
          (med.patient_email && med.patient_email === patient.email)
        );
        
        for (const medication of patientMedications) {
          if (medication.patient_id !== patientId) {
            issuesFound.push({
              type: 'medication_mismatch',
              patientId: patientId,
              medicationId: medication.documentId,
              wrongPatientId: medication.patient_id,
              correctPatientId: patientId,
              patientName: `${patient.first_name} ${patient.last_name}`,
              canAutoFix: true
            });
          }
        }
      }
      
      console.log(`🔍 Found ${issuesFound.length} sync issues:`, issuesFound);
      
      if (issuesFound.length === 0) {
        toast({
          title: "No Issues Found",
          description: "All patient records are properly synchronized.",
        });
        return;
      }
      
      // Auto-fix the issues that can be fixed
      const autoFixableIssues = issuesFound.filter(issue => issue.canAutoFix);
      
      if (autoFixableIssues.length > 0) {
        const confirmFix = confirm(`Found ${issuesFound.length} sync issues. ${autoFixableIssues.length} can be automatically fixed. Proceed with auto-fix?`);
        
        if (confirmFix) {
          for (const issue of autoFixableIssues) {
            try {
              if (issue.type === 'medical_history_mismatch') {
                await updateDoc(doc(db, 'medical_history', issue.medicalHistoryId), {
                  patient_id: issue.correctPatientId,
                  updated_at: serverTimestamp()
                });
                console.log(`✅ Fixed medical history ${issue.medicalHistoryId}`);
                autoFixedCount++;
              } else if (issue.type === 'medication_mismatch') {
                await updateDoc(doc(db, 'medications', issue.medicationId), {
                  patient_id: issue.correctPatientId,
                  updated_at: new Date().toISOString()
                });
                console.log(`✅ Fixed medication ${issue.medicationId}`);
                autoFixedCount++;
              }
            } catch (fixError) {
              console.error(`Error fixing issue:`, issue, fixError);
            }
          }
        }
      }
      
      console.log(`=== SYNC ISSUE DETECTION COMPLETE ===`);
      console.log(`📊 Results:
        - Issues found: ${issuesFound.length}
        - Auto-fixed: ${autoFixedCount}
        - Manual intervention needed: ${issuesFound.length - autoFixedCount}`);
      
      // Display results to user
      let message = `Found ${issuesFound.length} sync issues.`;
      if (autoFixedCount > 0) {
        message += ` Auto-fixed ${autoFixedCount} issues.`;
      }
      if (issuesFound.length - autoFixedCount > 0) {
        message += ` ${issuesFound.length - autoFixedCount} issues require manual intervention.`;
      }
      
      toast({
        title: "Sync Issue Detection Complete",
        description: message,
      });
      
      // Refresh the page if any fixes were made
      if (autoFixedCount > 0) {
        setTimeout(() => window.location.reload(), 2000);
      }
      
    } catch (error) {
      console.error("Error detecting sync issues:", error);
      toast({
        title: "Detection Error",
        description: "Failed to detect sync issues. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Auto-sync patient with Firebase Auth UID by email
  const handleAutoSyncPatientWithAuthUID = async () => {
    try {
      const patientEmail = prompt('Enter the patient email address:');
      const firebaseAuthUID = prompt('Enter the Firebase Auth UID:');
      
      if (!patientEmail || !firebaseAuthUID) {
        toast({
          title: "Invalid Input",
          description: "Both patient email and Firebase Auth UID are required.",
          variant: "destructive"
        });
        return;
      }
      
      console.log('=== STARTING AUTO-SYNC PATIENT WITH AUTH UID ===');
      console.log(`Patient Email: ${patientEmail}`);
      console.log(`Firebase Auth UID: ${firebaseAuthUID}`);
      
      // Import the auto-sync function
      const { autoSyncPatientWithAuthUID } = await import('@/services/firebase/patients');
      
      // Perform the auto-sync
      await autoSyncPatientWithAuthUID(patientEmail, firebaseAuthUID);
      
      toast({
        title: "Auto-Sync Complete",
        description: `Successfully synced patient ${patientEmail} with Firebase Auth UID ${firebaseAuthUID}`,
      });
      
      // Refresh the page data
      window.location.reload();
      
    } catch (error) {
      console.error("Error auto-syncing patient with Firebase Auth UID:", error);
      toast({
        title: "Auto-Sync Error",
        description: "Failed to auto-sync patient. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // Verify patient entity synchronization
  const handleVerifyPatientEntitySync = async () => {
    try {
      const firebaseAuthUID = prompt('Enter the Firebase Auth UID to verify:');
      
      if (!firebaseAuthUID) {
        toast({
          title: "Invalid Input",
          description: "Firebase Auth UID is required.",
          variant: "destructive"
        });
        return;
      }
      
      console.log('=== VERIFYING PATIENT ENTITY SYNC ===');
      console.log(`Firebase Auth UID: ${firebaseAuthUID}`);
      
      // Import the verification function
      const { verifyPatientEntitySync } = await import('@/services/firebase/patients');
      
      // Perform the verification
      const results = await verifyPatientEntitySync(firebaseAuthUID);
      
      const status = results.synced ? "SYNCED ✅" : "NOT SYNCED ❌";
      
      toast({
        title: `Entity Sync Status: ${status}`,
        description: `User: ${results.details.userEntityExists ? '✅' : '❌'} | Patient: ${results.details.patientEntityExists ? '✅' : '❌'} | Medical Records: ${results.details.medicalHistoryRecords}`,
      });
      
      console.log('=== VERIFICATION COMPLETE ===');
      console.log('Check console for detailed results');
      
    } catch (error) {
      console.error("Error verifying patient entity sync:", error);
      toast({
        title: "Verification Error",
        description: "Failed to verify entity sync. Check console for errors.",
        variant: "destructive"
      });
    }
  }

  // --- END OF ALL HANDLER/HELPER FUNCTIONS ---

  // MAIN RETURN for Account component (must be at top level of Account function)
  const filteredAccounts = accounts.filter(account =>
    account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.role.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const caregiverAccounts = filteredAccounts.filter(acc => acc.role === 'caregiver');
  const patientAccounts = filteredAccounts.filter(acc => acc.role === 'patient');

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
          <h1 className="text-5xl font-bold text-foreground">Account Management</h1>
          <p className="text-xl text-muted-foreground">
            Create and manage accounts for caregivers and patients
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          <TabsTrigger value="guardians">Patients ({patientAccounts.length})</TabsTrigger>
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
            getStatusColor={getStatusColor}
            getRoleIcon={getRoleIcon}
            getAccountDisplayName={getAccountDisplayName}
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
            getStatusColor={getStatusColor}
            getRoleIcon={getRoleIcon}
            getAccountDisplayName={getAccountDisplayName}
          />
        </TabsContent>

        <TabsContent value="guardians">
          <AccountList 
            accounts={patientAccounts} 
            caregivers={caregivers}
            patients={patients}
            onViewAccount={setViewingAccount} 
            onSuspendAccount={setSuspendingAccount}
            onCreateFirebaseAuth={handleCreateFirebaseAuthForAccount}
            creatingAuthForAccount={creatingAuthForAccount}
            getStatusColor={getStatusColor}
            getRoleIcon={getRoleIcon}
            getAccountDisplayName={getAccountDisplayName}
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
            getStatusColor={getStatusColor}
            getRoleIcon={getRoleIcon}
            getAccountDisplayName={getAccountDisplayName}
          />
        </TabsContent>
      </Tabs>

      {/* Create Account Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Account</DialogTitle>
            <DialogDescription>
              Create a new account for a caregiver or patient. An email with login credentials will be sent automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8">
            <h2 className="text-2xl font-bold">Create New Account</h2>
            <p className="text-base text-muted-foreground">
              Create a new account for a caregiver or patient. An email with login credentials will be sent automatically.
            </p>

            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Basic Information</h3>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-base font-medium">Account Role *</Label>
                <Select value={formData.role} onValueChange={value => handleInputChange('role', value)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select account role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="caregiver" className="text-base">Caregiver</SelectItem>
                    <SelectItem value="patient" className="text-base">Patient</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium">Contact Email Address *</Label>
                <Select 
                  value={formData.email} 
                  onValueChange={value => handleInputChange('email', value)}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder={`Select ${formData.role === 'caregiver' ? 'caregiver' : 'patient'} email`} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.role === 'caregiver' && caregivers
                      .filter(caregiver => caregiver.email && caregiver.email.trim() !== '')
                      .filter((caregiver, index, arr) => arr.findIndex(c => c.email === caregiver.email) === index)
                      .map(caregiver => (
                        <SelectItem key={`caregiver-${caregiver.caregiver_id}`} value={caregiver.email} className="text-base">
                          {caregiver.email} - {caregiver.first_name} {caregiver.last_name} (Caregiver)
                        </SelectItem>
                      ))}
                    {formData.role === 'patient' && patients
                      .filter(patient => patient.email && patient.email.trim() !== '')
                      .filter((patient, index, arr) => arr.findIndex(p => p.email === patient.email) === index)
                      .map(patient => (
                        <SelectItem key={`patient-${patient.patient_id}`} value={patient.email} className="text-base">
                          {patient.email} - {patient.first_name} {patient.last_name} (Patient)
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-base font-medium">Welcome Message (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={e => handleInputChange('notes', e.target.value)}
                  className="h-20 text-base"
                  placeholder="Enter a welcome message that will be included in the account creation email..."
                />
              </div>
              <p className="text-base text-muted-foreground">
                The email will include a verification link that the user must click to activate their account and confirm it's ready for login.
              </p>
            </div>

            {formData.generated_email && formData.generated_password && (
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">Generated Login Credentials Preview</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-base font-medium text-slate-900">Generated Login Email</Label>
                    <Input
                      value={formData.generated_email}
                      readOnly
                      className="font-mono text-blue-600 bg-white text-base h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-medium text-slate-900">Generated Password</Label>
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
  creatingAuthForAccount,
  getStatusColor,
  getRoleIcon,
  getAccountDisplayName
}: {
  accounts: Account[]
  caregivers: Caregiver[]
  patients: Patient[]
  onViewAccount: (account: Account) => void
  onSuspendAccount: (id: string) => void
  onCreateFirebaseAuth: (accountId: string) => void
  creatingAuthForAccount: string | null
  getStatusColor: (status: Account['status']) => string
  getRoleIcon: (role: Account['role']) => JSX.Element
  getAccountDisplayName: (account: Account) => string
}) => {
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
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Role</TableHead>
                <TableHead className="min-w-[150px]">Name</TableHead>
                <TableHead className="min-w-[180px]">Contact Email</TableHead>
                <TableHead className="min-w-[180px]">Login Email</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[120px]">Verification</TableHead>
                <TableHead className="min-w-[100px]">Created</TableHead>
                <TableHead className="min-w-[100px]">Last Login</TableHead>
                <TableHead className="text-right min-w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="p-2 bg-gray-50 rounded-lg w-fit">
                      {getRoleIcon(account.role)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-semibold">{getAccountDisplayName(account)}</div>
                      <div className="text-sm text-muted-foreground capitalize">{account.role}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{account.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm text-blue-600">
                      {account.generated_email || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(account.status)} variant="secondary">
                      {account.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {account.createdAt?.seconds 
                        ? new Date(account.createdAt.seconds * 1000).toLocaleDateString() 
                        : 'Unknown'
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {account.lastLogin?.seconds 
                        ? new Date(account.lastLogin.seconds * 1000).toLocaleDateString() 
                        : 'Never'
                      }
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewAccount(account)}
                        className="h-9 px-3"
                        title="View Details"
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
                        title={account.status === 'suspended' ? 'Activate Account' : 'Suspend Account'}
                      >
                        {account.status === 'suspended' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
export default Account
