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
import { MedicalHistory } from '@/types';

// Get all medical history records
export const getMedicalHistories = async (): Promise<MedicalHistory[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.MEDICAL_HISTORY), orderBy('date_diagnosed', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      history_id: doc.id,
      ...doc.data()
    })) as MedicalHistory[];
  } catch (error) {
    console.error('Error fetching medical histories:', error);
    throw error;
  }
};

// Get medical history by patient
export const getMedicalHistoryByPatient = async (patientId: string): Promise<MedicalHistory[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.MEDICAL_HISTORY),
      where('patient_id', '==', patientId),
      orderBy('date_diagnosed', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      history_id: doc.id,
      ...doc.data()
    })) as MedicalHistory[];
  } catch (error) {
    console.error('Error fetching medical history by patient:', error);
    throw error;
  }
};

// Get single medical history record
export const getMedicalHistory = async (historyId: string): Promise<MedicalHistory | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, historyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        history_id: docSnap.id,
        ...docSnap.data()
      } as MedicalHistory;
    }
    return null;
  } catch (error) {
    console.error('Error fetching medical history:', error);
    throw error;
  }
};

// Add new medical history record
export const addMedicalHistory = async (medicalHistory: Omit<MedicalHistory, 'history_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICAL_HISTORY), {
      ...medicalHistory,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding medical history:', error);
    throw error;
  }
};

// Update medical history record
export const updateMedicalHistory = async (
  historyId: string, 
  updates: Partial<Omit<MedicalHistory, 'history_id'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, historyId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating medical history:', error);
    throw error;
  }
};

// Delete medical history record
export const deleteMedicalHistory = async (historyId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, historyId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting medical history:', error);
    throw error;
  }
};

// Get medical history by condition
export const getMedicalHistoryByCondition = async (condition: string): Promise<MedicalHistory[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.MEDICAL_HISTORY),
      where('condition', '==', condition),
      orderBy('date_diagnosed', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      history_id: doc.id,
      ...doc.data()
    })) as MedicalHistory[];
  } catch (error) {
    console.error('Error fetching medical history by condition:', error);
    throw error;
  }
};
