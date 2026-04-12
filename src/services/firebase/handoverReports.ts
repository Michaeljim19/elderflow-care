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

export interface HandoverReport {
  id: string;
  patient_id: string;
  patient_name: string;
  caregiver_id: string;
  caregiver_name: string;
  shift_type: 'Day' | 'Night';
  shift_date: string;
  shift_start: string;
  shift_end: string;
  handover_time: string;
  vital_signs: {
    blood_pressure: string;
    heart_rate: string;
    temperature: string;
    oxygen_saturation: string;
  };
  medications_given: Array<{
    name: string;
    time: string;
    status: 'Given' | 'Refused' | 'Missed';
  }>;
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  activities: string;
  behavioral_notes: string;
  concerns: string;
  instructions_for_next_shift: string;
  status: 'Normal' | 'Needs Attention' | 'Critical';
  priority: 'Low' | 'Medium' | 'High';
  created_at: any; // Firebase Timestamp
  updated_at: any; // Firebase Timestamp
}

// Get all handover reports
export const getHandoverReports = async (): Promise<HandoverReport[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.HANDOVER_REPORTS), orderBy('created_at', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching handover reports:', error);
    throw error;
  }
};

// Get reports by patient
export const getReportsByPatient = async (patientId: string): Promise<HandoverReport[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      where('patient_id', '==', patientId),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching reports by patient:', error);
    throw error;
  }
};

// Get reports by caregiver
export const getReportsByCaregiver = async (caregiverId: string): Promise<HandoverReport[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      where('caregiver_id', '==', caregiverId),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching reports by caregiver:', error);
    throw error;
  }
};

// Get reports by date range
export const getReportsByDateRange = async (startDate: string, endDate: string): Promise<HandoverReport[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      and(
        where('shift_date', '>=', startDate),
        where('shift_date', '<=', endDate)
      ),
      orderBy('shift_date', 'desc'),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching reports by date range:', error);
    throw error;
  }
};

// Get reports by status
export const getReportsByStatus = async (status: string): Promise<HandoverReport[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      where('status', '==', status),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching reports by status:', error);
    throw error;
  }
};

// Get latest report for a patient
export const getLatestReportForPatient = async (patientId: string): Promise<HandoverReport | null> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      where('patient_id', '==', patientId),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as HandoverReport;
  } catch (error) {
    console.error('Error fetching latest report for patient:', error);
    throw error;
  }
};

// Get single handover report
export const getHandoverReport = async (reportId: string): Promise<HandoverReport | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.HANDOVER_REPORTS, reportId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as HandoverReport;
    }
    return null;
  } catch (error) {
    console.error('Error fetching handover report:', error);
    throw error;
  }
};

// Add new handover report
export const addHandoverReport = async (report: Omit<HandoverReport, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.HANDOVER_REPORTS), {
      ...report,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding handover report:', error);
    throw error;
  }
};

// Update handover report
export const updateHandoverReport = async (
  reportId: string, 
  updates: Partial<Omit<HandoverReport, 'id'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.HANDOVER_REPORTS, reportId);
    await updateDoc(docRef, {
      ...updates,
      updated_at: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating handover report:', error);
    throw error;
  }
};

// Delete handover report
export const deleteHandoverReport = async (reportId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.HANDOVER_REPORTS, reportId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting handover report:', error);
    throw error;
  }
};

// Get reports that need attention (status = "Needs Attention" or "Critical")
export const getReportsNeedingAttention = async (): Promise<HandoverReport[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      where('status', 'in', ['Needs Attention', 'Critical']),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching reports needing attention:', error);
    throw error;
  }
};

// Get today's reports
export const getTodaysReports = async (): Promise<HandoverReport[]> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      where('shift_date', '==', today),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching today\'s reports:', error);
    throw error;
  }
};

// Get reports by shift type
export const getReportsByShiftType = async (shiftType: 'Day' | 'Night'): Promise<HandoverReport[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.HANDOVER_REPORTS),
      where('shift_type', '==', shiftType),
      orderBy('created_at', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as HandoverReport[];
  } catch (error) {
    console.error('Error fetching reports by shift type:', error);
    throw error;
  }
};
