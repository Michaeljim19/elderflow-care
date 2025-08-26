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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { Caregiver, ShiftType, CaregiverRole, getMaxPatientsForShift } from '@/types';
import { addCaregiverShift } from './caregiverShifts';

// Helper function to delete existing shift records for a caregiver
const deleteExistingShiftRecords = async (caregiverId: string): Promise<void> => {
  try {
    console.log(`Deleting existing shift records for caregiver ${caregiverId}`);
    
    // Query for all shifts for this caregiver
    const shiftsQuery = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      where('caregiver_id', '==', caregiverId)
    );
    
    const querySnapshot = await getDocs(shiftsQuery);
    
    if (querySnapshot.empty) {
      console.log(`No existing shift records found for caregiver ${caregiverId}`);
      return;
    }
    
    // Delete all shift records for this caregiver
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`✅ Deleted ${querySnapshot.size} shift records for caregiver ${caregiverId}`);
    
  } catch (error) {
    console.error(`Error deleting shift records for caregiver ${caregiverId}:`, error);
    throw error;
  }
};

// Helper function to create initial shift records for a new caregiver
const createInitialShiftRecords = async (caregiverId: string, shiftType: ShiftType, startDate: Timestamp, endDate: Timestamp): Promise<void> => {
  try {
    console.log(`Creating initial shift records for caregiver ${caregiverId}`);
    
    // Determine shift times based on shift type
    const { startTimeStr, endTimeStr } = shiftType === 'Day' 
      ? { startTimeStr: '07:00', endTimeStr: '19:00' }
      : { startTimeStr: '19:00', endTimeStr: '07:00' };
    
    // Helper function to convert time string to Timestamp with a specific date
    const timeToTimestamp = (timeString: string, date: Date): Timestamp => {
      const [hours, minutes] = timeString.split(':').map(Number);
      const timeDate = new Date(date);
      timeDate.setHours(hours, minutes, 0, 0);
      return Timestamp.fromDate(timeDate);
    };
    
    const startDateObj = startDate.toDate();
    const endDateObj = endDate.toDate();
    const shiftRecords: Promise<string>[] = [];
    
    // Create shift records for each day in the range
    for (let date = new Date(startDateObj); date <= endDateObj; date.setDate(date.getDate() + 1)) {
      const shiftData = {
        caregiver_id: caregiverId,
        shift_date: Timestamp.fromDate(new Date(date)),
        shift_type: shiftType,
        start_time: timeToTimestamp(startTimeStr, date),
        end_time: timeToTimestamp(endTimeStr, date),
        notes: "Initial schedule assignment",
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };
      
      shiftRecords.push(addCaregiverShift(shiftData));
    }
    
    // Wait for all shift records to be created
    const createdShiftIds = await Promise.all(shiftRecords);
    console.log(`✅ Created ${createdShiftIds.length} initial shift records for caregiver ${caregiverId}`);
    
  } catch (error) {
    console.error('Error creating initial shift records:', error);
    throw error;
  }
};

// Firebase caregiver data type - matches your Firebase structure
type FirebaseCaregiver = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  birthday?: string;
  email: string;
  contact_number: number;
  address?: {
    province: string;
    city_municipality: string;
    barangay: string;
    street: string;
  };
  shift_type: ShiftType;
  shift_start_date?: Timestamp;
  shift_end_date?: Timestamp;
  role: CaregiverRole;
  assigned_patients_count?: number;
  max_patients?: number;
  status?: 'Active' | 'Inactive'; // Add status field
  created_at?: Timestamp;
  updated_at?: Timestamp;
  license_number?: string;        // Add this field
  license_picture?: string;       // Add this field
  // Contract information
  contract_start_date?: string;
  contract_end_date?: string;
  temporary_schedule_reason?: string;
  original_shift_type?: 'Day' | 'Night';
  original_shift_start_date?: any;
  original_shift_end_date?: any;
};

// Get all caregivers
export const getCaregivers = async (): Promise<Caregiver[]> => {
  try {
    // Fetch caregivers from users collection where user_lvl is 'caregiver'
    const usersQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('user_lvl', '==', 'caregiver'),
      orderBy('first_name')
    );
    
    const querySnapshot = await getDocs(usersQuery);
    const caregiverUsers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as any));
    
    // Convert User objects to Caregiver objects
    return caregiverUsers.map((user: any) => ({
      caregiver_id: user.uid,
      user_id: user.uid,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      contact_number: user.contact_number || (user.phone ? parseInt(user.phone) : 0),
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
      // Add other fields that might be in user object
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
      original_shift_end_date: user.original_shift_end_date
    })) as Caregiver[];
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    throw error;
  }
};

