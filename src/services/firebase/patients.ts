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
import { db } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { Patient, Caregiver } from '@/types';
import { updateCaregiverPatientCount } from './caregivers';

const generateLettersOnlyId = (prefix = 'patient', length = 12) => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let suffix = '';

  for (let index = 0; index < length; index++) {
    suffix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }

  return `${prefix}${suffix}`;
};

// Get all patients with retry logic using User-centered approach
export const getPatients = async (): Promise<Patient[]> => {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to fetch patients with User-centered approach...`);
      
      // Get all patient documents
      const patientsSnapshot = await getDocs(collection(db, COLLECTIONS.PATIENTS));
      console.log(`Found ${patientsSnapshot.docs.length} patient records`);
      
      const { getUsers } = await import('./users');
      const allUsers = await getUsers();
      const usersByDocId = new Map(allUsers.map(user => [user.id, user]));
      const usersByUserId = new Map(allUsers.filter(user => user.user_id).map(user => [user.user_id, user]));
      const usersByEmail = new Map(allUsers.filter(user => user.email).map(user => [user.email, user]));

      const patientsWithUserData = patientsSnapshot.docs.map((patientDoc) => {
        const patientData = patientDoc.data();
        const patient_id = patientDoc.id;

        const userData =
          (patientData.user_id && (usersByUserId.get(patientData.user_id) || usersByDocId.get(patientData.user_id))) ||
          usersByDocId.get(patient_id) ||
          (patientData.email ? usersByEmail.get(patientData.email) : null) ||
          ((patientData.first_name || patientData.last_name)
            ? allUsers.find(user =>
                patientData.first_name &&
                patientData.last_name &&
                user.first_name === patientData.first_name &&
                user.last_name === patientData.last_name
              )
            : null);

        const combinedData = {
          patient_id,
          ...patientData,
          ...(userData && {
            first_name: userData.first_name || patientData.first_name,
            last_name: userData.last_name || patientData.last_name,
            birthday: userData.birthday || patientData.birthday,
            email: userData.email || patientData.email,
            contact_number: userData.contact_number || patientData.contact_number,
            address: userData.address || patientData.address,
            is_active: userData.is_active !== undefined ? userData.is_active : patientData.is_active,
            user_id: userData.user_id || userData.id || patientData.user_id
          })
        } as Patient;

        return combinedData;
      });
      
      // Sort by first name
      const sortedPatients = patientsWithUserData.sort((a, b) => 
        (a.first_name || '').localeCompare(b.first_name || '')
      );
      
      console.log(`Successfully fetched and merged ${sortedPatients.length} patients with user data`);
      return sortedPatients;
      
    } catch (error: any) {
      console.error(`Error fetching patients (attempt ${attempt}):`, error);
      lastError = error;
      
      // If it's a QUIC protocol error or network error, wait and retry
      if (attempt < maxRetries && (
        error.message?.includes('QUIC') || 
        error.message?.includes('network') ||
        error.code === 'unavailable'
      )) {
        console.log(`Retrying in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }
      
      // If we've exhausted retries or it's a different error, throw
      throw error;
    }
  }
  
  throw lastError;
}

// Get patient by ID using User-centered approach
export const getPatient = async (patientId: string): Promise<Patient | null> => {
  try {
    console.log('[DEBUG] getPatient called with ID:', patientId);
    console.log('[DEBUG] Patient ID type:', typeof patientId, 'Length:', patientId.length);
    
    // Get patient document
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    const docSnap = await getDoc(docRef);
    
    console.log('[DEBUG] Document exists:', docSnap.exists());
    
    if (!docSnap.exists()) {
      console.warn('[DEBUG] Patient document does not exist for ID:', patientId);
      
      // Debug: List all patient documents to help identify the issue
      try {
        const allPatientsSnapshot = await getDocs(collection(db, COLLECTIONS.PATIENTS));
        const allPatientIds = allPatientsSnapshot.docs.map(doc => doc.id);
        console.log('[DEBUG] All patient IDs in database:', allPatientIds);
        console.log('[DEBUG] Total patients in database:', allPatientIds.length);
        console.log('[DEBUG] Does the requested ID exist?', allPatientIds.includes(patientId));
        
        // Check for similar IDs (in case of typos)
        const similarIds = allPatientIds.filter(id => 
          id.includes(patientId) || patientId.includes(id) || 
          id.toLowerCase() === patientId.toLowerCase()
        );
        if (similarIds.length > 0) {
          console.log('[DEBUG] Similar patient IDs found:', similarIds);
        }
      } catch (debugError) {
        console.error('[DEBUG] Error listing patients for debugging:', debugError);
      }
      
      return null;
    }
    
    console.log('✅ Patient document found for ID:', patientId);
    const patientData = docSnap.data();
    
    // Get corresponding user data using user_id
    let userData = null;
    if (patientData.user_id) {
      try {
        const { getUserById } = await import('./users');
        userData = await getUserById(patientData.user_id);
      } catch (userError) {
        console.warn(`Could not fetch user data for patient ${patientId}:`, userError);
      }
    }
    
    // Combine patient and user data
    return {
      patient_id: docSnap.id,
      ...patientData,
      // Override with user data if available (User-centered approach)
      ...(userData && {
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        contact_number: userData.contact_number,
        address: userData.address
      })
    } as Patient;
    
  } catch (error) {
    console.error('Error fetching patient:', error);
    throw error;
  }
};

