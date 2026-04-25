import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc,
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
import { buildApprovedCaregiverState, buildCaregiverAddressFields } from './caregiverRecordSync';

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

let usersCache: Array<any> | null = null;
let usersCachePromise: Promise<Array<any>> | null = null;

export const invalidateUsersCache = () => {
  usersCache = null;
  usersCachePromise = null;
};

// Create a user document in Firestore without Firebase Auth
export const createUser = async (userData: {
  first_name: string;
  last_name: string;
  email?: string;
  role: 'Patient' | 'Caregiver' | 'Admin' | 'Guardian';
  contact_number: string;
  address: string | Record<string, any>;
  birthdate?: string;
  gender?: 'Male' | 'Female' | 'Other';
  middle_name?: string;
  birthday?: string;
}) => {
  try {
    console.log('Creating user document (no auth):', userData);

    const documentId = doc(collection(db, 'users')).id;
    const isCaregiverRole = String(userData.role || '').toLowerCase() === 'caregiver';
    const addressFields = isCaregiverRole ? buildCaregiverAddressFields(userData.address) : null;
    
    // Create user document in Firestore - ONLY core user data
    const coreUserData: any = {
      uid: documentId,
      user_id: documentId,
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email || '',
      role: userData.role,
      contact_number: userData.contact_number,
      address: addressFields ? JSON.stringify(addressFields.address) : userData.address,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      is_active: true
    };

    if (addressFields) {
      coreUserData.province = addressFields.province;
      coreUserData.city = addressFields.city;
      coreUserData.city_municipality = addressFields.city_municipality;
      coreUserData.barangay = addressFields.barangay;
      coreUserData.street = addressFields.street;
      coreUserData.street_address = addressFields.street_address;
    }

    const birthdateValue = userData.birthdate || userData.birthday;
    if (birthdateValue) {
      coreUserData.birthdate = birthdateValue;
      coreUserData.birthday = birthdateValue;
    }

    if (userData.gender) coreUserData.gender = userData.gender;

    // Only add optional fields if they have values
    if (userData.middle_name) coreUserData.middle_name = userData.middle_name;
    
    // Save to users collection using the generated document ID
    const userDocRef = doc(db, 'users', documentId);
    await setDoc(userDocRef, coreUserData);
    
    console.log('✅ Created user document:', {
      user_id: documentId,
      email: userData.email,
      role: userData.role
    });

    invalidateUsersCache();

    return {
      user_id: documentId,
      email: userData.email || '',
      documentId: documentId,
      uid: documentId
    };
    
  } catch (error: any) {
    console.error('Error creating user document:', error);
    throw new Error(`Failed to create user document: ${error.message}`);
  }
};

// Create a user document with a specific document ID
export const createUserWithId = async (
  documentId: string,
  userData: {
    first_name: string;
    last_name: string;
    email?: string;
    role: 'Patient' | 'Caregiver' | 'Admin' | 'Guardian';
    contact_number: string;
    address: string | Record<string, any>;
    birthdate?: string;
    gender?: 'Male' | 'Female' | 'Other';
    middle_name?: string;
    birthday?: string;
  }
) => {
  try {
    console.log('Creating user document with specific ID:', documentId, userData);
    const isCaregiverRole = String(userData.role || '').toLowerCase() === 'caregiver';
    const addressFields = isCaregiverRole ? buildCaregiverAddressFields(userData.address) : null;
    
    // Create user document in Firestore with specific ID - ONLY core user data
    const coreUserData: any = {
      uid: documentId,
      user_id: documentId, // Set the user_id to match the document ID
      first_name: userData.first_name,
      last_name: userData.last_name,
      email: userData.email || '',
      role: userData.role,
      contact_number: userData.contact_number,
      address: addressFields ? JSON.stringify(addressFields.address) : userData.address,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      is_active: true
    };

    if (addressFields) {
      coreUserData.province = addressFields.province;
      coreUserData.city = addressFields.city;
      coreUserData.city_municipality = addressFields.city_municipality;
      coreUserData.barangay = addressFields.barangay;
      coreUserData.street = addressFields.street;
      coreUserData.street_address = addressFields.street_address;
    }

    const birthdateValue = userData.birthdate || userData.birthday;
    if (birthdateValue) {
      coreUserData.birthdate = birthdateValue;
      coreUserData.birthday = birthdateValue;
    }

    if (userData.gender) coreUserData.gender = userData.gender;

    // Only add optional fields if they have values
    if (userData.middle_name) coreUserData.middle_name = userData.middle_name;
    
    // Save to users collection with specific document ID
    const userDocRef = doc(db, 'users', documentId);
    await setDoc(userDocRef, coreUserData);
    
    console.log('✅ Created user document with ID:', {
      user_id: documentId,
      email: userData.email,
      role: userData.role
    });

    invalidateUsersCache();

    return {
      user_id: documentId,
      email: userData.email || '',
      documentId: documentId
    };
    
  } catch (error: any) {
    console.error('Error creating user document with ID:', error);
    throw new Error(`Failed to create user document with ID: ${error.message}`);
  }
};