// Get caregiver by ID
export const getCaregiver = async (caregiverId: string): Promise<Caregiver | null> => {
  try {
    // Fetch caregiver from users collection using UID
    const { getUserByUID } = await import('./users');
    const user = await getUserByUID(caregiverId);
    
    if (user && user.user_lvl === 'caregiver') {
      // Convert User object to Caregiver object
      return {
        caregiver_id: user.uid,
        user_id: user.uid,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        contact_number: user.phone ? parseInt(user.phone) : 0,
        shift_type: (user as any).shift_type || 'Day',
        role: (user as any).role || 'caregiver',
        hire_date: (user as any).hire_date || new Date().toISOString(),
        status: (user as any).status || 'Active',
        assigned_patients_count: (user as any).assigned_patients_count || 0,
        max_patients: (user as any).max_patients || 2,
        license_number: user.license_number || '',
        license_picture: user.license_image_base64 || '',
        created_at: user.created_at,
        updated_at: user.updated_at,
        // Add other fields that might be in user object
        middle_name: (user as any).middle_name,
        birthday: user.date_of_birth,
        address: (user as any).address,
        shift_start_date: (user as any).shift_start_date,
        shift_end_date: (user as any).shift_end_date,
        specialization: user.specializations?.join(', '),
        contract_start_date: (user as any).contract_start_date,
        contract_end_date: (user as any).contract_end_date,
        temporary_schedule_reason: (user as any).temporary_schedule_reason,
        original_shift_type: (user as any).original_shift_type,
        original_shift_start_date: (user as any).original_shift_start_date,
        original_shift_end_date: (user as any).original_shift_end_date
      } as Caregiver;
    }
    return null;
  } catch (error) {
    console.error('Error fetching caregiver:', error);
    throw error;
  }
};

// Add new caregiver
export const addCaregiver = async (caregiver: FirebaseCaregiver): Promise<string> => {
  try {
    // Check if user is authenticated
    const currentUser = auth.currentUser;
    console.log('Current user:', currentUser);
    console.log('Attempting to add caregiver:', caregiver);
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Create user account with all caregiver data stored in users collection
    let tempPassword: string | undefined;
    let user_id: string | undefined;
    
    try {
      const { createCaregiverUserAccount } = await import('./users');
      
      const userAccount = await createCaregiverUserAccount({
        ...caregiver,
        assigned_patients_count: 0, // Initialize to 0
        max_patients: getMaxPatientsForShift(caregiver.shift_type), // Set based on shift type
        status: 'Active' // Default to Active status for new caregivers
      });
      
      tempPassword = userAccount.tempPassword;
      user_id = userAccount.uid;
      
      console.log(`Created caregiver user account for ${caregiver.first_name} ${caregiver.last_name}:`);
      console.log(`Email: ${userAccount.user.email}`);
      console.log(`Temporary Password: ${tempPassword}`);
      console.log('⚠️ Share this temporary password with the caregiver for initial login');
      
      // Create initial shift records if schedule dates are provided
      if (caregiver.shift_start_date && caregiver.shift_end_date) {
        try {
          await createInitialShiftRecords(
            user_id, // Use user_id as caregiver_id
            caregiver.shift_type, 
            caregiver.shift_start_date, 
            caregiver.shift_end_date
          );
          console.log('Successfully created initial shift records for new caregiver');
        } catch (shiftError) {
          console.error('Failed to create initial shift records:', shiftError);
          // Don't throw error here - caregiver is already created successfully
        }
      } else {
        console.log('No schedule dates provided, skipping initial shift creation');
      }
      
      // Return the user UID as the caregiver ID since everything is stored in users collection
      return user_id;
      
    } catch (userError) {
      console.error('Error creating caregiver user account:', userError);
      throw userError;
    }
    
  } catch (error) {
    console.error('Error adding caregiver:', error);
    throw error;
  }
};

// Function to generate shift records for existing caregivers who don't have any
export const generateMissingShiftRecords = async (caregiverId: string): Promise<void> => {
  try {
    console.log(`Generating missing shift records for caregiver ${caregiverId}`);
    
    // Get the caregiver details
    const caregiverDoc = await getDoc(doc(db, COLLECTIONS.CAREGIVERS, caregiverId));
    if (!caregiverDoc.exists()) {
      throw new Error(`Caregiver ${caregiverId} not found`);
    }
    
    const caregiverData = caregiverDoc.data() as FirebaseCaregiver;
    
    // Check if caregiver has schedule dates
    if (!caregiverData.shift_start_date || !caregiverData.shift_end_date) {
      console.log(`Caregiver ${caregiverId} has no schedule dates, skipping shift generation`);
      return;
    }
    
    // Import getCaregiverShifts to check existing shifts
    const { getCaregiverShifts } = await import('./caregiverShifts');
    const existingShifts = await getCaregiverShifts();
    const caregiverShifts = existingShifts.filter(shift => shift.caregiver_id === caregiverId);
    
    if (caregiverShifts.length > 0) {
      console.log(`Caregiver ${caregiverId} already has ${caregiverShifts.length} shift records`);
      return;
    }
    
    // Create shift records
    await createInitialShiftRecords(
      caregiverId,
      caregiverData.shift_type,
      caregiverData.shift_start_date,
      caregiverData.shift_end_date
    );
    
    console.log(`✅ Successfully generated shift records for caregiver ${caregiverId}`);
    
  } catch (error) {
    console.error(`Error generating shift records for caregiver ${caregiverId}:`, error);
    throw error;
  }
};