// Add new patient with automatic Firebase Auth UID integration
export const addPatientWithAuth = async (
  patient: Omit<Patient, 'patient_id'>, 
  firebaseAuthUid?: string
): Promise<string> => {
  try {
    console.log('Creating patient with Firebase Auth UID integration:', patient);

    // Step 1: If Firebase Auth UID is provided, use it as the unified ID
    let unifiedDocId: string;
    
    if (firebaseAuthUid) {
      unifiedDocId = firebaseAuthUid;
      console.log(`🔗 Using provided Firebase Auth UID as unified ID: ${unifiedDocId}`);
    } else {
      // Generate a new unified ID if no Auth UID provided
      unifiedDocId = generateLettersOnlyId();
      console.log(`🆕 Generated new unified ID: ${unifiedDocId}`);
    }
    
    try {
      const { createUserWithId } = await import('./users');
      
      // Step 2: Create core user document with the unified ID
      const userAccount = await createUserWithId(unifiedDocId, {
        first_name: patient.first_name || '',
        middle_name: patient.middle_name || '',
        last_name: patient.last_name || '',
        email: patient.email || '',
        role: 'Patient',
        contact_number: patient.contact_number?.toString() || '',
        address: patient.address || ''
      });
      
      console.log(`✅ Created core user document for patient ${patient.first_name} ${patient.last_name}:`);
      console.log(`📄 User Document ID: ${unifiedDocId}`);
      console.log(`📧 Email: ${userAccount.email}`);
      
      if (firebaseAuthUid) {
        console.log(`🔗 Linked to Firebase Auth UID: ${firebaseAuthUid}`);
      }
      
      // Step 3: Create patient-specific record with the SAME document ID
      const patientSpecificData: any = {
        patient_id: unifiedDocId, // Same as user document ID
        user_id: unifiedDocId, // Reference to user document
        birthdate: patient.birthdate,
        gender: patient.gender,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        is_active: true
      };

      // Only add patient-specific fields if they have values
      if (patient.assigned_caregiver_id) patientSpecificData.assigned_caregiver_id = patient.assigned_caregiver_id;
      if (patient.assigned_day_caregiver_id) patientSpecificData.assigned_day_caregiver_id = patient.assigned_day_caregiver_id;
      if (patient.assigned_night_caregiver_id) patientSpecificData.assigned_night_caregiver_id = patient.assigned_night_caregiver_id;
      if (patient.emergency_contact_name) patientSpecificData.emergency_contact_name = patient.emergency_contact_name;
      if (patient.emergency_contact_phone) patientSpecificData.emergency_contact_phone = patient.emergency_contact_phone;
      if (patient.emergency_contact_relationship) patientSpecificData.emergency_contact_relationship = patient.emergency_contact_relationship;
      if (patient.email) patientSpecificData.email = patient.email;
      if (patient.care_notes) patientSpecificData.care_notes = patient.care_notes;
      if (patient.medical_conditions) patientSpecificData.medical_conditions = patient.medical_conditions;
      if (patient.mobility_level) patientSpecificData.mobility_level = patient.mobility_level;
      if (patient.contract_start_date) patientSpecificData.contract_start_date = patient.contract_start_date;
      if (patient.contract_end_date) patientSpecificData.contract_end_date = patient.contract_end_date;

      // Save to patients collection using setDoc with the unified ID
      const patientDocRef = doc(db, COLLECTIONS.PATIENTS, unifiedDocId);
      await setDoc(patientDocRef, patientSpecificData);
      
      console.log(`✅ Created patient-specific record with SAME ID: ${unifiedDocId}`);
      console.log(`🎉 Patient ${patient.first_name} ${patient.last_name} created successfully with unified ID approach!`);
      console.log(`📋 Both user and patient documents share ID: ${unifiedDocId}`);
      
      // Step 4: If there are any existing medical records or medications with a different patient ID,
      // update them to use the new unified ID
      if (firebaseAuthUid && patient.email) {
        console.log('🔍 Checking for existing medical records to update...');
        
        // Check for medical history records that might use email or old ID
        const medicalHistoryQuery = query(
          collection(db, COLLECTIONS.MEDICAL_HISTORY),
          where('patient_id', '!=', unifiedDocId)
        );
        
        try {
          const medicalHistorySnapshot = await getDocs(medicalHistoryQuery);
          const recordsToUpdate = medicalHistorySnapshot.docs.filter(doc => {
            const data = doc.data();
            // Check if this record belongs to the same patient (by email or name)
            return data.patient_email === patient.email || 
                   (data.patient_first_name === patient.first_name && 
                    data.patient_last_name === patient.last_name);
          });
          
          if (recordsToUpdate.length > 0) {
            console.log(`📋 Found ${recordsToUpdate.length} medical history records to update`);
            
            for (const medRecord of recordsToUpdate) {
              await updateDoc(doc(db, COLLECTIONS.MEDICAL_HISTORY, medRecord.id), {
                patient_id: unifiedDocId,
                updated_at: Timestamp.now()
              });
              console.log(`✅ Updated medical history record ${medRecord.id}`);
            }
          }
        } catch (medHistoryError) {
          console.warn('Warning: Could not check/update medical history records:', medHistoryError);
        }
        
        // Check for medication records
        try {
          const medicationsQuery = query(
            collection(db, COLLECTIONS.MEDICATIONS),
            where('patient_id', '!=', unifiedDocId)
          );
          
          const medicationsSnapshot = await getDocs(medicationsQuery);
          const medicationsToUpdate = medicationsSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.patient_email === patient.email ||
                   (data.patient_first_name === patient.first_name && 
                    data.patient_last_name === patient.last_name);
          });
          
          if (medicationsToUpdate.length > 0) {
            console.log(`💊 Found ${medicationsToUpdate.length} medication records to update`);
            
            for (const medRecord of medicationsToUpdate) {
              await updateDoc(doc(db, COLLECTIONS.MEDICATIONS, medRecord.id), {
                patient_id: unifiedDocId,
                updated_at: new Date().toISOString()
              });
              console.log(`✅ Updated medication record ${medRecord.id}`);
            }
          }
        } catch (medicationError) {
          console.warn('Warning: Could not check/update medication records:', medicationError);
        }
      }
      
      // Update caregiver patient counts for all assigned caregivers
      const caregiverIds = [
        patient.assigned_caregiver_id,
        patient.assigned_day_caregiver_id,
        patient.assigned_night_caregiver_id
      ].filter(id => id && id.trim() !== '');

      for (const caregiverId of caregiverIds) {
        await updateCaregiverPatientCount(caregiverId);
      }
      
      return unifiedDocId; // Return the unified document ID as the patient identifier
      
    } catch (userError) {
      console.error('Error creating patient with unified ID:', userError);
      throw userError;
    }
    
  } catch (error) {
    console.error('Error adding patient with auth:', error);
    throw error;
  }
};

