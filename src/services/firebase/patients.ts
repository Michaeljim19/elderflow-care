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
import { Patient } from '@/types';

// Get all patients
export const getPatients = async (): Promise<Patient[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.PATIENTS), orderBy('first_name'))
    );
    return querySnapshot.docs.map(doc => ({
      patient_id: doc.id,
      ...doc.data()
    })) as Patient[];
  } catch (error) {
    console.error('Error fetching patients:', error);
    throw error;
  }
};

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
    const docRef = await addDoc(collection(db, COLLECTIONS.PATIENTS), {
      ...patient,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding patient:', error);
    throw error;
  }
};

// Update patient
export const updatePatient = async (patientId: string, updates: Partial<Omit<Patient, 'patient_id'>>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
};

// Delete patient
export const deletePatient = async (patientId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting patient:', error);
    throw error;
  }
};

// Get patients by caregiver
export const getPatientsByCaregiver = async (caregiverId: string): Promise<Patient[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.PATIENTS),
      where('assigned_caregiver_id', '==', caregiverId),
      orderBy('first_name')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      patient_id: doc.id,
      ...doc.data()
    })) as Patient[];
  } catch (error) {
    console.error('Error fetching patients by caregiver:', error);
    throw error;
  }
};