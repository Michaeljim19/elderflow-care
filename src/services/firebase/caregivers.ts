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
import { Caregiver } from '@/types';

// Get all caregivers
export const getCaregivers = async (): Promise<Caregiver[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.CAREGIVERS), orderBy('first_name'))
    );
    return querySnapshot.docs.map(doc => ({
      caregiver_id: doc.id,
      ...doc.data()
    })) as Caregiver[];
  } catch (error) {
    console.error('Error fetching caregivers:', error);
    throw error;
  }
};

// Get caregiver by ID
export const getCaregiver = async (caregiverId: string): Promise<Caregiver | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVERS, caregiverId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        caregiver_id: docSnap.id,
        ...docSnap.data()
      } as Caregiver;
    }
    return null;
  } catch (error) {
    console.error('Error fetching caregiver:', error);
    throw error;
  }
};

// Add new caregiver
export const addCaregiver = async (caregiver: Omit<Caregiver, 'caregiver_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.CAREGIVERS), {
      ...caregiver,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding caregiver:', error);
    throw error;
  }
};

// Update caregiver
export const updateCaregiver = async (caregiverId: string, updates: Partial<Omit<Caregiver, 'caregiver_id'>>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVERS, caregiverId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString()
    });
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

// Get active caregivers
export const getActiveCaregivers = async (): Promise<Caregiver[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.CAREGIVERS),
      where('status', '==', 'Active'),
      orderBy('first_name')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      caregiver_id: doc.id,
      ...doc.data()
    })) as Caregiver[];
  } catch (error) {
    console.error('Error fetching active caregivers:', error);
    throw error;
  }
};