// Add new patient (using unified document ID approach like caregivers)
export const addPatient = async (patient: Omit<Patient, 'patient_id'>): Promise<string> => {
  try {
    console.log('Creating patient with unified document ID approach (matching caregiver pattern):', patient);

    // Step 1: Generate a single document ID to use for both user and patient collections
    // This keeps the identifier letters-only for new patient records
    const unifiedDocId = generateLettersOnlyId();
    
    try {
      const { createUserWithId } = await import('./users');
      
      // Step 2: Create core user document with the unified ID (exactly like caregivers)
      const userAccount = await createUserWithId(unifiedDocId, {
        first_name: patient.first_name || '',
        middle_name: patient.middle_name || '',
        last_name: patient.last_name || '',
        email: patient.email || '',
        role: 'Patient',
        contact_number: patient.contact_number?.toString() || '',
        address: patient.address || ''
      });
      
      console.log(`✅ Created core user document for patient ${patient.first_name} ${patient.last_name}:`);
      console.log(`📄 User Document ID: ${unifiedDocId}`);
      console.log(`📧 Email: ${userAccount.email}`);
      console.log(`ℹ️ Note: No automated auth account created, document-only user`);
      
      // Step 3: Create patient-specific record with the SAME document ID (exactly like caregivers)
      const patientSpecificData: any = {
        patient_id: unifiedDocId, // Same as user document ID
        user_id: unifiedDocId, // Reference to user document (same ID)
        birthdate: patient.birthdate,
        gender: patient.gender,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        is_active: true
      };

      // Only add patient-specific fields if they have values
      if (patient.assigned_caregiver_id) patientSpecificData.assigned_caregiver_id = patient.assigned_caregiver_id;
      if (patient.assigned_day_caregiver_id) patientSpecificData.assigned_day_caregiver_id = patient.assigned_day_caregiver_id;
      if (patient.assigned_night_caregiver_id) patientSpecificData.assigned_night_caregiver_id = patient.assigned_night_caregiver_id;
      if (patient.emergency_contact_name) patientSpecificData.emergency_contact_name = patient.emergency_contact_name;
      if (patient.emergency_contact_phone) patientSpecificData.emergency_contact_phone = patient.emergency_contact_phone;
      if (patient.emergency_contact_relationship) patientSpecificData.emergency_contact_relationship = patient.emergency_contact_relationship;
      if (patient.email) patientSpecificData.email = patient.email;
      if (patient.care_notes) patientSpecificData.care_notes = patient.care_notes;
      if (patient.medical_conditions) patientSpecificData.medical_conditions = patient.medical_conditions;
      if (patient.mobility_level) patientSpecificData.mobility_level = patient.mobility_level;
      if (patient.contract_start_date) patientSpecificData.contract_start_date = patient.contract_start_date;
      if (patient.contract_end_date) patientSpecificData.contract_end_date = patient.contract_end_date;

      // Save to patients collection using setDoc with the unified ID (exactly like caregivers)
      const patientDocRef = doc(db, COLLECTIONS.PATIENTS, unifiedDocId);
      await setDoc(patientDocRef, patientSpecificData);
      
      console.log(`✅ Created patient-specific record with SAME ID: ${unifiedDocId}`);
      console.log(`🎉 Patient ${patient.first_name} ${patient.last_name} created successfully with unified ID approach!`);
      console.log(`📋 Both user and patient documents share ID: ${unifiedDocId}`);
      
      // Update caregiver patient counts for all assigned caregivers
      const caregiverIds = [
        patient.assigned_caregiver_id,
        patient.assigned_day_caregiver_id,
        patient.assigned_night_caregiver_id
      ].filter(id => id && id.trim() !== '');

      for (const caregiverId of caregiverIds) {
        await updateCaregiverPatientCount(caregiverId);
      }
      
      console.log(`📊 Final result: Patient created with unified document ID: ${unifiedDocId}`);
      console.log(`🔗 This ID will be used for both user and patient collections, and as patient_id for medical records`);
      
      return unifiedDocId; // Return the unified document ID as the patient identifier
      
    } catch (userError) {
      console.error('Error creating patient with unified ID:', userError);
      throw userError;
    }
    
  } catch (error) {
    console.error('Error adding patient:', error);
    throw error;
  }
};

