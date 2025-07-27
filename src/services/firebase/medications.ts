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
import { Medication } from '@/types';

// Get all medications
export const getMedications = async (): Promise<Medication[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.MEDICATIONS), orderBy('medication_name'))
    );
    return querySnapshot.docs.map(doc => ({
      medication_id: doc.id,
      ...doc.data()
    })) as Medication[];
  } catch (error) {
    console.error('Error fetching medications:', error);
    throw error;
  }
};

// Get medications by patient
export const getMedicationsByPatient = async (patientId: string): Promise<Medication[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.MEDICATIONS),
      where('patient_id', '==', patientId),
      orderBy('medication_name')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      medication_id: doc.id,
      ...doc.data()
    })) as Medication[];
  } catch (error) {
    console.error('Error fetching medications by patient:', error);
    throw error;
  }
};

// Add new medication
export const addMedication = async (medication: Omit<Medication, 'medication_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICATIONS), {
      ...medication,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding medication:', error);
    throw error;
  }
};

// Update medication
export const updateMedication = async (medicationId: string, updates: Partial<Omit<Medication, 'medication_id'>>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medicationId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    throw error;
  }
};

// Delete medication
export const deleteMedication = async (medicationId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medicationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting medication:', error);
    throw error;
  }
};