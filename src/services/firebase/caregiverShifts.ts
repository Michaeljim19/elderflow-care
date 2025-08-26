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

// Get current shifts for a specific caregiver (today's shifts)
export const getCaregiverTodayShifts = async (caregiverId: string): Promise<CaregiverShift[]> => {
  const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
  const todayTimestamp = Timestamp.fromDate(new Date(today));
  
  try {
    // First try: Use simple query with AND conditions but no orderBy
    const q = query(
      collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
      and(
        where('caregiver_id', '==', caregiverId),
        where('shift_date', '==', todayTimestamp)
      )
    );
    
    const querySnapshot = await getDocs(q);
    const shifts = querySnapshot.docs.map(doc => ({
      shift_id: doc.id,
      ...doc.data()
    })) as CaregiverShift[];
    
    // Sort manually by start_time
    const sortedShifts = shifts.sort((a, b) => {
      const timeA = a.start_time.toDate().getTime();
      const timeB = b.start_time.toDate().getTime();
      return timeA - timeB;
    });
    
    console.log(`Found ${sortedShifts.length} shifts for caregiver ${caregiverId} on ${today} (using composite query without orderBy)`);
    return sortedShifts;
    
  } catch (error) {
    console.warn('Composite query failed, using fallback single-field query:', error);
    
    // Fallback: Query by caregiver_id only, then filter by date in memory
    try {
      const fallbackQ = query(
        collection(db, COLLECTIONS.CAREGIVER_SHIFTS),
        where('caregiver_id', '==', caregiverId)
      );
      
      const fallbackSnapshot = await getDocs(fallbackQ);
      const allShifts = fallbackSnapshot.docs.map(doc => ({
        shift_id: doc.id,
        ...doc.data()
      })) as CaregiverShift[];
      
      // Filter by today's date and sort
      const todayShifts = allShifts
        .filter(shift => timestampToDateString(shift.shift_date) === today)
        .sort((a, b) => {
          const timeA = a.start_time.toDate().getTime();
          const timeB = b.start_time.toDate().getTime();
          return timeA - timeB;
        });
        
      console.log(`Found ${todayShifts.length} shifts for caregiver ${caregiverId} on ${today} (using fallback query)`);
      return todayShifts;
      
    } catch (fallbackError) {
      console.error('Error in fallback query:', fallbackError);
      return [];
    }
  }
};
