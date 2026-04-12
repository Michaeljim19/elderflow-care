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
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from './collections';
import { ReminderLog, ReminderStatus } from '@/types';

// Get all reminder logs
export const getReminderLogs = async (): Promise<ReminderLog[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.REMINDER_LOGS), orderBy('scheduled_time', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      reminder_id: doc.id,
      ...doc.data()
    })) as ReminderLog[];
  } catch (error) {
    console.error('Error fetching reminder logs:', error);
    throw error;
  }
};

// Get reminder logs by patient
export const getReminderLogsByPatient = async (patientId: string): Promise<ReminderLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDER_LOGS),
      where('patient_id', '==', patientId),
      orderBy('scheduled_time', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      reminder_id: doc.id,
      ...doc.data()
    })) as ReminderLog[];
  } catch (error) {
    console.error('Error fetching reminder logs by patient:', error);
    throw error;
  }
};

// Get reminder logs by medication
export const getReminderLogsByMedication = async (medicationId: string): Promise<ReminderLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDER_LOGS),
      where('medication_id', '==', medicationId),
      orderBy('scheduled_time', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      reminder_id: doc.id,
      ...doc.data()
    })) as ReminderLog[];
  } catch (error) {
    console.error('Error fetching reminder logs by medication:', error);
    throw error;
  }
};

// Get reminder logs by status
export const getReminderLogsByStatus = async (status: ReminderStatus): Promise<ReminderLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDER_LOGS),
      where('status', '==', status),
      orderBy('scheduled_time', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      reminder_id: doc.id,
      ...doc.data()
    })) as ReminderLog[];
  } catch (error) {
    console.error('Error fetching reminder logs by status:', error);
    throw error;
  }
};

// Get pending reminders (scheduled and sent reminders)
export const getPendingReminders = async (): Promise<ReminderLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDER_LOGS),
      where('status', 'in', ['Scheduled', 'Sent']),
      orderBy('scheduled_time', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      reminder_id: doc.id,
      ...doc.data()
    })) as ReminderLog[];
  } catch (error) {
    console.error('Error fetching pending reminders:', error);
    throw error;
  }
};

// Get upcoming reminders for a patient
export const getUpcomingRemindersByPatient = async (
  patientId: string, 
  limitCount: number = 10
): Promise<ReminderLog[]> => {
  try {
    const now = new Date().toISOString();
    const q = query(
      collection(db, COLLECTIONS.REMINDER_LOGS),
      and(
        where('patient_id', '==', patientId),
        where('scheduled_time', '>=', now),
        where('status', 'in', ['Scheduled', 'Sent'])
      ),
      orderBy('scheduled_time', 'asc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      reminder_id: doc.id,
      ...doc.data()
    })) as ReminderLog[];
  } catch (error) {
    console.error('Error fetching upcoming reminders by patient:', error);
    throw error;
  }
};

// Get reminder logs by date range
export const getReminderLogsByDateRange = async (
  startDate: string, 
  endDate: string
): Promise<ReminderLog[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDER_LOGS),
      and(
        where('scheduled_time', '>=', startDate),
        where('scheduled_time', '<=', endDate)
      ),
      orderBy('scheduled_time', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      reminder_id: doc.id,
      ...doc.data()
    })) as ReminderLog[];
  } catch (error) {
    console.error('Error fetching reminder logs by date range:', error);
    throw error;
  }
};

// Get single reminder log
export const getReminderLog = async (reminderId: string): Promise<ReminderLog | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.REMINDER_LOGS, reminderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        reminder_id: docSnap.id,
        ...docSnap.data()
      } as ReminderLog;
    }
    return null;
  } catch (error) {
    console.error('Error fetching reminder log:', error);
    throw error;
  }
};

// Add new reminder log
export const addReminderLog = async (reminderLog: Omit<ReminderLog, 'reminder_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.REMINDER_LOGS), {
      ...reminderLog,
      timestamp: reminderLog.timestamp || Timestamp.fromDate(new Date()),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding reminder log:', error);
    throw error;
  }
};

// Update reminder log (typically to change status)
export const updateReminderLog = async (
  reminderId: string, 
  updates: Partial<Omit<ReminderLog, 'reminder_id'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.REMINDER_LOGS, reminderId);
    await updateDoc(docRef, {
      ...updates,
      timestamp: updates.timestamp || Timestamp.fromDate(new Date()),
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating reminder log:', error);
    throw error;
  }
};

// Acknowledge reminder (mark as acknowledged)
export const acknowledgeReminder = async (
  reminderId: string, 
  acknowledgedBy: string, 
  notes?: string
): Promise<void> => {
  try {
    await updateReminderLog(reminderId, {
      status: 'Acknowledged',
      acknowledged_by: acknowledgedBy,
      notes: notes
    });
  } catch (error) {
    console.error('Error acknowledging reminder:', error);
    throw error;
  }
};

// Mark reminder as missed
export const markReminderAsMissed = async (reminderId: string, notes?: string): Promise<void> => {
  try {
    await updateReminderLog(reminderId, {
      status: 'Missed',
      notes: notes
    });
  } catch (error) {
    console.error('Error marking reminder as missed:', error);
    throw error;
  }
};

// Delete reminder log
export const deleteReminderLog = async (reminderId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.REMINDER_LOGS, reminderId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting reminder log:', error);
    throw error;
  }
};

// Generate medication reminders for a specific medication
export const generateMedicationReminders = async (
  medicationId: string,
  patientId: string,
  startDate: string,
  endDate: string,
  frequency: string,
  timeOfDay: string
): Promise<string[]> => {
  try {
    const reminderIds: string[] = [];
    
    // This is a simplified implementation
    // In a real application, you'd have more complex logic for generating reminders
    // based on frequency and time of day
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);
    
    while (currentDate <= end) {
      const scheduledTime = new Date(currentDate);
      
      // Set time based on time_of_day
      switch (timeOfDay) {
        case 'Morning':
          scheduledTime.setHours(8, 0, 0, 0);
          break;
        case 'Afternoon':
          scheduledTime.setHours(14, 0, 0, 0);
          break;
        case 'Evening':
          scheduledTime.setHours(18, 0, 0, 0);
          break;
        case 'Night':
          scheduledTime.setHours(22, 0, 0, 0);
          break;
        default:
          scheduledTime.setHours(12, 0, 0, 0);
      }
      
      const reminderId = await addReminderLog({
        medication_id: medicationId,
        patient_id: patientId,
        scheduled_time: Timestamp.fromDate(scheduledTime),
        status: 'Scheduled',
        timestamp: Timestamp.fromDate(new Date()),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      reminderIds.push(reminderId);
      
      // Move to next day (simplified - in real app, frequency would determine this)
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return reminderIds;
  } catch (error) {
    console.error('Error generating medication reminders:', error);
    throw error;
  }
};