// Update caregiver
export const updateCaregiver = async (caregiverId: string, updates: Partial<FirebaseCaregiver>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVERS, caregiverId);
    
    // Check if schedule dates are being updated
    const isScheduleUpdated = updates.shift_start_date || updates.shift_end_date || updates.shift_type;
    
    // If shift_type is being updated, update max_patients accordingly
    const updatesWithTimestamp: any = {
      ...updates,
      updated_at: Timestamp.now()
    };
    
    if (updates.shift_type) {
      updatesWithTimestamp.max_patients = getMaxPatientsForShift(updates.shift_type);
    }
    
    await updateDoc(docRef, updatesWithTimestamp);
    
    // If schedule-related fields are updated, regenerate shift records
    if (isScheduleUpdated) {
      try {
        console.log(`Schedule updated for caregiver ${caregiverId}, regenerating shift records...`);
        
        // Get the updated caregiver data
        const updatedCaregiverDoc = await getDoc(docRef);
        if (updatedCaregiverDoc.exists()) {
          const caregiverData = updatedCaregiverDoc.data() as FirebaseCaregiver;
          
          // Delete existing shift records for this caregiver
          await deleteExistingShiftRecords(caregiverId);
          
          // Create new shift records if schedule dates are available
          if (caregiverData.shift_start_date && caregiverData.shift_end_date) {
            await createInitialShiftRecords(
              caregiverId,
              caregiverData.shift_type,
              caregiverData.shift_start_date,
              caregiverData.shift_end_date
            );
            console.log(`✅ Successfully regenerated shift records for caregiver ${caregiverId}`);
          }
        }
      } catch (shiftError) {
        console.error(`Error regenerating shift records for caregiver ${caregiverId}:`, shiftError);
        // Don't throw error here - caregiver update was successful
      }
    }
    
  } catch (error) {
    console.error('Error updating caregiver:', error);
    throw error;
  }
};

// Delete caregiver
export const deleteCaregiver = async (caregiverId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVERS, caregiverId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting caregiver:', error);
    throw error;
  }
};

// Update caregiver patient count
export const updateCaregiverPatientCount = async (caregiverId: string): Promise<void> => {
  try {
    if (!caregiverId) return;
    
    // Get current count of patients assigned to this caregiver for both day and night shifts
    const [dayPatientsSnapshot, nightPatientsSnapshot, legacyPatientsSnapshot] = await Promise.all([
      getDocs(query(
        collection(db, COLLECTIONS.PATIENTS),
        where('assigned_day_caregiver_id', '==', caregiverId)
      )),
      getDocs(query(
        collection(db, COLLECTIONS.PATIENTS),
        where('assigned_night_caregiver_id', '==', caregiverId)
      )),
      getDocs(query(
        collection(db, COLLECTIONS.PATIENTS),
        where('assigned_caregiver_id', '==', caregiverId)
      ))
    ]);
    
    // Calculate total unique patients (avoiding double counting)
    const allPatientIds = new Set([
      ...dayPatientsSnapshot.docs.map(doc => doc.id),
      ...nightPatientsSnapshot.docs.map(doc => doc.id),
      ...legacyPatientsSnapshot.docs.map(doc => doc.id)
    ]);
    
    const currentPatientCount = allPatientIds.size;
    
    // Update the user document (caregiver is now stored in users collection)
    const usersQuery = query(collection(db, 'users'), where('uid', '==', caregiverId));
    const usersSnapshot = await getDocs(usersQuery);
    
    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      await updateDoc(doc(db, 'users', userDoc.id), {
        assigned_patients_count: currentPatientCount,
        updated_at: Timestamp.now()
      });
      
      console.log(`Updated caregiver ${caregiverId} patient count to ${currentPatientCount} in users collection`);
    } else {
      console.warn(`Caregiver ${caregiverId} not found in users collection`);
    }
  } catch (error) {
    console.error('Error updating caregiver patient count:', error);
    throw error;
  }
};