// Update patient using User-centered approach
export const updatePatient = async (patientId: string, updates: Partial<Omit<Patient, 'patient_id'>>): Promise<void> => {
  try {
    console.log('[DEBUG] updatePatient called with ID:', patientId);
    console.log('[DEBUG] Patient ID type:', typeof patientId, 'Length:', patientId.length);
    console.log('[DEBUG] Updates to apply:', updates);
    
    // Debug: List all patients in database first
    try {
      const allPatientsSnapshot = await getDocs(collection(db, COLLECTIONS.PATIENTS));
      const allPatients = allPatientsSnapshot.docs.map(doc => ({
        id: doc.id,
        data: doc.data()
      }));
      console.log('[DEBUG] All patients in database:', allPatients);
      console.log('[DEBUG] Looking for patient ID:', patientId);
      console.log('[DEBUG] Patient exists:', allPatientsSnapshot.docs.some(doc => doc.id === patientId));
    } catch (debugError) {
      console.error('[DEBUG] Error listing patients:', debugError);
    }
    
    // Get the current patient data to check for caregiver changes
    const currentPatient = await getPatient(patientId);
    if (!currentPatient) {
      console.error('❌ Patient not found in database for ID:', patientId);
      console.log('🔍 Attempting to list all patients to debug...');
      
      // Debug: List all patient IDs in the database
      try {
        const allPatientsSnapshot = await getDocs(collection(db, COLLECTIONS.PATIENTS));
        const allPatientIds = allPatientsSnapshot.docs.map(doc => doc.id);
        console.log('📋 All patient IDs in database:', allPatientIds);
        console.log('📋 Total patients in database:', allPatientIds.length);
        console.log('🔍 Does the requested ID exist?', allPatientIds.includes(patientId));
      } catch (debugError) {
        console.error('Debug listing failed:', debugError);
      }
      
      throw new Error('Patient not found');
    }
    
    console.log('✅ Patient found:', currentPatient.first_name, currentPatient.last_name);
    
    // Separate user data from patient-specific data
    const userUpdates: any = {};
    const patientUpdates: any = {};
    
    // Categorize updates
    Object.entries(updates).forEach(([key, value]) => {
      if (['first_name', 'last_name', 'email', 'contact_number', 'address'].includes(key)) {
        userUpdates[key] = value;
      } else {
        patientUpdates[key] = value;
      }
    });
    
    // Update user document if there are user-level changes
    if (Object.keys(userUpdates).length > 0 && currentPatient.patient_id) {
      try {
        const { updateUser } = await import('./users');
        await updateUser(currentPatient.patient_id, {
          ...userUpdates,
          updated_at: Timestamp.now()
        });
        console.log(`✅ Updated user document for patient ${patientId}`);
      } catch (userError) {
        console.error('Error updating user document:', userError);
        // Continue with patient update even if user update fails
      }
    }
    
    // Update patient document if there are patient-specific changes
    if (Object.keys(patientUpdates).length > 0) {
      const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
      await updateDoc(docRef, {
        ...patientUpdates,
        updated_at: Timestamp.now()
      });
      console.log(`✅ Updated patient document for patient ${patientId}`);
    }
    
    // Track all old and new caregiver assignments for count updates
    const oldCaregiverIds = [
      currentPatient.assigned_caregiver_id,
      currentPatient.assigned_day_caregiver_id,
      currentPatient.assigned_night_caregiver_id
    ].filter(id => id && id.trim() !== '');
    
    const newCaregiverIds = [
      updates.assigned_caregiver_id !== undefined ? updates.assigned_caregiver_id : currentPatient.assigned_caregiver_id,
      updates.assigned_day_caregiver_id !== undefined ? updates.assigned_day_caregiver_id : currentPatient.assigned_day_caregiver_id,
      updates.assigned_night_caregiver_id !== undefined ? updates.assigned_night_caregiver_id : currentPatient.assigned_night_caregiver_id
    ].filter(id => id && id.trim() !== '');
    
    console.log(`🎉 Patient ${patientId} updated successfully with User-centered approach`);
    
    // Update caregiver patient counts for all affected caregivers
    
    // Find caregivers that need count updates
    const allCaregiverIds = [...new Set([...oldCaregiverIds, ...newCaregiverIds])];
    
    // Update counts for all affected caregivers
    for (const caregiverId of allCaregiverIds) {
      await updateCaregiverPatientCount(caregiverId);
    }
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
};

// Delete patient using User-centered approach
export const deletePatient = async (patientId: string): Promise<void> => {
  try {
    console.log('Deleting patient with User-centered approach:', patientId);
    
    // Get the patient data to check for caregiver assignments and user_id
    const patient = await getPatient(patientId);
    
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    // Collect all caregiver IDs that need updating
    const caregiverIds = [
      patient?.assigned_caregiver_id,
      patient?.assigned_day_caregiver_id,
      patient?.assigned_night_caregiver_id
    ].filter(id => id && id.trim() !== '');
    
    // Delete the patient document first
    const patientDocRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await deleteDoc(patientDocRef);
    console.log(`✅ Deleted patient document: ${patientId}`);
    
    // Delete the corresponding user document if it exists
    if (patient.patient_id) {
      try {
        const { deleteUser } = await import('./users');
        await deleteUser(patient.patient_id);
        console.log(`✅ Deleted user document: ${patient.patient_id}`);
      } catch (userError) {
        console.error('Error deleting user document:', userError);
        // Continue since patient document is already deleted
      }
    }
    
    console.log(`🎉 Patient ${patientId} deleted successfully with User-centered approach`);
    
    // Update caregiver patient counts for all assigned caregivers
    for (const caregiverId of caregiverIds) {
      await updateCaregiverPatientCount(caregiverId);
    }
  } catch (error) {
    console.error('Error deleting patient:', error);
    throw error;
  }
};

// Get patients by caregiver
export const getPatientsByCaregiver = async (caregiverId: string): Promise<Patient[]> => {
  try {
    // Validate input
    if (!caregiverId || caregiverId.trim() === '') {
      console.log('No caregiver ID provided to getPatientsByCaregiver');
      return [];
    }

    console.log(`🔍 [getPatientsByCaregiver] Fetching patients for caregiver: ${caregiverId}`);

    // Query for patients assigned to this caregiver in any capacity
    // We need to check assigned_caregiver_id, assigned_day_caregiver_id, and assigned_night_caregiver_id
    const queries = [
      // Legacy assigned_caregiver_id field
      query(
        collection(db, COLLECTIONS.PATIENTS),
        where('assigned_caregiver_id', '==', caregiverId)
      ),
      // Day caregiver assignment
      query(
        collection(db, COLLECTIONS.PATIENTS),
        where('assigned_day_caregiver_id', '==', caregiverId)
      ),
      // Night caregiver assignment
      query(
        collection(db, COLLECTIONS.PATIENTS),
        where('assigned_night_caregiver_id', '==', caregiverId)
      )
    ];

    // Execute all queries and combine results
    const allPatients: Patient[] = [];
    const patientIds = new Set<string>(); // To avoid duplicates

    for (const q of queries) {
      try {
        const querySnapshot = await getDocs(q);
        querySnapshot.docs.forEach(doc => {
          const patientId = doc.id;
          if (!patientIds.has(patientId)) {
            patientIds.add(patientId);
            allPatients.push({
              patient_id: patientId,
              ...doc.data()
            } as Patient);
          }
        });
      } catch (queryError) {
        console.error('Error in individual query:', queryError);
        // Continue with other queries even if one fails
      }
    }

    console.log(`🔍 [getPatientsByCaregiver] Found ${allPatients.length} patients assigned to caregiver ${caregiverId}`);
    
    if (allPatients.length > 0) {
      console.log('🔍 [getPatientsByCaregiver] Raw patient data before user merge:', 
        allPatients.map(p => ({
          patient_id: p.patient_id,
          user_id: p.user_id,
          first_name: p.first_name,
          last_name: p.last_name,
          has_user_id: !!p.user_id
        }))
      );
    }
    
    // Now merge with user data for each patient (same approach as getPatients)
    const { getUserById } = await import('./users');
    const patientsWithUserData = await Promise.all(
      allPatients.map(async (patientData) => {
        const patient_id = patientData.patient_id;
        
        console.log(`🔍 [getPatientsByCaregiver] Processing patient ${patient_id}:`, {
          raw_data: patientData,
          has_user_id: !!patientData.user_id,
          user_id_value: patientData.user_id
        });
        
        // Get corresponding user data using user_id or patient_id
        let userData = null;
        let userFetchMethod = 'none';
        
        // Try to get user data by user_id first
        if (patientData.user_id) {
          try {
            userData = await getUserById(patientData.user_id);
            if (userData) {
              userFetchMethod = 'user_id';
              console.log(`✅ Found user data via user_id for patient ${patient_id}`);
            }
          } catch (userError) {
            console.warn(`Could not fetch user data by user_id for patient ${patient_id}:`, userError);
          }
        }
        
        // If user_id didn't work, try using patient_id as the user ID
        if (!userData && patient_id) {
          try {
            userData = await getUserById(patient_id);
            if (userData) {
              userFetchMethod = 'patient_id';
              console.log(`✅ Found user data via patient_id for patient ${patient_id}`);
            }
          } catch (userError) {
            console.warn(`Could not fetch user data by patient_id for patient ${patient_id}:`, userError);
          }
        }
        
        if (!userData) {
          console.warn(`❌ No user data found for patient ${patient_id}`);
          userFetchMethod = 'not_found';
        }
        
        // Combine patient and user data - Users entity has priority for basic info
        const combinedData = {
          patient_id,
          ...patientData, // Patient-specific data (birthdate, gender, emergency contacts, etc.)
          // Basic info comes from Users entity (has priority)
          ...(userData && {
            first_name: userData.first_name || patientData.first_name,
            last_name: userData.last_name || patientData.last_name,
            email: userData.email || patientData.email,
            contact_number: userData.contact_number || patientData.contact_number,
            address: userData.address || patientData.address,
            is_active: userData.is_active !== undefined ? userData.is_active : patientData.is_active,
            // Keep user_id reference for linking
            user_id: userData.user_id || userData.id || patientData.user_id
          })
        } as Patient;
        
        console.log(`🔍 [getPatientsByCaregiver] Patient ${patient_id} data summary:`, {
          user_fetch_method: userFetchMethod,
          has_first_name: !!combinedData.first_name,
          has_last_name: !!combinedData.last_name,
          has_contact: !!combinedData.contact_number,
          source: userData ? 'users+patients' : 'patients_only',
          final_first_name: combinedData.first_name,
          final_last_name: combinedData.last_name,
          user_data_found: !!userData,
          user_data_summary: userData ? {
            user_first_name: userData.first_name,
            user_last_name: userData.last_name,
            user_id: userData.user_id || userData.id
          } : null
        });
        
        return combinedData;
      })
    );
    
    // Sort by first name in JavaScript to avoid needing a compound index
    return patientsWithUserData.sort((a, b) => 
      (a.first_name || '').localeCompare(b.first_name || '')
    );
  } catch (error) {
    console.error('Error fetching patients by caregiver:', error);
    throw error;
  }
};

// Auto-sync patient and medical records with Firebase Auth UID after account creation
export const autoSyncPatientWithAuthUID = async (patientEmail: string, firebaseAuthUID: string): Promise<void> => {
  try {
    console.log(`🔄 Auto-syncing patient with email ${patientEmail} to Firebase Auth UID ${firebaseAuthUID}`);
    
    // Step 1: Find the patient by email
    const patientsQuery = query(
      collection(db, COLLECTIONS.PATIENTS),
      where('email', '==', patientEmail)
    );
    
    const patientsSnapshot = await getDocs(patientsQuery);
    
    if (patientsSnapshot.empty) {
      console.warn(`No patient found with email ${patientEmail}`);
      return;
    }
    
    // Get the first matching patient (should be unique by email)
    const patientDoc = patientsSnapshot.docs[0];
    const currentPatientId = patientDoc.id;
    const patientData = patientDoc.data();
    
    console.log(`📋 Found patient ${currentPatientId} with email ${patientEmail}`);
    
    // If the patient already has the correct ID, no need to sync
    if (currentPatientId === firebaseAuthUID) {
      console.log(`✅ Patient ${currentPatientId} already synced with Firebase Auth UID`);
      return;
    }
    
    // Step 2: Create/update user document with Firebase Auth UID (ensure user entity matches)
    const { createUserWithId, getUserById } = await import('./users');
    
    let existingUser = null;
    try {
      existingUser = await getUserById(firebaseAuthUID);
    } catch (error) {
      console.log('User does not exist yet, will create new one');
    }
    
    if (!existingUser) {
      await createUserWithId(firebaseAuthUID, {
        first_name: patientData.first_name || '',
        last_name: patientData.last_name || '',
        email: patientData.email || '',
        role: 'Patient',
        contact_number: patientData.contact_number?.toString() || '',
        address: patientData.address || ''
      });
      console.log(`✅ Created user entity with Firebase Auth UID: ${firebaseAuthUID}`);
    } else {
      console.log(`✅ User entity already exists with Firebase Auth UID: ${firebaseAuthUID}`);
    }
    
    // Step 3: Create new patient document with Firebase Auth UID (update patient entity)
    const newPatientData = {
      ...patientData,
      patient_id: firebaseAuthUID,  // Patient entity now matches Firebase Auth UID
      user_id: firebaseAuthUID,     // Links to user entity with same UID
      updated_at: Timestamp.now()
    };
    
    const newPatientRef = doc(db, COLLECTIONS.PATIENTS, firebaseAuthUID);
    await setDoc(newPatientRef, newPatientData);
    console.log(`✅ Updated patient entity - document ID and patient_id now match Firebase Auth UID: ${firebaseAuthUID}`);
    
    // Step 4: Update all medical history records (recreate with new document IDs)
    const medicalHistoryQuery = query(
      collection(db, COLLECTIONS.MEDICAL_HISTORY),
      where('patient_id', '==', currentPatientId)
    );
    
    const medicalHistorySnapshot = await getDocs(medicalHistoryQuery);
    console.log(`📋 Found ${medicalHistorySnapshot.docs.length} medical history records to update`);
    
    const medicalHistoryUpdates = medicalHistorySnapshot.docs.map(async (medHistoryDoc) => {
      const oldMedHistoryData = medHistoryDoc.data();
      const oldDocId = medHistoryDoc.id;
      
      // Create new medical history document with Firebase Auth UID incorporated in document ID
      // Use pattern: {firebaseAuthUID}_{timestamp} to ensure uniqueness
      const newMedHistoryDocId = `${firebaseAuthUID}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newMedHistoryData = {
        ...oldMedHistoryData,
        patient_id: firebaseAuthUID,  // Update patient_id to match Firebase Auth UID
        updated_at: Timestamp.now(),
        migrated_from: oldDocId // Keep track of original document ID
      };
      
      // Create new medical history document with new document ID
      const newMedHistoryRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, newMedHistoryDocId);
      await setDoc(newMedHistoryRef, newMedHistoryData);
      
      // Delete the old medical history document
      await deleteDoc(doc(db, COLLECTIONS.MEDICAL_HISTORY, oldDocId));
      
      console.log(`✅ Updated medical_history entity: ${oldDocId} → ${newMedHistoryDocId} (patient_id: ${firebaseAuthUID})`);
    });
    
    await Promise.all(medicalHistoryUpdates);
    
    // Step 5: Update all medication records (recreate with new document IDs)
    const medicationsQuery = query(
      collection(db, COLLECTIONS.MEDICATIONS),
      where('patient_id', '==', currentPatientId)
    );
    
    const medicationsSnapshot = await getDocs(medicationsQuery);
    console.log(`📋 Found ${medicationsSnapshot.docs.length} medication records to update`);
    
    const medicationUpdates = medicationsSnapshot.docs.map(async (medicationDoc) => {
      const oldMedicationData = medicationDoc.data();
      const oldDocId = medicationDoc.id;
      
      // Create new medication document with Firebase Auth UID incorporated in document ID
      // Use pattern: {firebaseAuthUID}_{timestamp} to ensure uniqueness
      const newMedicationDocId = `${firebaseAuthUID}_med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newMedicationData = {
        ...oldMedicationData,
        patient_id: firebaseAuthUID,  // Update patient_id to match Firebase Auth UID
        updated_at: new Date().toISOString(),
        migrated_from: oldDocId // Keep track of original document ID
      };
      
      // Create new medication document with new document ID
      const newMedicationRef = doc(db, COLLECTIONS.MEDICATIONS, newMedicationDocId);
      await setDoc(newMedicationRef, newMedicationData);
      
      // Delete the old medication document
      await deleteDoc(doc(db, COLLECTIONS.MEDICATIONS, oldDocId));
      
      console.log(`✅ Updated medication entity: ${oldDocId} → ${newMedicationDocId} (patient_id: ${firebaseAuthUID})`);
    });
    
    await Promise.all(medicationUpdates);
    
    // Step 6: Update caregiver assignments (if any)
    if (patientData.assigned_caregiver_id || patientData.assigned_day_caregiver_id || patientData.assigned_night_caregiver_id) {
      const caregiverIds = [
        patientData.assigned_caregiver_id,
        patientData.assigned_day_caregiver_id,
        patientData.assigned_night_caregiver_id
      ].filter(id => id && id.trim() !== '');

      for (const caregiverId of caregiverIds) {
        await updateCaregiverPatientCount(caregiverId);
      }
      console.log(`✅ Updated caregiver patient counts`);
    }
    
    // Step 7: Delete the old patient document
    await deleteDoc(doc(db, COLLECTIONS.PATIENTS, currentPatientId));
    console.log(`🗑️ Deleted old patient document: ${currentPatientId}`);
    
    console.log(`🎉 Auto-sync complete! All entities now use Firebase Auth UID: ${firebaseAuthUID}`);
    console.log(`📊 Entity Document ID Synchronization Summary:
      ✅ User Entity: Document ID = ${firebaseAuthUID} (matches Firebase Auth UID)
      ✅ Patient Entity: Document ID = ${firebaseAuthUID}, patient_id = ${firebaseAuthUID} (matches Firebase Auth UID)
      ✅ Medical History Entities: ${medicalHistorySnapshot.docs.length} records recreated with new document IDs containing ${firebaseAuthUID}
      ✅ Medication Entities: ${medicationsSnapshot.docs.length} records recreated with new document IDs containing ${firebaseAuthUID}
      
      🔗 All entities now have document IDs and fields synchronized with Firebase Auth UID: ${firebaseAuthUID}
      📋 Old documents have been deleted and replaced with new ones using the Firebase Auth UID`);
    
  } catch (error) {
    console.error('Error auto-syncing patient with Firebase Auth UID:', error);
    throw error;
  }
};

// Hook function to be called after Firebase Auth account creation
export const onPatientAuthAccountCreated = async (user: any): Promise<void> => {
  try {
    if (!user.email) {
      console.log('No email found for user, skipping auto-sync');
      return;
    }
    
    console.log(`🔗 Firebase Auth account created for ${user.email} with UID: ${user.uid}`);
    console.log('Checking if this user has an existing patient record...');
    
    // Auto-sync the patient with the new Firebase Auth UID
    await autoSyncPatientWithAuthUID(user.email, user.uid);
    
  } catch (error) {
    console.error('Error in onPatientAuthAccountCreated hook:', error);
    // Don't throw - this shouldn't break the auth flow
  }
};

// Verify that patient, user, and medical history entities are all synchronized
export const verifyPatientEntitySync = async (firebaseAuthUID: string): Promise<{ synced: boolean; details: any }> => {
  try {
    console.log(`🔍 Verifying entity synchronization for Firebase Auth UID: ${firebaseAuthUID}`);
    
    const results = {
      userEntity: null as any,
      patientEntity: null as any,
      medicalHistoryCount: 0,
      medicationCount: 0,
      synced: false,
      details: {
        userEntityExists: false,
        patientEntityExists: false,
        patientIdMatches: false,
        userIdMatches: false,
        medicalHistoryRecords: 0,
        medicationRecords: 0
      }
    };
    
    // Check user entity
    try {
      const { getUserById } = await import('./users');
      results.userEntity = await getUserById(firebaseAuthUID);
      results.details.userEntityExists = true;
      console.log(`✅ User entity found with UID: ${firebaseAuthUID}`);
    } catch (error) {
      console.log(`❌ User entity NOT found with UID: ${firebaseAuthUID}`);
    }
    
    // Check patient entity
    try {
      const patientDoc = await getDoc(doc(db, COLLECTIONS.PATIENTS, firebaseAuthUID));
      if (patientDoc.exists()) {
        const patientData = patientDoc.data();
        results.patientEntity = patientData;
        results.details.patientEntityExists = true;
        results.details.patientIdMatches = patientData.patient_id === firebaseAuthUID;
        results.details.userIdMatches = patientData.user_id === firebaseAuthUID;
        console.log(`✅ Patient entity found with UID: ${firebaseAuthUID}`);
        console.log(`   - Document ID: ${patientDoc.id}`);
        console.log(`   - patient_id: ${patientData.patient_id}`);
        console.log(`   - user_id: ${patientData.user_id}`);
      } else {
        console.log(`❌ Patient entity NOT found with UID: ${firebaseAuthUID}`);
      }
    } catch (error) {
      console.log(`❌ Error checking patient entity: ${error}`);
    }
    
    // Check medical history entities
    try {
      const medHistQuery = query(
        collection(db, COLLECTIONS.MEDICAL_HISTORY),
        where('patient_id', '==', firebaseAuthUID)
      );
      const medHistSnapshot = await getDocs(medHistQuery);
      results.medicalHistoryCount = medHistSnapshot.docs.length;
      results.details.medicalHistoryRecords = medHistSnapshot.docs.length;
      console.log(`✅ Found ${results.medicalHistoryCount} medical history entities with patient_id: ${firebaseAuthUID}`);
    } catch (error) {
      console.log(`❌ Error checking medical history entities: ${error}`);
    }
    
    // Check medication entities
    try {
      const medQuery = query(
        collection(db, COLLECTIONS.MEDICATIONS),
        where('patient_id', '==', firebaseAuthUID)
      );
      const medSnapshot = await getDocs(medQuery);
      results.medicationCount = medSnapshot.docs.length;
      results.details.medicationRecords = medSnapshot.docs.length;
      console.log(`✅ Found ${results.medicationCount} medication entities with patient_id: ${firebaseAuthUID}`);
    } catch (error) {
      console.log(`❌ Error checking medication entities: ${error}`);
    }
    
    // Determine if fully synced
    results.synced = !!(results.userEntity && results.patientEntity);
    
    console.log(`📊 Sync Verification Results for UID ${firebaseAuthUID}:`);
    console.log(`   🔗 User Entity: ${results.details.userEntityExists ? '✅' : '❌'}`);
    console.log(`   🔗 Patient Entity: ${results.details.patientEntityExists ? '✅' : '❌'}`);
    console.log(`   🔗 Patient ID Matches: ${results.details.patientIdMatches ? '✅' : '❌'}`);
    console.log(`   🔗 User ID Matches: ${results.details.userIdMatches ? '✅' : '❌'}`);
    console.log(`   🔗 Medical History Records: ${results.medicalHistoryCount}`);
    console.log(`   🔗 Medication Records: ${results.medicationCount}`);
    console.log(`   🎯 Overall Sync Status: ${results.synced ? '✅ SYNCED' : '❌ NOT SYNCED'}`);
    
    return results;
    
  } catch (error) {
    console.error('Error verifying patient entity sync:', error);
    throw error;
  }
};

// Update existing patient to use Firebase Auth UID and sync all related records
export const syncPatientWithFirebaseAuth = async (currentPatientId: string, firebaseAuthUid: string): Promise<void> => {
  try {
    console.log(`🔄 Syncing patient ${currentPatientId} with Firebase Auth UID ${firebaseAuthUid}`);
    
    // Step 1: Get the existing patient data
    const currentPatientRef = doc(db, COLLECTIONS.PATIENTS, currentPatientId);
    const currentPatientSnap = await getDoc(currentPatientRef);
    
    if (!currentPatientSnap.exists()) {
      throw new Error(`Patient ${currentPatientId} not found`);
    }
    
    const patientData = currentPatientSnap.data();
    console.log(`📋 Found patient data:`, patientData);
    
    // Step 2: Create or update user document with Firebase Auth UID
    const { createUserWithId, getUserById } = await import('./users');
    
    // Check if user already exists with this UID
    let existingUser = null;
    try {
      existingUser = await getUserById(firebaseAuthUid);
    } catch (error) {
      console.log('User does not exist yet, will create new one');
    }
    
    if (!existingUser) {
      // Create new user document with Firebase Auth UID
      await createUserWithId(firebaseAuthUid, {
        first_name: patientData.first_name || '',
        last_name: patientData.last_name || '',
        email: patientData.email || '',
        role: 'Patient',
        contact_number: patientData.contact_number?.toString() || '',
        address: patientData.address || ''
      });
      console.log(`✅ Created user document with Firebase Auth UID: ${firebaseAuthUid}`);
    } else {
      console.log(`✅ User document already exists with Firebase Auth UID: ${firebaseAuthUid}`);
    }
    
    // Step 3: Create new patient document with Firebase Auth UID
    const newPatientData = {
      ...patientData,
      patient_id: firebaseAuthUid,
      user_id: firebaseAuthUid,
      updated_at: Timestamp.now()
    };
    
    const newPatientRef = doc(db, COLLECTIONS.PATIENTS, firebaseAuthUid);
    await setDoc(newPatientRef, newPatientData);
    console.log(`✅ Created new patient document with Firebase Auth UID: ${firebaseAuthUid}`);
    
    // Step 4: Update all medical history records
    const medicalHistoryQuery = query(
      collection(db, COLLECTIONS.MEDICAL_HISTORY),
      where('patient_id', '==', currentPatientId)
    );
    
    const medicalHistorySnapshot = await getDocs(medicalHistoryQuery);
    console.log(`📋 Found ${medicalHistorySnapshot.docs.length} medical history records to update`);
    
    const medicalHistoryUpdates = medicalHistorySnapshot.docs.map(async (medHistoryDoc) => {
      const medHistoryRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, medHistoryDoc.id);
      await updateDoc(medHistoryRef, {
        patient_id: firebaseAuthUid,
        updated_at: Timestamp.now()
      });
      console.log(`✅ Updated medical history record ${medHistoryDoc.id} to use patient_id: ${firebaseAuthUid}`);
    });
    
    await Promise.all(medicalHistoryUpdates);
    
    // Step 5: Update all medication records
    const medicationsQuery = query(
      collection(db, COLLECTIONS.MEDICATIONS),
      where('patient_id', '==', currentPatientId)
    );
    
    const medicationsSnapshot = await getDocs(medicationsQuery);
    console.log(`📋 Found ${medicationsSnapshot.docs.length} medication records to update`);
    
    const medicationUpdates = medicationsSnapshot.docs.map(async (medicationDoc) => {
      const medicationRef = doc(db, COLLECTIONS.MEDICATIONS, medicationDoc.id);
      await updateDoc(medicationRef, {
        patient_id: firebaseAuthUid,
        updated_at: new Date().toISOString()
      });
      console.log(`✅ Updated medication record ${medicationDoc.id} to use patient_id: ${firebaseAuthUid}`);
    });
    
    await Promise.all(medicationUpdates);
    
    // Step 6: Delete the old patient document
    await deleteDoc(currentPatientRef);
    console.log(`🗑️ Deleted old patient document: ${currentPatientId}`);
    
    // Step 7: Update caregiver assignments (if any)
    if (patientData.assigned_caregiver_id || patientData.assigned_day_caregiver_id || patientData.assigned_night_caregiver_id) {
      const caregiverIds = [
        patientData.assigned_caregiver_id,
        patientData.assigned_day_caregiver_id,
        patientData.assigned_night_caregiver_id
      ].filter(id => id && id.trim() !== '');

      for (const caregiverId of caregiverIds) {
        await updateCaregiverPatientCount(caregiverId);
      }
      console.log(`✅ Updated caregiver patient counts for: ${caregiverIds.join(', ')}`);
    }
    
    console.log(`🎉 Successfully synced patient ${currentPatientId} with Firebase Auth UID ${firebaseAuthUid}`);
    console.log(`📊 Summary:
      - Patient document: Moved from ${currentPatientId} to ${firebaseAuthUid}
      - Medical history records updated: ${medicalHistorySnapshot.docs.length}
      - Medication records updated: ${medicationsSnapshot.docs.length}
      - User document: Created/Updated with UID ${firebaseAuthUid}`);
    
  } catch (error) {
    console.error('Error syncing patient with Firebase Auth:', error);
    throw error;
  }
};

