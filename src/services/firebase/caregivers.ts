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
import { auth, db } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { Caregiver, ShiftType, CaregiverRole } from '@/types';

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
  created_at?: Timestamp;
  updated_at?: Timestamp;
};

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
export const addCaregiver = async (caregiver: FirebaseCaregiver): Promise<string> => {
  try {
    // Check if user is authenticated
    const currentUser = auth.currentUser;
    console.log('Current user:', currentUser);
    console.log('Attempting to add caregiver:', caregiver);
    
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    // Add timestamps
    const caregiverWithTimestamps = {
      ...caregiver,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.CAREGIVERS), caregiverWithTimestamps);
    console.log('Successfully added caregiver with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding caregiver:', error);
    throw error;
  }
};

// Update caregiver
export const updateCaregiver = async (caregiverId: string, updates: Partial<FirebaseCaregiver>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVERS, caregiverId);
    await updateDoc(docRef, updates);
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