import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile,
  getAuth
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { Caregiver, ShiftType, getMaxPatientsForShift, User } from '@/types';

// Generate a temporary password for new users
const generateTemporaryPassword = (): string => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Helper function to generate unique email with timestamp
const generateTimestampEmail = (firstName: string, lastName: string): string => {
  const timestamp = Date.now();
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${timestamp}@elderflow.care`;
};

// Create a user document in Firestore without Firebase Auth
export const createUser = async (userData: {
  first_name: string;
  last_name: string;
  email?: string;
  role: 'Patient' | 'Caregiver' | 'Admin' | 'Guardian';
  contact_number: string;
  address: string;
  middle_name?: string;
}) => {
  try {
    console.log('Creating user document (no auth):', userData);
    
    // Create user document in Firestore - ONLY core user data
    const coreUserData: any = {
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email || '',
      role: userData.role,
      contact_number: userData.contact_number,
      address: userData.address,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      is_active: true
    };

    // Only add optional fields if they have values
    if (userData.middle_name) coreUserData.middle_name = userData.middle_name;
    
    // Save to users collection - let Firestore auto-generate document ID
    const userDocRef = await addDoc(collection(db, 'users'), coreUserData);
    const user_id = userDocRef.id; // Use Firestore document ID as user_id
    
    console.log('✅ Created user document:', {
      user_id: user_id,
      email: userData.email,
      role: userData.role
    });

    return {
      user_id: user_id,
      email: userData.email || '',
      documentId: user_id
    };
    
  } catch (error: any) {
    console.error('Error creating user document:', error);
    throw new Error(`Failed to create user document: ${error.message}`);
  }
};

// Legacy function for backward compatibility - will be deprecated
export const createCaregiverUserAccount = async (caregiverData: any) => {
  let email = caregiverData.email || generateTimestampEmail(caregiverData.first_name, caregiverData.last_name);
  let emailWasGenerated = false;
  
  try {
    console.log('Creating caregiver user account:', caregiverData);
    
    const tempPassword = generateTemporaryPassword();
    
    // Try to create Firebase Auth user with the provided email
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
    } catch (authError: any) {
      // If email already exists, generate a unique one and retry
      if (authError.code === 'auth/email-already-in-use') {
        console.warn(`Email ${email} already exists, generating unique email instead`);
        email = generateTimestampEmail(caregiverData.first_name, caregiverData.last_name);
        emailWasGenerated = true;
        console.log(`Retrying with unique email: ${email}`);
        
        // Retry with the generated email
        userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
      } else {
        // Re-throw other auth errors
        throw authError;
      }
    }
    
    const user = userCredential.user;
    
    // Update user profile
    await updateProfile(user, {
      displayName: `${caregiverData.first_name} ${caregiverData.last_name}`
    });
    
    // Create user document in Firestore with all caregiver data
    // Filter out undefined values to prevent Firestore errors
    const userData: any = {
      uid: user.uid,
      email: user.email,
      role: 'caregiver',
      user_lvl: 'caregiver',
      first_name: caregiverData.first_name,
      last_name: caregiverData.last_name,
      hire_date: new Date().toISOString(),
      status: caregiverData.status || 'Active',
      assigned_patients_count: caregiverData.assigned_patients_count || 0,
      max_patients: caregiverData.max_patients || getMaxPatientsForShift(caregiverData.shift_type),
      license_number: caregiverData.license_number || '',
      license_picture: caregiverData.license_picture || '',
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      is_active: true,
      auth_created: true
    };

    // Only add fields if they have values (not undefined/null/empty)
    if (caregiverData.middle_name) userData.middle_name = caregiverData.middle_name;
    if (caregiverData.birthday) userData.birthday = caregiverData.birthday;
    if (caregiverData.contact_number) {
      userData.phone = caregiverData.contact_number?.toString();
      userData.contact_number = caregiverData.contact_number;
    }
    if (caregiverData.address) userData.address = caregiverData.address;
    if (caregiverData.shift_type) userData.shift_type = caregiverData.shift_type;
    if (caregiverData.shift_start_date) userData.shift_start_date = caregiverData.shift_start_date;
    if (caregiverData.shift_end_date) userData.shift_end_date = caregiverData.shift_end_date;
    if (caregiverData.contract_start_date) userData.contract_start_date = caregiverData.contract_start_date;
    if (caregiverData.contract_end_date) userData.contract_end_date = caregiverData.contract_end_date;
    if (caregiverData.specialization) userData.specialization = caregiverData.specialization;
    
    // Save to users collection using the Auth UID as document ID
    await addDoc(collection(db, 'users'), userData);
    
    console.log('✅ Created caregiver user account:', {
      uid: user.uid,
      email: user.email,
      tempPassword,
      originalEmail: caregiverData.email,
      emailGenerated: emailWasGenerated
    });

    return {
      user,
      uid: user.uid,
      tempPassword,
      generatedEmail: emailWasGenerated ? email : undefined
    };  } catch (error: any) {
    console.error('Error creating caregiver user account:', error);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use a stronger password.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    }
    
    throw new Error(`Failed to create user account: ${error.message}`);
  }
};

// Get all users
export const getUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);
    
    const users: any[] = [];
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw new Error('Failed to fetch users');
  }
};

// Get user by ID
export const getUserById = async (userId: string): Promise<(User & { id: string }) | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return {
      id: userDoc.id,
      ...userDoc.data()
    } as User & { id: string };
  } catch (error) {
    console.error('Error fetching user:', error);
    throw new Error('Failed to fetch user');
  }
};

// Update user
export const updateUser = async (userId: string, updates: any) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updated_at: Timestamp.now()
    });
    
    console.log('User updated successfully');
  } catch (error) {
    console.error('Error updating user:', error);
    throw new Error('Failed to update user');
  }
};

// Delete user
export const deleteUser = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    
    console.log('User deleted successfully');
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new Error('Failed to delete user');
  }
};

// Get users by role
export const getUsersByRole = async (role: string) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', role));
    const querySnapshot = await getDocs(q);
    
    const users: any[] = [];
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error fetching users by role:', error);
    throw new Error('Failed to fetch users by role');
  }
};

// Get caregivers from users collection
export const getCaregivers = async (): Promise<Caregiver[]> => {
  try {
    const q = query(collection(db, 'users'), where('user_lvl', '==', 'caregiver'));
    const querySnapshot = await getDocs(q);
    const caregiverUsers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));
    
    // Convert User objects to Caregiver-compatible objects
    return caregiverUsers.map(user => ({
      caregiver_id: user.uid,
      user_id: user.uid,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      birthday: user.date_of_birth || user.birthday,
      email: user.email,
      contact_number: user.contact_number || (user.phone ? parseInt(user.phone) : 0),
      address: user.address,
      shift_type: user.shift_type || 'Day',
      shift_start_date: user.shift_start_date,
      shift_end_date: user.shift_end_date,
      role: user.role || 'Eldercare',
      hire_date: user.hire_date || new Date().toISOString(),
      status: user.status || 'Active',
      assigned_patients_count: user.assigned_patients_count || 0,
      max_patients: user.max_patients || 2,
      license_number: user.license_number || '',
      license_picture: user.license_image_base64 || user.license_picture || '',
      contract_start_date: user.contract_start_date,
      contract_end_date: user.contract_end_date,
      specialization: user.specializations?.join(', '),
      temporary_schedule_reason: user.temporary_schedule_reason,
      original_shift_type: user.original_shift_type,
      original_shift_start_date: user.original_shift_start_date,
      original_shift_end_date: user.original_shift_end_date,
      auth_created: user.auth_created || false,
      generated_email: user.generated_email,
      generated_password: user.generated_password,
      created_at: user.created_at,
      updated_at: user.updated_at
    })) as Caregiver[];
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    throw error;
  }
};