// Update patient and related medical records to use unified document ID
export const updatePatientToUnifiedId = async (oldPatientId: string, newUserId: string): Promise<void> => {
  try {
    console.log(`🔄 Updating patient ${oldPatientId} to unified ID ${newUserId}`);
    
    // Step 1: Get the existing patient data
    const oldPatientRef = doc(db, COLLECTIONS.PATIENTS, oldPatientId);
    const oldPatientSnap = await getDoc(oldPatientRef);
    
    if (!oldPatientSnap.exists()) {
      console.warn(`Patient ${oldPatientId} not found, skipping update`);
      return;
    }
    
    const patientData = oldPatientSnap.data();
    console.log(`📋 Found patient data for ${oldPatientId}`);
    
    // Step 2: Create new patient document with unified ID
    const newPatientData = {
      ...patientData,
      patient_id: newUserId,
      user_id: newUserId,
      updated_at: Timestamp.now()
    };
    
    const newPatientRef = doc(db, COLLECTIONS.PATIENTS, newUserId);
    await setDoc(newPatientRef, newPatientData);
    console.log(`✅ Created new patient document with unified ID: ${newUserId}`);
    
    // Step 3: Update medical history records
    const medicalHistoryQuery = query(
      collection(db, COLLECTIONS.MEDICAL_HISTORY),
      where('patient_id', '==', oldPatientId)
    );
    
    const medicalHistorySnapshot = await getDocs(medicalHistoryQuery);
    console.log(`📋 Found ${medicalHistorySnapshot.docs.length} medical history records to update`);
    
    const medicalHistoryUpdates = medicalHistorySnapshot.docs.map(async (medHistoryDoc) => {
      const medHistoryRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, medHistoryDoc.id);
      await updateDoc(medHistoryRef, {
        patient_id: newUserId,
        updated_at: Timestamp.now()
      });
      console.log(`✅ Updated medical history record ${medHistoryDoc.id}`);
    });
    
    await Promise.all(medicalHistoryUpdates);
    
    // Step 4: Update medication records
    const medicationsQuery = query(
      collection(db, COLLECTIONS.MEDICATIONS),
      where('patient_id', '==', oldPatientId)
    );
    
    const medicationsSnapshot = await getDocs(medicationsQuery);
    console.log(`📋 Found ${medicationsSnapshot.docs.length} medication records to update`);
    
    const medicationUpdates = medicationsSnapshot.docs.map(async (medicationDoc) => {
      const medicationRef = doc(db, COLLECTIONS.MEDICATIONS, medicationDoc.id);
      await updateDoc(medicationRef, {
        patient_id: newUserId,
        updated_at: new Date().toISOString()
      });
      console.log(`✅ Updated medication record ${medicationDoc.id}`);
    });
    
    await Promise.all(medicationUpdates);
    
    // Step 5: Delete the old patient document
    await deleteDoc(oldPatientRef);
    console.log(`🗑️ Deleted old patient document: ${oldPatientId}`);
    
    console.log(`🎉 Successfully updated patient ${oldPatientId} to unified ID ${newUserId}`);
    console.log(`📊 Updated records:
      - Patient document: ✅
      - Medical history records: ${medicalHistorySnapshot.docs.length}
      - Medication records: ${medicationsSnapshot.docs.length}`);
    
  } catch (error) {
    console.error('Error updating patient to unified ID:', error);
    throw error;
  }
};

