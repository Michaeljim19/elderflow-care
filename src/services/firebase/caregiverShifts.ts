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

// Helper function to convert Timestamp to date string for comparison
const timestampToDateString = (timestamp: Timestamp): string => {
  return timestamp.toDate().toISOString().split('T')[0];
};

// Verify collection name for debugging
console.log('Using caregiver shifts collection:', COLLECTIONS.CAREGIVER_SHIFTS);

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
    // Convert string dates to Timestamps for comparison
    const startTimestamp = Timestamp.fromDate(new Date(startDate));
    const endTimestamp = Timestamp.fromDate(new Date(endDate));
    
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      and(
        where('shift_date', '>=', startTimestamp),
        where('shift_date', '<=', endTimestamp)
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
    
    // Fallback to manual sorting if index is not ready
    if (error instanceof Error && error.message.includes('index')) {
      console.warn('Index not ready, using fallback query...');
      const fallbackQ = query(
        collection(db, COLLECTIONS.CAREGIVER_SHIFTS)
      );
      
      const querySnapshot = await getDocs(fallbackQ);
      const shifts = querySnapshot.docs.map(doc => ({
        shift_id: doc.id,
        ...doc.data()
      })) as CaregiverShift[];
      
      return shifts
        .filter(shift => {
          const shiftDateStr = timestampToDateString(shift.shift_date);
          return shiftDateStr >= startDate && shiftDateStr <= endDate;
        })
        .sort((a, b) => {
          const dateA = timestampToDateString(a.shift_date);
          const dateB = timestampToDateString(b.shift_date);
          return dateA.localeCompare(dateB);
        });
    }
    
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
    // Convert string dates to Timestamps for comparison
    const startTimestamp = Timestamp.fromDate(new Date(startDate));
    const endTimestamp = Timestamp.fromDate(new Date(endDate));
    
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      and(
        where('caregiver_id', '==', caregiverId),
        where('shift_date', '>=', startTimestamp),
        where('shift_date', '<=', endTimestamp)
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
    
    // Fallback to manual sorting if index is not ready
    if (error instanceof Error && error.message.includes('index')) {
      console.warn('Index not ready, using fallback query...');
      const fallbackQ = query(
        collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
        where('caregiver_id', '==', caregiverId)
      );
      
      const querySnapshot = await getDocs(fallbackQ);
      const shifts = querySnapshot.docs.map(doc => ({
        shift_id: doc.id,
        ...doc.data()
      })) as CaregiverShift[];
      
      return shifts
        .filter(shift => {
          const shiftDateStr = timestampToDateString(shift.shift_date);
          return shiftDateStr >= startDate && shiftDateStr <= endDate;
        })
        .sort((a, b) => {
          const dateA = timestampToDateString(a.shift_date);
          const dateB = timestampToDateString(b.shift_date);
          return dateA.localeCompare(dateB);
        });
    }
    
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
      // Only set these if not already provided
      created_at: shift.created_at || Timestamp.now(),
      updated_at: shift.updated_at || Timestamp.now()
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

// Get today's shifts for a specific caregiver
export const getCaregiverTodayShifts = async (caregiverId: string): Promise<CaregiverShift[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      where('caregiver_id', '==', caregiverId)
    );
    const querySnapshot = await getDocs(q);
    const shifts = querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];

    return shifts
      .filter(shift => {
        const shiftDate = shift.shift_date instanceof Timestamp
          ? shift.shift_date.toDate()
          : new Date(shift.shift_date as any);
        return shiftDate >= today && shiftDate < tomorrow;
      })
      .sort((a, b) => {
        const startA = a.start_time instanceof Timestamp ? a.start_time.toDate().getTime() : new Date(a.start_time as any).getTime();
        const startB = b.start_time instanceof Timestamp ? b.start_time.toDate().getTime() : new Date(b.start_time as any).getTime();
        return startA - startB;
      });
  } catch (error) {
    console.error('Error fetching caregiver today shifts:', error);
    
    // Fallback to manual filtering if index is not ready
    if (error instanceof Error && error.message.includes('index')) {
      console.warn('Index not ready, using fallback query for caregiver today shifts...');
      const fallbackQ = query(
        collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
        where('caregiver_id', '==', caregiverId)
      );
      
      const querySnapshot = await getDocs(fallbackQ);
      const shifts = querySnapshot.docs.map(doc => ({
        shift_id: doc.id,
        ...doc.data()
      })) as CaregiverShift[];
      
      return shifts
        .filter(shift => {
          const shiftDate = shift.shift_date instanceof Timestamp
            ? shift.shift_date.toDate()
            : new Date(shift.shift_date as any);
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          const startOfTomorrow = new Date(startOfToday);
          startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
          return shiftDate >= startOfToday && shiftDate < startOfTomorrow;
        })
        .sort((a, b) => {
          // Sort by start_time (assuming it's a string)
          const timeA = typeof a.start_time === 'string' ? a.start_time : a.start_time.toString();
          const timeB = typeof b.start_time === 'string' ? b.start_time : b.start_time.toString();
          return timeA.localeCompare(timeB);
        });
    }
    
    throw error;
  }
};

// Test if the composite index is ready
export const testCaregiverShiftIndex = async (): Promise<boolean> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log('Testing composite index availability...');
    
    // Try to use the composite index with orderBy
    const testQ = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      and(
        where('caregiver_id', '==', 'test-id'),
        where('shift_date', '==', today)
      ),
      orderBy('start_time', 'asc')
    );
    
    await getDocs(testQ);
    console.log('✅ Composite index is ready!');
    return true;
    
  } catch (error) {
    console.log('❌ Composite index not ready yet:', error);
    return false;
  }
};

