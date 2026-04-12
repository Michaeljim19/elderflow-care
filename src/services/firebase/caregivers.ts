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

// Get all caregivers with proper User-Caregiver entity linking
export const getCaregivers = async (): Promise<Caregiver[]> => {
  try {
    console.log('🔍 Fetching caregivers with User-Caregiver entity linking...');
    
    // Get all caregiver documents from caregivers collection
    const caregiversSnapshot = await getDocs(collection(db, COLLECTIONS.CAREGIVERS));
    console.log(`🔍 Found ${caregiversSnapshot.docs.length} caregivers in caregivers collection`);
    
    const { getUsers } = await import('./users');
    const allUsers = await getUsers();
    const usersByDocId = new Map(allUsers.map(user => [user.id, user]));
    const usersByUserId = new Map(allUsers.filter(user => user.user_id).map(user => [user.user_id, user]));
    const usersByEmail = new Map(allUsers.filter(user => user.email).map(user => [user.email, user]));

    const caregiversWithUserData = caregiversSnapshot.docs.map((caregiverDoc) => {
      const caregiverData = caregiverDoc.data();
      const caregiver_id = caregiverDoc.id;

      const userData =
        (caregiverData.user_id && (usersByUserId.get(caregiverData.user_id) || usersByDocId.get(caregiverData.user_id))) ||
        usersByDocId.get(caregiver_id) ||
        (caregiverData.email ? usersByEmail.get(caregiverData.email) : null) ||
        ((caregiverData.first_name || caregiverData.last_name)
          ? allUsers.find(user =>
              user.role === 'Caregiver' &&
              caregiverData.first_name &&
              caregiverData.last_name &&
              user.first_name === caregiverData.first_name &&
              user.last_name === caregiverData.last_name
            )
          : null);

      const combinedData: Caregiver = {
        caregiver_id,
        user_id: userData?.user_id || userData?.id || caregiverData.user_id || caregiver_id,
        first_name: userData?.first_name || caregiverData.first_name || '',
        last_name: userData?.last_name || caregiverData.last_name || '',
        email: userData?.email || caregiverData.email || '',
        contact_number: userData?.contact_number || caregiverData.contact_number || 0,
        address: userData?.address || caregiverData.address || '',
        shift_type: caregiverData.shift_type || 'Day',
        shift_start_date: caregiverData.shift_start_date,
        shift_end_date: caregiverData.shift_end_date,
        role: caregiverData.role || 'Eldercare',
        hire_date: caregiverData.hire_date || new Date().toISOString(),
        status: caregiverData.status || 'Active',
        assigned_patients_count: userData?.assigned_patients_count ?? caregiverData.assigned_patients_count ?? 0,
        max_patients: caregiverData.max_patients || getMaxPatientsForShift(caregiverData.shift_type || 'Day'),
        license_number: caregiverData.license_number || '',
        license_picture: caregiverData.license_picture || '',
        contract_start_date: caregiverData.contract_start_date,
        contract_end_date: caregiverData.contract_end_date,
        specialization: caregiverData.specialization,
        middle_name: userData?.middle_name || caregiverData.middle_name,
        birthday: userData?.birthday || caregiverData.birthday || userData?.birthdate,
        temporary_schedule_reason: caregiverData.temporary_schedule_reason,
        original_shift_type: caregiverData.original_shift_type,
        original_shift_start_date: caregiverData.original_shift_start_date,
        original_shift_end_date: caregiverData.original_shift_end_date,
        created_at: caregiverData.created_at || userData?.created_at,
        updated_at: caregiverData.updated_at || userData?.updated_at
      };

      return combinedData;
    });
    
    // Sort by first name
    const sortedCaregivers = caregiversWithUserData.sort((a, b) => 
      (a.first_name || '').localeCompare(b.first_name || '')
    );
    
    console.log(`🔍 Successfully fetched ${sortedCaregivers.length} caregivers`);
    console.log(`🔍 Caregiver emails:`, sortedCaregivers.map(c => c.email).filter(e => e));
    
    return sortedCaregivers;
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    return [];
  }
};