const cleanupLegacyCaregiverDocsForAccount = async (caregiverData: any, canonicalUserId: string): Promise<void> => {
  try {
    const caregiversRef = collection(db, 'caregivers');
    const candidateQueries = [
      ...(caregiverData.email ? [query(caregiversRef, where('email', '==', caregiverData.email))] : []),
      ...(caregiverData.generated_email ? [query(caregiversRef, where('generated_email', '==', caregiverData.generated_email))] : []),
      ...(caregiverData.caregiver_id ? [query(caregiversRef, where('caregiver_id', '==', caregiverData.caregiver_id))] : []),
      ...(caregiverData.user_id ? [query(caregiversRef, where('user_id', '==', caregiverData.user_id))] : []),
      ...(caregiverData.uid ? [query(caregiversRef, where('uid', '==', caregiverData.uid))] : []),
      ...(caregiverData.auth_uid ? [query(caregiversRef, where('auth_uid', '==', caregiverData.auth_uid))] : [])
    ];

    const documentIdsToDelete = new Set<string>();

    for (const candidateQuery of candidateQueries) {
      const snapshot = await getDocs(candidateQuery);
      snapshot.docs.forEach((caregiverDoc) => {
        if (caregiverDoc.id !== canonicalUserId) {
          documentIdsToDelete.add(caregiverDoc.id);
        }
      });
    }

    for (const documentId of documentIdsToDelete) {
      await deleteDoc(doc(db, 'caregivers', documentId));
      console.log(`🗑️ Removed legacy caregiver document: ${documentId}`);
    }

    if (documentIdsToDelete.size === 0) {
      console.log(`ℹ️ No legacy caregiver documents found for ${caregiverData.email || canonicalUserId}`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up legacy caregiver documents:', error);
    throw error;
  }
};

const cleanupLegacyUserDocsForCaregiver = async (caregiverData: any, canonicalUserId: string): Promise<void> => {
  try {
    const usersRef = collection(db, 'users');
    const documentIdsToDelete = new Set<string>();
    const emailValue = String(caregiverData.email || caregiverData.generated_email || '').trim().toLowerCase();
    const phoneValue = String(caregiverData.contact_number || caregiverData.phone || '').replace(/\D/g, '');
    const birthdayValue = String(caregiverData.birthday || '').trim();
    const licenseValue = String(caregiverData.license_number || '').trim().toLowerCase();
    const addressValue = String(
      typeof caregiverData.address === 'string'
        ? caregiverData.address
        : caregiverData.address
          ? JSON.stringify(caregiverData.address)
          : ''
    ).trim().toLowerCase();

    const snapshot = await getDocs(usersRef);

    snapshot.docs.forEach((userDoc) => {
      const data = userDoc.data() as any;
      const docFirstName = String(data.first_name || '').trim().toLowerCase();
      const docLastName = String(data.last_name || '').trim().toLowerCase();
      const docEmail = String(data.email || '').trim().toLowerCase();
      const docGeneratedEmail = String(data.generated_email || '').trim().toLowerCase();
      const docCreatedFrom = String(data.createdFrom || '').trim().toLowerCase();
      const docRole = String(data.role || '').trim().toLowerCase();
      const docAuthUid = String(data.auth_uid || data.uid || data.user_id || '').trim();
      const docPhone = String(data.contact_number || data.phone || '').replace(/\D/g, '');
      const docBirthday = String(data.birthday || data.birthdate || data.date_of_birth || '').trim();
      const docLicense = String(data.license_number || '').trim().toLowerCase();
      const docAddress = String(
        typeof data.address === 'string'
          ? data.address
          : data.address
            ? JSON.stringify(data.address)
            : ''
      ).trim().toLowerCase();

      const matchesEmail = emailValue && (docEmail === emailValue || docGeneratedEmail === emailValue);
      const matchesPhone = phoneValue && docPhone === phoneValue;
      const matchesBirthday = birthdayValue && docBirthday === birthdayValue;
      const matchesLicense = licenseValue && docLicense === licenseValue;
      const matchesAddress = addressValue && docAddress === addressValue;
      const looksLikeLegacyCaregiver = docCreatedFrom === 'caregiver_signup' || docRole === 'caregiver' || String(data.user_lvl || '').trim().toLowerCase() === 'caregiver';

        const legacyScore = [matchesEmail, matchesPhone, matchesBirthday, matchesLicense, matchesAddress]
        .filter(Boolean)
        .length;

      if (
        userDoc.id !== canonicalUserId &&
        (
          docCreatedFrom === 'caregiver_signup' ||
          looksLikeLegacyCaregiver ||
          docAuthUid !== canonicalUserId
        ) &&
        (
          docCreatedFrom === 'caregiver_signup' ||
          legacyScore >= 3 ||
          matchesEmail ||
          docGeneratedEmail === emailValue
        )
      ) {
        documentIdsToDelete.add(userDoc.id);
      }

      if (
        userDoc.id !== canonicalUserId &&
        (docCreatedFrom === 'caregiver_signup' || (looksLikeLegacyCaregiver && legacyScore >= 3))
      ) {
        documentIdsToDelete.add(userDoc.id);
      }
    });

    for (const documentId of documentIdsToDelete) {
      await deleteDoc(doc(db, 'users', documentId));
      console.log(`🗑️ Removed legacy users document for caregiver: ${documentId}`);
    }

    if (documentIdsToDelete.size === 0) {
      console.log(`ℹ️ No legacy users documents found for caregiver ${caregiverData.email || canonicalUserId}`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up legacy users documents for caregiver:', error);
    throw error;
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

    const addressFields = buildCaregiverAddressFields(caregiverData);
    const approvedCaregiverState = buildApprovedCaregiverState();
    
    // Create user document in Firestore with all caregiver data
    // Filter out undefined values to prevent Firestore errors
    const userData: any = {
      uid: user.uid,
      user_id: user.uid, // Add user_id field
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
      ...approvedCaregiverState,
      auth_created: true
    };

    // Only add fields if they have values (not undefined/null/empty)
    if (caregiverData.middle_name) userData.middle_name = caregiverData.middle_name;
    if (caregiverData.birthday) userData.birthday = caregiverData.birthday;
    if (caregiverData.contact_number) {
      userData.phone = caregiverData.contact_number?.toString();
      userData.contact_number = caregiverData.contact_number;
    }
    userData.address = JSON.stringify(addressFields.address);
    userData.province = addressFields.province;
    userData.city = addressFields.city;
    userData.city_municipality = addressFields.city_municipality;
    userData.barangay = addressFields.barangay;
    userData.street = addressFields.street;
    userData.street_address = addressFields.street_address;
    if (caregiverData.shift_type) userData.shift_type = caregiverData.shift_type;
    if (caregiverData.shift_start_date) userData.shift_start_date = caregiverData.shift_start_date;
    if (caregiverData.shift_end_date) userData.shift_end_date = caregiverData.shift_end_date;
    if (caregiverData.contract_start_date) userData.contract_start_date = caregiverData.contract_start_date;
    if (caregiverData.contract_end_date) userData.contract_end_date = caregiverData.contract_end_date;
    if (caregiverData.specialization) userData.specialization = caregiverData.specialization;
    
    // Save to users collection using the Auth UID as document ID
    await setDoc(doc(db, 'users', user.uid), userData);

    // Mirror the caregiver-specific document using the same Auth UID
    await setDoc(doc(db, 'caregivers', user.uid), {
      caregiver_id: user.uid,
      user_id: user.uid,
      uid: user.uid,
      first_name: caregiverData.first_name,
      middle_name: caregiverData.middle_name || '',
      last_name: caregiverData.last_name,
      email: user.email,
      contact_number: caregiverData.contact_number || '',
      address: addressFields.address,
      province: addressFields.province,
      city: addressFields.city,
      city_municipality: addressFields.city_municipality,
      barangay: addressFields.barangay,
      street: addressFields.street,
      street_address: addressFields.street_address,
      birthday: caregiverData.birthday || '',
      shift_type: caregiverData.shift_type || '',
      shift_start_date: caregiverData.shift_start_date || null,
      shift_end_date: caregiverData.shift_end_date || null,
      contract_start_date: caregiverData.contract_start_date || null,
      contract_end_date: caregiverData.contract_end_date || null,
      specialization: caregiverData.specialization || '',
      role: 'caregiver',
      user_lvl: 'caregiver',
      status: caregiverData.status || 'Active',
      assigned_patients_count: caregiverData.assigned_patients_count || 0,
      max_patients: caregiverData.max_patients || getMaxPatientsForShift(caregiverData.shift_type),
      license_number: caregiverData.license_number || '',
      license_picture: caregiverData.license_picture || '',
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
      is_active: true,
      ...approvedCaregiverState,
      auth_created: true
    });

    await cleanupLegacyUserDocsForCaregiver(caregiverData, user.uid);
    await cleanupLegacyCaregiverDocsForAccount(caregiverData, user.uid);
    invalidateUsersCache();
    
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
export const getUsers = async (options?: { forceRefresh?: boolean }) => {
  try {
    if (!options?.forceRefresh && usersCache) {
      return usersCache;
    }

    if (!options?.forceRefresh && usersCachePromise) {
      return usersCachePromise;
    }

    const usersRef = collection(db, 'users');
    usersCachePromise = getDocs(usersRef).then((querySnapshot) => {
      const users = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      usersCache = users;
      usersCachePromise = null;
      return users;
    }).catch((error) => {
      usersCachePromise = null;
      throw error;
    });

    return usersCachePromise;
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
      const authUidQuery = query(collection(db, 'users'), where('auth_uid', '==', userId));
      const authUidSnapshot = await getDocs(authUidQuery);

      if (authUidSnapshot.empty) {
        return null;
      }

      const matchedDoc = authUidSnapshot.docs[0];
      return {
        id: matchedDoc.id,
        ...matchedDoc.data()
      } as User & { id: string };
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
    
    invalidateUsersCache();
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
    invalidateUsersCache();
    
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

// Migration function to ensure existing users have uid and user_id set to document ID
// Get caregivers from users collection
export const getCaregivers = async (): Promise<Caregiver[]> => {
  try {
    const q = query(collection(db, 'users'), where('user_lvl', '==', 'caregiver'));
    const querySnapshot = await getDocs(q);
    const caregiverUsers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));
    
    // Convert User objects to Caregiver-compatible objects
    return caregiverUsers.map(user => ({
      caregiver_id: user.uid,
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