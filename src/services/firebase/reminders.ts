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

// Get all reminders
export const getReminders = async (): Promise<Reminder[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, COLLECTIONS.REMINDERS), orderBy('createdTime', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
  } catch (error) {
    console.error('Error fetching reminders:', error);
    throw error;
  }
};

// Get reminders by user
export const getRemindersByUser = async (userId: string): Promise<Reminder[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDERS),
      where('userId', '==', userId),
      orderBy('createdTime', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
  } catch (error) {
    console.error('Error fetching reminders by user:', error);
    throw error;
  }
};

// Get reminders by caregiver reference
export const getRemindersByCaregiver = async (caregiverRef: string): Promise<Reminder[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDERS),
      where('caregiverRef', '==', caregiverRef),
      orderBy('createdTime', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
  } catch (error) {
    console.error('Error fetching reminders by caregiver:', error);
    throw error;
  }
};

// Get active reminders
export const getActiveReminders = async (): Promise<Reminder[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDERS),
      where('is_active', '==', true),
      orderBy('createdTime', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
  } catch (error) {
    console.error('Error fetching active reminders:', error);
    throw error;
  }
};

// Get reminders by type
export const getRemindersByType = async (type: string): Promise<Reminder[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.REMINDERS),
      where('type', '==', type),
      orderBy('createdTime', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      reminder_id: doc.id,
      ...doc.data()
    })) as Reminder[];
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
export const addReminder = async (reminder: Omit<Reminder, 'reminder_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.REMINDERS), {
      ...reminder,
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