// Debug function to check patient-caregiver assignments
export const debugPatientAssignments = async (): Promise<void> => {
  try {
    console.log('=== DEBUGGING PATIENT ASSIGNMENTS ===');
    
    // Get all patients
    const patients = await getPatients();
    console.log(`Total patients: ${patients.length}`);
    
    // Group patients by caregiver (handling both day and night assignments)
    const patientsByCaregiver = patients.reduce((acc, patient) => {
      // Add to day caregiver if assigned
      if (patient.assigned_day_caregiver_id && patient.assigned_day_caregiver_id.trim() !== '') {
        const dayId = patient.assigned_day_caregiver_id;
        if (!acc[dayId]) acc[dayId] = [];
        acc[dayId].push(patient);
      }
      
      // Add to night caregiver if assigned
      if (patient.assigned_night_caregiver_id && patient.assigned_night_caregiver_id.trim() !== '') {
        const nightId = patient.assigned_night_caregiver_id;
        if (!acc[nightId]) acc[nightId] = [];
        acc[nightId].push(patient);
      }
      
      // Legacy assigned_caregiver_id support
      if (patient.assigned_caregiver_id && patient.assigned_caregiver_id.trim() !== '') {
        const legacyId = patient.assigned_caregiver_id;
        if (!acc[legacyId]) acc[legacyId] = [];
        acc[legacyId].push(patient);
      }
      
      return acc;
    }, {} as Record<string, typeof patients>);
    
    console.log('Patients by caregiver:', patientsByCaregiver);
    
    // Get all caregivers
    const caregiversSnapshot = await getDocs(collection(db, COLLECTIONS.CAREGIVERS));
    const caregivers = caregiversSnapshot.docs.map(doc => ({
      caregiver_id: doc.id,
      ...doc.data()
    } as Caregiver));
    
    console.log(`Total caregivers: ${caregivers.length}`);
    
    // Check each caregiver's actual vs recorded count
    for (const caregiver of caregivers) {
      const actualCount = patientsByCaregiver[caregiver.caregiver_id]?.length || 0;
      const recordedCount = caregiver.assigned_patients_count || 0;
      
      console.log(`Caregiver ${caregiver.first_name} ${caregiver.last_name} (${caregiver.caregiver_id}):`);
      console.log(`  - Recorded count: ${recordedCount}`);
      console.log(`  - Actual count: ${actualCount}`);
      console.log(`  - Max patients: ${caregiver.max_patients}`);
      console.log(`  - Shift type: ${caregiver.shift_type}`);
      
      if (actualCount !== recordedCount) {
        console.log(`  ⚠️  MISMATCH! Needs sync.`);
      } else {
        console.log(`  ✅ Counts match.`);
      }
    }
    
    console.log('=== END DEBUG ===');
  } catch (error) {
    console.error('Error in debug function:', error);
  }
};