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
import { db } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { Patient, Caregiver } from '@/types';
import { updateCaregiverPatientCount } from './caregivers';

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
      
      // Get user data for each patient
      const { getUserById } = await import('./users');
      const patientsWithUserData = await Promise.all(
        patientsSnapshot.docs.map(async (patientDoc) => {
          const patientData = patientDoc.data();
          const patient_id = patientDoc.id;
          
          // Get corresponding user data using user_id
          let userData = null;
          if (patientData.user_id) {
            try {
              userData = await getUserById(patientData.user_id);
            } catch (userError) {
              console.warn(`Could not fetch user data for patient ${patient_id}:`, userError);
            }
          }
          
          // Combine patient and user data
          return {
            patient_id,
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
        })
      );
      
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
    // Get patient document
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
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

// Add new patient
export const addPatient = async (patient: Omit<Patient, 'patient_id'>): Promise<string> => {
  try {
    console.log('Creating patient with User-centered approach:', patient);

    // Step 1: Create core user document in users collection
    let user_id: string | undefined;
    
    try {
      const { createUser } = await import('./users');
      
      const userAccount = await createUser({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        email: patient.email || '',
        role: 'Patient',
        contact_number: patient.contact_number?.toString() || '',
        address: patient.address || ''
      });
      
      user_id = userAccount.user_id;
      
      console.log(`✅ Created core user document for patient ${patient.first_name} ${patient.last_name}:`);
      console.log(`📄 Document ID: ${user_id}`);
      console.log(`📧 Email: ${userAccount.email}`);
      console.log(`ℹ️ Note: No automated auth account created, document-only user`);
      
      // Step 2: Create patient-specific record in patients collection
      const patientSpecificData: any = {
        patient_id: user_id, // Same as user_id (FK → User.user_id)
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

      // Save to patients collection
      const patientDocRef = await addDoc(collection(db, COLLECTIONS.PATIENTS), patientSpecificData);
      
      console.log(`✅ Created patient-specific record with ID: ${patientDocRef.id}`);
      console.log(`🎉 Patient ${patient.first_name} ${patient.last_name} created successfully!`);
      
      // Update caregiver patient counts for all assigned caregivers
      const caregiverIds = [
        patient.assigned_caregiver_id,
        patient.assigned_day_caregiver_id,
        patient.assigned_night_caregiver_id
      ].filter(id => id && id.trim() !== '');

      for (const caregiverId of caregiverIds) {
        await updateCaregiverPatientCount(caregiverId);
      }
      
      return user_id; // Return the user_id as the patient identifier
      
    } catch (userError) {
      console.error('Error creating patient user account:', userError);
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
    console.log('Updating patient with User-centered approach:', patientId, updates);
    
    // Get the current patient data to check for caregiver changes
    const currentPatient = await getPatient(patientId);
    if (!currentPatient) {
      throw new Error('Patient not found');
    }
    
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

    console.log(`Fetching patients for caregiver: ${caregiverId}`);

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

    console.log(`Found ${allPatients.length} patients assigned to caregiver ${caregiverId}`);
    
    // Sort by first name in JavaScript to avoid needing a compound index
    return allPatients.sort((a, b) => 
      (a.first_name || '').localeCompare(b.first_name || '')
    );
  } catch (error) {
    console.error('Error fetching patients by caregiver:', error);
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