// Get caregiver by ID
export const getCaregiver = async (caregiverId: string): Promise<Caregiver | null> => {
  try {
    // Fetch caregiver from users collection using UID
    const { getUserById } = await import('./users');
    const user = await getUserById(caregiverId);
    
    if (user && user.role === 'Caregiver') {
      // Convert User object to Caregiver object
      return {
        caregiver_id: user.id,
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        contact_number: user.contact_number ? parseInt(user.contact_number) : 0,
        shift_type: (user as any).shift_type || 'Day',
        role: (user as any).role || 'caregiver',
        hire_date: (user as any).hire_date || new Date().toISOString(),
        status: (user as any).status || 'Active',
        assigned_patients_count: (user as any).assigned_patients_count || 0,
        max_patients: (user as any).max_patients || 2,
        license_number: (user as any).license_number || '',
        license_picture: (user as any).license_picture || '',
        created_at: user.created_at,
        updated_at: user.updated_at,
        // Add other fields that might be in user object
        middle_name: (user as any).middle_name,
        birthday: (user as any).birthday,
        address: user.address,
        shift_start_date: (user as any).shift_start_date,
        shift_end_date: (user as any).shift_end_date,
        specialization: (user as any).specialization,
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
export const addCaregiver = async (caregiver: any): Promise<string> => {
  try {
    // Check if user is authenticated
    const currentUser = auth.currentUser;
    console.log('Current user:', currentUser);
    console.log('Attempting to add caregiver:', caregiver);
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    console.log('Creating caregiver with unified document ID approach:', caregiver);

    // Step 1: Generate a single document ID to use for both user and caregiver collections
    const unifiedDocId = doc(collection(db, COLLECTIONS.CAREGIVERS)).id; // Generate a unique ID
    
    try {
      const { createUserWithId } = await import('./users');
      
      // Step 2: Create core user document with the unified ID
      const userAccount = await createUserWithId(unifiedDocId, {
        first_name: caregiver.first_name,
        last_name: caregiver.last_name,
        middle_name: caregiver.middle_name,
        birthday: caregiver.birthday,
        email: caregiver.email,
        role: 'Caregiver',
        contact_number: caregiver.contact_number?.toString() || '',
        address: typeof caregiver.address === 'string' ? caregiver.address : JSON.stringify(caregiver.address)
      });
      
      console.log(`✅ Created core user document for caregiver ${caregiver.first_name} ${caregiver.last_name}:`);
      console.log(`📄 User Document ID: ${unifiedDocId}`);
      console.log(`📧 Email: ${userAccount.email}`);
      console.log(`ℹ️ Note: No automated auth account created, document-only user`);
      
      // Step 3: Create caregiver-specific record with the SAME document ID
      const caregiverSpecificData: any = {
        caregiver_id: unifiedDocId, // Same as user document ID
        user_id: unifiedDocId, // Reference to user document (same ID)
        shift_type: caregiver.shift_type,
        assigned_patients_count: 0, // Initialize to 0
        max_patients: getMaxPatientsForShift(caregiver.shift_type),
        status: 'Active',
        created_at: Timestamp.now(),
        updated_at: Timestamp.now()
      };

      // Only add caregiver-specific fields if they have values
      if (caregiver.hire_date) caregiverSpecificData.hire_date = caregiver.hire_date;
      if (caregiver.license_number) caregiverSpecificData.license_number = caregiver.license_number;
      if (caregiver.license_picture) caregiverSpecificData.license_picture = caregiver.license_picture;
      if (caregiver.specialization) caregiverSpecificData.specialization = caregiver.specialization;
      if (caregiver.shift_start_date) caregiverSpecificData.shift_start_date = caregiver.shift_start_date;
      if (caregiver.shift_end_date) caregiverSpecificData.shift_end_date = caregiver.shift_end_date;
      if (caregiver.contract_start_date) caregiverSpecificData.contract_start_date = caregiver.contract_start_date;
      if (caregiver.contract_end_date) caregiverSpecificData.contract_end_date = caregiver.contract_end_date;

      // Save to caregivers collection using setDoc with the unified ID
      const caregiverDocRef = doc(db, COLLECTIONS.CAREGIVERS, unifiedDocId);
      await setDoc(caregiverDocRef, caregiverSpecificData);
      
      console.log(`✅ Created caregiver-specific record with SAME ID: ${unifiedDocId}`);
      console.log(`🎉 Caregiver ${caregiver.first_name} ${caregiver.last_name} created successfully with unified ID approach!`);
      console.log(`📋 Both user and caregiver documents share ID: ${unifiedDocId}`);
      
      // Create initial shift records if schedule dates are provided
      if (caregiver.shift_start_date && caregiver.shift_end_date) {
        try {
          await createInitialShiftRecords(
            unifiedDocId, // Use unified ID as caregiver_id
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
      
      // Return the unified document ID as the caregiver identifier
      return unifiedDocId;
      
    } catch (userError) {
      console.error('Error creating caregiver with unified ID:', userError);
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
    console.log('Deleting caregiver:', caregiverId);
    
    // First, get the caregiver data to find the corresponding user_id
    const caregiverDoc = await getDoc(doc(db, COLLECTIONS.CAREGIVERS, caregiverId));
    let user_id = null;
    
    if (caregiverDoc.exists()) {
      const caregiverData = caregiverDoc.data();
      user_id = caregiverData.user_id || caregiverId; // Fallback to caregiverId
      console.log(`Found caregiver record with user_id: ${user_id}`);
    } else {
      // If no caregiver-specific record exists, assume caregiverId IS the user_id
      user_id = caregiverId;
      console.log(`No caregiver-specific record found, using caregiverId as user_id: ${user_id}`);
    }
    
    // Check if any patients are assigned to this caregiver
    const patientsQuery = query(
      collection(db, COLLECTIONS.PATIENTS),
      where('assigned_caregiver_id', '==', caregiverId)
    );
    const patientsSnapshot = await getDocs(patientsQuery);
    
    if (!patientsSnapshot.empty) {
      console.log(`Found ${patientsSnapshot.size} patients assigned to caregiver ${caregiverId}`);
      throw new Error(`Cannot delete caregiver. ${patientsSnapshot.size} patient(s) are still assigned to this caregiver. Please reassign patients first.`);
    }
    
    // Check for day shift assignments
    const dayPatientsQuery = query(
      collection(db, COLLECTIONS.PATIENTS),
      where('assigned_day_caregiver_id', '==', caregiverId)
    );
    const dayPatientsSnapshot = await getDocs(dayPatientsQuery);
    
    // Check for night shift assignments
    const nightPatientsQuery = query(
      collection(db, COLLECTIONS.PATIENTS),
      where('assigned_night_caregiver_id', '==', caregiverId)
    );
    const nightPatientsSnapshot = await getDocs(nightPatientsQuery);
    
    const totalAssignments = dayPatientsSnapshot.size + nightPatientsSnapshot.size;
    
    if (totalAssignments > 0) {
      console.log(`Found ${totalAssignments} shift assignments for caregiver ${caregiverId}`);
      throw new Error(`Cannot delete caregiver. ${totalAssignments} shift assignment(s) still exist. Please reassign patients first.`);
    }
    
    // Delete from both collections
    const deletePromises = [];
    
    // Delete from caregivers collection if record exists
    if (caregiverDoc.exists()) {
      deletePromises.push(deleteDoc(doc(db, COLLECTIONS.CAREGIVERS, caregiverId)));
      console.log(`Scheduling deletion of caregiver record: ${caregiverId}`);
    }
    
    // Delete from users collection using user_id
    deletePromises.push(deleteDoc(doc(db, COLLECTIONS.USERS, user_id)));
    console.log(`Scheduling deletion of user record: ${user_id}`);
    
    // Execute all deletions
    await Promise.all(deletePromises);
    
    console.log('Successfully deleted caregiver:', caregiverId);
  } catch (error) {
    console.error('Error deleting caregiver:', error);
    throw error;
  }
};

// Update caregiver patient count
export const updateCaregiverPatientCount = async (caregiverId: string): Promise<void> => {
  try {
    if (!caregiverId) return;
    
    console.log(`🔍 Updating patient count for caregiver: ${caregiverId}`);
    
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
    
    // Debug: Show details of found patients
    console.log(`📊 Patient assignment details for caregiver ${caregiverId}:`);
    console.log(`  🌅 Day shift patients (${dayPatientsSnapshot.size}):`, dayPatientsSnapshot.docs.map(doc => ({id: doc.id, data: doc.data()})));
    console.log(`  🌙 Night shift patients (${nightPatientsSnapshot.size}):`, nightPatientsSnapshot.docs.map(doc => ({id: doc.id, data: doc.data()})));
    console.log(`  📝 Legacy assigned patients (${legacyPatientsSnapshot.size}):`, legacyPatientsSnapshot.docs.map(doc => ({id: doc.id, data: doc.data()})));
    
    // Calculate total unique patients (avoiding double counting)
    const allPatientIds = new Set([
      ...dayPatientsSnapshot.docs.map(doc => doc.id),
      ...nightPatientsSnapshot.docs.map(doc => doc.id),
      ...legacyPatientsSnapshot.docs.map(doc => doc.id)
    ]);
    
    const currentPatientCount = allPatientIds.size;
    
    console.log(`📈 Caregiver ${caregiverId} final count: ${currentPatientCount} assigned patients`);
    console.log(`  Day shift: ${dayPatientsSnapshot.size}, Night shift: ${nightPatientsSnapshot.size}, Legacy: ${legacyPatientsSnapshot.size}`);
    
    // Try multiple strategies to find and update the user document
    let updated = false;
    
    // Strategy 1: Direct document lookup using caregiverId as document ID
    try {
      const userDocRef = doc(db, COLLECTIONS.USERS, caregiverId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        await updateDoc(userDocRef, {
          assigned_patients_count: currentPatientCount,
          updated_at: Timestamp.now()
        });
        console.log(`✅ Updated caregiver ${caregiverId} patient count to ${currentPatientCount} (direct lookup)`);
        updated = true;
      }
    } catch (error) {
      console.warn(`Direct lookup failed for caregiver ${caregiverId}:`, error);
    }
    
    // Strategy 2: Query by user_id field
    if (!updated) {
      try {
        const usersQuery = query(collection(db, COLLECTIONS.USERS), where('user_id', '==', caregiverId));
        const usersSnapshot = await getDocs(usersQuery);
        
        if (!usersSnapshot.empty) {
          const userDoc = usersSnapshot.docs[0];
          await updateDoc(userDoc.ref, {
            assigned_patients_count: currentPatientCount,
            updated_at: Timestamp.now()
          });
          console.log(`✅ Updated caregiver ${caregiverId} patient count to ${currentPatientCount} (user_id query)`);
          updated = true;
        }
      } catch (error) {
        console.warn(`user_id query failed for caregiver ${caregiverId}:`, error);
      }
    }
    
    // Strategy 3: Query by role and match ID patterns
    if (!updated) {
      try {
        const usersQuery = query(collection(db, COLLECTIONS.USERS), where('role', '==', 'Caregiver'));
        const usersSnapshot = await getDocs(usersQuery);
        
        const userDoc = usersSnapshot.docs.find(doc => 
          doc.id === caregiverId || doc.data().user_id === caregiverId
        );
        
        if (userDoc) {
          await updateDoc(userDoc.ref, {
            assigned_patients_count: currentPatientCount,
            updated_at: Timestamp.now()
          });
          console.log(`✅ Updated caregiver ${caregiverId} patient count to ${currentPatientCount} (role query)`);
          updated = true;
        }
      } catch (error) {
        console.warn(`Role query failed for caregiver ${caregiverId}:`, error);
      }
    }
    
    if (!updated) {
      console.warn(`❌ Could not find user document for caregiver ${caregiverId} to update patient count`);
    }
    
  } catch (error) {
    console.error('Error updating caregiver patient count:', error);
    throw error;
  }
};

// Manual function to force sync a specific caregiver (for testing)
export const forceSyncCaregiverPatientCount = async (caregiverId: string): Promise<number> => {
  try {
    console.log(`🔧 FORCE SYNC: Caregiver ${caregiverId}`);
    await updateCaregiverPatientCount(caregiverId);
    
    // Get the updated count by reading back from database
    const userDocRef = doc(db, COLLECTIONS.USERS, caregiverId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const count = userData.assigned_patients_count || 0;
      console.log(`✅ FORCE SYNC RESULT: Caregiver ${caregiverId} now has ${count} patients`);
      return count;
    } else {
      console.warn(`❌ FORCE SYNC: User document not found for caregiver ${caregiverId}`);
      return 0;
    }
  } catch (error) {
    console.error(`❌ FORCE SYNC FAILED for caregiver ${caregiverId}:`, error);
    return 0;
  }
};

// Debug function to check all patient assignments
export const debugPatientAssignments = async (): Promise<void> => {
  try {
    console.log('🔍 === DEBUG: ALL PATIENT ASSIGNMENTS ===');
    
    // Get all patients
    const patientsSnapshot = await getDocs(collection(db, COLLECTIONS.PATIENTS));
    console.log(`📊 Total patients in database: ${patientsSnapshot.size}`);
    
    const assignmentSummary: Record<string, { day: number, night: number, legacy: number }> = {};
    
    patientsSnapshot.docs.forEach(doc => {
      const patient = doc.data();
      const patientId = doc.id;
      
      console.log(`👤 Patient ${patientId}:`, {
        name: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
        assigned_caregiver_id: patient.assigned_caregiver_id || 'none',
        assigned_day_caregiver_id: patient.assigned_day_caregiver_id || 'none', 
        assigned_night_caregiver_id: patient.assigned_night_caregiver_id || 'none'
      });
      
      // Count assignments per caregiver
      if (patient.assigned_caregiver_id) {
        if (!assignmentSummary[patient.assigned_caregiver_id]) {
          assignmentSummary[patient.assigned_caregiver_id] = { day: 0, night: 0, legacy: 0 };
        }
        assignmentSummary[patient.assigned_caregiver_id].legacy++;
      }
      
      if (patient.assigned_day_caregiver_id) {
        if (!assignmentSummary[patient.assigned_day_caregiver_id]) {
          assignmentSummary[patient.assigned_day_caregiver_id] = { day: 0, night: 0, legacy: 0 };
        }
        assignmentSummary[patient.assigned_day_caregiver_id].day++;
      }
      
      if (patient.assigned_night_caregiver_id) {
        if (!assignmentSummary[patient.assigned_night_caregiver_id]) {
          assignmentSummary[patient.assigned_night_caregiver_id] = { day: 0, night: 0, legacy: 0 };
        }
        assignmentSummary[patient.assigned_night_caregiver_id].night++;
      }
    });
    
    console.log('📈 === ASSIGNMENT SUMMARY BY CAREGIVER ===');
    Object.entries(assignmentSummary).forEach(([caregiverId, counts]) => {
      const total = counts.day + counts.night + counts.legacy;
      console.log(`👨‍⚕️ Caregiver ${caregiverId}: ${total} patients (Day: ${counts.day}, Night: ${counts.night}, Legacy: ${counts.legacy})`);
    });
    
    console.log('✅ === DEBUG COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Error in debug function:', error);
  }
};

// Sync all caregiver patient counts
export const syncAllCaregiverPatientCounts = async (): Promise<void> => {
  try {
    console.log('🔄 Starting sync of all caregiver patient counts...');
    
    // Get all caregivers using the getCaregivers function to ensure we get the right data
    const caregivers = await getCaregivers();
    console.log(`Found ${caregivers.length} caregivers to sync`);
    
    // Update each caregiver's patient count
    const updatePromises = caregivers.map(async (caregiver) => {
      try {
        // Use both caregiver_id and user_id to ensure we update the right record
        const caregiverId = caregiver.caregiver_id || caregiver.user_id;
        if (caregiverId) {
          await updateCaregiverPatientCount(caregiverId);
          return { caregiverId, status: 'success' };
        } else {
          console.warn('Caregiver has no caregiver_id or user_id:', caregiver);
          return { caregiverId: 'unknown', status: 'skipped - no ID' };
        }
      } catch (error) {
        console.error(`Error updating patient count for caregiver:`, caregiver, error);
        return { caregiverId: caregiver.caregiver_id || caregiver.user_id || 'unknown', status: 'error', error };
      }
    });
    
    const results = await Promise.all(updatePromises);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const skippedCount = results.filter(r => r.status.includes('skipped')).length;
    
    console.log(`✅ Sync completed: ${successCount} updated, ${errorCount} errors, ${skippedCount} skipped`);
    
    if (errorCount > 0) {
      console.warn('Some caregivers failed to sync:', results.filter(r => r.status === 'error'));
    }
    
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