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
  and,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { CaregiverShift } from '@/types';

// Get all caregiver shifts
export const getCaregiverShifts = async (): Promise<CaregiverShift[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.CAREGIVER_SHIFTS), orderBy('shift_date', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];
  } catch (error) {
    console.error('Error fetching caregiver shifts:', error);
    throw error;
  }
};

// Get shifts by caregiver
export const getShiftsByCaregiver = async (caregiverId: string): Promise<CaregiverShift[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      where('caregiver_id', '==', caregiverId),
      orderBy('shift_date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];
  } catch (error) {
    console.error('Error fetching shifts by caregiver:', error);
    throw error;
  }
};

// Get shifts by date range
export const getShiftsByDateRange = async (startDate: string, endDate: string): Promise<CaregiverShift[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      and(
        where('shift_date', '>=', startDate),
        where('shift_date', '<=', endDate)
      ),
      orderBy('shift_date', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];
  } catch (error) {
    console.error('Error fetching shifts by date range:', error);
    throw error;
  }
};

// Get shifts by caregiver and date range
export const getShiftsByCaregiverAndDateRange = async (
  caregiverId: string, 
  startDate: string, 
  endDate: string
): Promise<CaregiverShift[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      and(
        where('caregiver_id', '==', caregiverId),
        where('shift_date', '>=', startDate),
        where('shift_date', '<=', endDate)
      ),
      orderBy('shift_date', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];
  } catch (error) {
    console.error('Error fetching shifts by caregiver and date range:', error);
    throw error;
  }
};

// Get single shift
export const getCaregiverShift = async (shiftId: string): Promise<CaregiverShift | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVER_SHIFTS, shiftId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        shift_id: docSnap.id,
        ...docSnap.data()
      } as CaregiverShift;
    }
    return null;
  } catch (error) {
    console.error('Error fetching caregiver shift:', error);
    throw error;
  }
};

// Add new shift
export const addCaregiverShift = async (shift: Omit<CaregiverShift, 'shift_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.CAREGIVER_SHIFTS), {
      ...shift,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding caregiver shift:', error);
    throw error;
  }
};

// Update shift
export const updateCaregiverShift = async (
  shiftId: string, 
  updates: Partial<Omit<CaregiverShift, 'shift_id'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVER_SHIFTS, shiftId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating caregiver shift:', error);
    throw error;
  }
};

// Delete shift
export const deleteCaregiverShift = async (shiftId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CAREGIVER_SHIFTS, shiftId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting caregiver shift:', error);
    throw error;
  }
};

// Get shifts by shift type
export const getShiftsByType = async (shiftType: 'Day' | 'Night'): Promise<CaregiverShift[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      where('shift_type', '==', shiftType),
      orderBy('shift_date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];
  } catch (error) {
    console.error('Error fetching shifts by type:', error);
    throw error;
  }
};

// Get current shifts (today's shifts)
export const getCurrentShifts = async (): Promise<CaregiverShift[]> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      where('shift_date', '==', today),
      orderBy('start_time', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];
  } catch (error) {
    console.error('Error fetching current shifts:', error);
    throw error;
  }
};
