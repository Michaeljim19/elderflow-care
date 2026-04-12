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
import { Reminder, NotificationTime } from '@/types';

const sortRemindersByNewest = (items: Reminder[]) =>
  [...items].sort((a, b) => {
    const getTime = (value: any) => {
      if (!value) return 0;
      if (typeof value.toDate === 'function') return value.toDate().getTime();
      if (typeof value === 'string') return new Date(value).getTime();
      if (value instanceof Date) return value.getTime();
      return 0;
    };

    return getTime(b.createdTime ?? b.created_at) - getTime(a.createdTime ?? a.created_at);
  });

// Get all reminders
export const getReminders = async (): Promise<Reminder[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.REMINDERS));
    const reminders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
    return sortRemindersByNewest(reminders);
  } catch (error) {
    console.error('Error fetching reminders:', error);
    throw error;
  }
};

// Get reminders by user
export const getRemindersByUser = async (userId: string): Promise<Reminder[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.REMINDERS), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const reminders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
    return sortRemindersByNewest(reminders);
  } catch (error) {
    console.error('Error fetching reminders by user:', error);
    throw error;
  }
};

// Get reminders by caregiver reference
export const getRemindersByCaregiver = async (caregiverRef: string): Promise<Reminder[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.REMINDERS), where('caregiverRef', '==', caregiverRef));
    const querySnapshot = await getDocs(q);
    const reminders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
    return sortRemindersByNewest(reminders);
  } catch (error) {
    console.error('Error fetching reminders by caregiver:', error);
    throw error;
  }
};

// Get active reminders
export const getActiveReminders = async (): Promise<Reminder[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.REMINDERS), where('is_active', '==', true));
    const querySnapshot = await getDocs(q);
    const reminders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
    return sortRemindersByNewest(reminders);
  } catch (error) {
    console.error('Error fetching active reminders:', error);
    throw error;
  }
};

// Get reminders by type
export const getRemindersByType = async (type: string): Promise<Reminder[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.REMINDERS), where('type', '==', type));
    const querySnapshot = await getDocs(q);
    const reminders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
    return sortRemindersByNewest(reminders);
  } catch (error) {
    console.error('Error fetching reminders by type:', error);
    throw error;
  }
};

// Get single reminder
export const getReminder = async (reminderId: string): Promise<Reminder | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.REMINDERS, reminderId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        reminder_id: docSnap.id,
        ...docSnap.data()
      } as Reminder;
    }
    return null;
  } catch (error) {
    console.error('Error fetching reminder:', error);
    throw error;
  }
};

// Add new reminder
export const addReminder = async (reminder: Omit<Reminder, 'id' | 'reminder_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.REMINDERS), {
      ...reminder,
      status: reminder.status || 'Scheduled',
      createdTime: reminder.createdTime || Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding reminder:', error);
    throw error;
  }
};

// Update reminder
export const updateReminder = async (
  reminderId: string, 
  updates: Partial<Omit<Reminder, 'reminder_id'>>
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.REMINDERS, reminderId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating reminder:', error);
    throw error;
  }
};

// Toggle reminder active status
export const toggleReminderStatus = async (reminderId: string, isActive: boolean): Promise<void> => {
  try {
    await updateReminder(reminderId, { is_active: isActive });
  } catch (error) {
    console.error('Error toggling reminder status:', error);
    throw error;
  }
};

// Delete reminder
export const deleteReminder = async (reminderId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.REMINDERS, reminderId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting reminder:', error);
    throw error;
  }
};

// Delete reminders linked to a medication
export const deleteRemindersByMedication = async (medicationId: string): Promise<number> => {
  try {
    const q = query(collection(db, COLLECTIONS.REMINDERS), where('medication_id', '==', medicationId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return 0;
    }

    await Promise.all(querySnapshot.docs.map(reminderDoc => deleteDoc(reminderDoc.ref)));
    return querySnapshot.size;
  } catch (error) {
    console.error('Error deleting reminders by medication:', error);
    throw error;
  }
};

// Mark one due reminder log linked to a medication as acknowledged.
// This keeps the reminder schedule itself active so future doses are not marked completed early.
export const markMedicationReminderTaken = async (
  medicationId: string,
  patientId: string,
  notes?: string
): Promise<number> => {
  try {
    const now = new Date();
    const nowTimestamp = Timestamp.fromDate(now);

    const [remindersSnapshot, reminderLogsSnapshot] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.REMINDERS)),
      getDocs(collection(db, COLLECTIONS.REMINDER_LOGS))
    ]);

    const matchingReminder = remindersSnapshot.docs
      .map(docSnap => ({ id: docSnap.id, data: docSnap.data() as Record<string, any> }))
      .filter(({ data }) =>
        data.medication_id === medicationId &&
        (!data.patient_id || data.patient_id === patientId)
      )
      .sort((a, b) => {
        const aTime = a.data.createdTime?.toDate?.()?.getTime?.() ?? 0;
        const bTime = b.data.createdTime?.toDate?.()?.getTime?.() ?? 0;
        return bTime - aTime;
      })[0];

    const pendingLog = reminderLogsSnapshot.docs
      .map(docSnap => ({ id: docSnap.id, data: docSnap.data() as Record<string, any> }))
      .filter(({ data }) => {
        if (data.medication_id !== medicationId || data.patient_id !== patientId) {
          return false;
        }

        const status = String(data.status || '').toLowerCase();
        if (status !== 'scheduled' && status !== 'sent') {
          return false;
        }

        const scheduledTime = data.scheduled_time?.toDate?.()?.getTime?.() ?? new Date(data.scheduled_time || 0).getTime();
        return scheduledTime <= now.getTime();
      })
      .sort((a, b) => {
        const aTime = a.data.scheduled_time?.toDate?.()?.getTime?.() ?? new Date(a.data.scheduled_time || 0).getTime();
        const bTime = b.data.scheduled_time?.toDate?.()?.getTime?.() ?? new Date(b.data.scheduled_time || 0).getTime();
        return bTime - aTime;
      })[0];

    if (pendingLog) {
      await updateDoc(doc(db, COLLECTIONS.REMINDER_LOGS, pendingLog.id), {
        status: 'Acknowledged',
        acknowledged_by: 'Medication Management',
        notes: notes || 'Marked as taken',
        timestamp: nowTimestamp,
        updated_at: now.toISOString()
      });

      return 1;
    }

    if (matchingReminder) {
      await addDoc(collection(db, COLLECTIONS.REMINDER_LOGS), {
        reminder_id: matchingReminder.id,
        medication_id: medicationId,
        patient_id: patientId,
        scheduled_time: nowTimestamp,
        status: 'Acknowledged',
        timestamp: nowTimestamp,
        acknowledged_by: 'Medication Management',
        notes: notes || 'Marked as taken',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });

      return 1;
    }

    return 0;
  } catch (error) {
    console.error('Error marking medication reminder as taken:', error);
    throw error;
  }
};
