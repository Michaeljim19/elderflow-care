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
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { Patient, Caregiver } from '@/types';
import { updateCaregiverPatientCount } from './caregivers';

// Get all patients with retry logic
export const getPatients = async (): Promise<Patient[]> => {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} to fetch patients...`);
      const querySnapshot = await getDocs(
        query(collection(db, COLLECTIONS.PATIENTS), orderBy('first_name'))
      );
      console.log(`Successfully fetched ${querySnapshot.docs.length} patients`);
      return querySnapshot.docs.map(doc => ({
        patient_id: doc.id,
        ...doc.data()
      })) as Patient[];
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

// Get patient by ID
export const getPatient = async (patientId: string): Promise<Patient | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        patient_id: docSnap.id,
        ...docSnap.data()
      } as Patient;
    }
    return null;
  } catch (error) {
    console.error('Error fetching patient:', error);
    throw error;
  }
};

// Add new patient
export const addPatient = async (patient: Omit<Patient, 'patient_id'>): Promise<string> => {
  try {
    let user_id: string | undefined;
    let tempPassword: string | undefined;
    
    // Create Firebase Auth user account if guardian_email is provided
    if (patient.guardian_email && patient.guardian_email.trim() !== '') {
      try {
        const { createUserAccount } = await import('./users');
        const userAccount = await createUserAccount(
          patient.guardian_email,
          'patient',
          patient.first_name,
          patient.last_name
        );
        user_id = userAccount.uid;
        tempPassword = userAccount.tempPassword;
        
        console.log(`Created user account for patient ${patient.first_name} ${patient.last_name}:`);
        console.log(`Email: ${patient.guardian_email}`);
        console.log(`Temporary Password: ${tempPassword}`);
        console.log('⚠️ Share this temporary password with the guardian for initial login');
      } catch (userError) {
        console.error('Error creating user account for patient:', userError);
        // Continue with patient creation even if user account creation fails
      }
    }
    
    // Create patient document with user_id if available
    const patientData = {
      ...patient,
      user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, COLLECTIONS.PATIENTS), patientData);
    
    // Link user to patient if user account was created
    if (user_id) {
      try {
        const { linkUserToPatient } = await import('./users');
        await linkUserToPatient(user_id, docRef.id);
      } catch (linkError) {
        console.error('Error linking user to patient:', linkError);
        // Continue since patient was already created
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
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding patient:', error);
    throw error;
  }
};

// Update patient
export const updatePatient = async (patientId: string, updates: Partial<Omit<Patient, 'patient_id'>>): Promise<void> => {
  try {
    // Get the current patient data to check for caregiver changes
    const currentPatient = await getPatient(patientId);
    if (!currentPatient) {
      throw new Error('Patient not found');
    }
    
    // Track all old and new caregiver assignments
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
    
    // Update the patient document
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString()
    });
    
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

// Delete patient
export const deletePatient = async (patientId: string): Promise<void> => {
  try {
    // Get the patient data to check for caregiver assignments
    const patient = await getPatient(patientId);
    
    // Collect all caregiver IDs that need updating
    const caregiverIds = [
      patient?.assigned_caregiver_id,
      patient?.assigned_day_caregiver_id,
      patient?.assigned_night_caregiver_id
    ].filter(id => id && id.trim() !== '');
    
    // Delete the patient document
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await deleteDoc(docRef);
    
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