// Sync all caregiver patient counts
export const syncAllCaregiverPatientCounts = async (): Promise<void> => {
  try {
    console.log('Starting sync of all caregiver patient counts...');
    
    // Get all caregivers from users collection
    const usersQuery = query(collection(db, 'users'), where('user_lvl', '==', 'caregiver'));
    const usersSnapshot = await getDocs(usersQuery);
    const caregivers = usersSnapshot.docs;
    
    // Update each caregiver's patient count using the updated function
    const updatePromises = caregivers.map(async (caregiverDoc) => {
      const caregiverData = caregiverDoc.data();
      const caregiverId = caregiverData.uid; // Use the uid from the user data
      await updateCaregiverPatientCount(caregiverId);
      return caregiverId;
    });
    
    const results = await Promise.all(updatePromises);
    console.log('Successfully synced patient counts for all caregivers:', results);
  } catch (error) {
    console.error('Error syncing all caregiver patient counts:', error);
    throw error;
  }
};

// Fix existing caregivers that might be missing patient count fields
export const fixCaregiverFields = async (): Promise<void> => {
  try {
    console.log('Starting fix of caregiver fields...');
    
    // Get all caregivers
    const caregiversSnapshot = await getDocs(collection(db, COLLECTIONS.CAREGIVERS));
    const caregivers = caregiversSnapshot.docs;
    
    // Update each caregiver to ensure they have the required fields
    const updatePromises = caregivers.map(async (caregiverDoc) => {
      const caregiverData = caregiverDoc.data();
      const caregiverId = caregiverDoc.id;
      
      // Check if fields are missing or need updating
      const updates: any = {};
      
      // Set default status if missing
      if (!caregiverData.status) {
        updates.status = 'Active'; // Default to Active for existing caregivers
      }
      
      // Set max_patients based on shift_type if missing
      if (caregiverData.shift_type && (caregiverData.max_patients === undefined || caregiverData.max_patients === null)) {
        updates.max_patients = getMaxPatientsForShift(caregiverData.shift_type);
      }
      
      // Set assigned_patients_count if missing
      if (caregiverData.assigned_patients_count === undefined || caregiverData.assigned_patients_count === null) {
        // Get current count of patients assigned to this caregiver
        const patientsQuery = query(
          collection(db, COLLECTIONS.PATIENTS),
          where('assigned_caregiver_id', '==', caregiverId)
        );
        const patientsSnapshot = await getDocs(patientsQuery);
        updates.assigned_patients_count = patientsSnapshot.size;
      }
      
      // Only update if there are changes needed
      if (Object.keys(updates).length > 0) {
        updates.updated_at = Timestamp.now();
        await updateDoc(caregiverDoc.ref, updates);
        console.log(`Fixed caregiver ${caregiverId}:`, updates);
        return { caregiverId, updates };
      }
      
      return { caregiverId, updates: 'no changes needed' };
    });
    
    const results = await Promise.all(updatePromises);
    console.log('Successfully fixed caregiver fields:', results);
  } catch (error) {
    console.error('Error fixing caregiver fields:', error);
    throw error;
  }
};

// Upload caregiver license picture
export const uploadCaregiverLicense = async (
  caregiverId: string, 
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Check if user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to upload files');
    }

    // Create a simple file name
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const fileName = `${caregiverId}_${timestamp}.${fileExtension}`;
    
    // Use the simplest possible path structure
    const storageRef = ref(storage, `licenses/${fileName}`);

    // Upload the file
    if (onProgress) {
      onProgress(0);
    }

    console.log('Starting upload to:', storageRef.fullPath);
    
    // Upload with metadata to ensure proper content type
    const metadata = {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        caregiverId: caregiverId,
        uploadedBy: currentUser.uid,
        uploadedAt: new Date().toISOString()
      }
    };

    const snapshot = await uploadBytes(storageRef, file, metadata);
    console.log('Upload completed successfully');
    
    if (onProgress) {
      onProgress(100);
    }

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Download URL generated:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading caregiver license:', error);
    if (onProgress) {
      onProgress(0);
    }
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('storage/unauthorized')) {
        throw new Error('You do not have permission to upload files. Please check Firebase Storage rules.');
      } else if (error.message.includes('storage/canceled')) {
        throw new Error('Upload was canceled.');
      } else if (error.message.includes('storage/unknown')) {
        throw new Error('An unknown error occurred during upload. Please try again.');
      }
    }
    
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Alternative license upload using base64 (fallback method)
export const uploadCaregiverLicenseAsBase64 = async (
  caregiverId: string,
  file: File
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (reader.result && typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsDataURL(file);
  });
};