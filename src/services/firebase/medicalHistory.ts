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
import { 
  uploadMultipleMedicalAttachments, 
  deleteMedicalAttachment 
} from './storage';

// Get all medical history records
export const getMedicalHistories = async (): Promise<MedicalHistory[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MEDICAL_HISTORY));
    const results = querySnapshot.docs.map(doc => ({
      history_id: doc.id,
      ...doc.data()
    })) as MedicalHistory[];
    
    // Sort by date_diagnosed in memory instead of using Firestore orderBy
    return results.sort((a, b) => {
      const dateA = new Date(a.date_diagnosed).getTime();
      const dateB = new Date(b.date_diagnosed).getTime();
      return dateB - dateA; // desc order (newest first)
    });
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
      where('patient_id', '==', patientId)
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({
      history_id: doc.id,
      ...doc.data()
    })) as MedicalHistory[];
    
    // Sort by date_diagnosed in memory instead of using Firestore orderBy
    return results.sort((a, b) => {
      const dateA = new Date(a.date_diagnosed).getTime();
      const dateB = new Date(b.date_diagnosed).getTime();
      return dateB - dateA; // desc order (newest first)
    });
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

// Add new medical history record with file attachments
export const addMedicalHistoryWithAttachments = async (
  medicalHistory: Omit<MedicalHistory, 'history_id' | 'created_at' | 'updated_at' | 'attachments'>,
  attachmentFiles: File[] = [],
  onProgress?: (progress: number, fileName: string) => void
): Promise<string> => {
  try {
    // First, create the medical history record
    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICAL_HISTORY), {
      ...medicalHistory,
      attachments: [], // Will be updated after file upload
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const historyId = docRef.id;

    // Upload attachments if any
    let attachmentUrls: string[] = [];
    if (attachmentFiles.length > 0) {
      attachmentUrls = await uploadMultipleMedicalAttachments(
        attachmentFiles,
        medicalHistory.patient_id,
        historyId,
        onProgress
      );

      // Update the record with attachment URLs
      await updateDoc(docRef, {
        attachments: attachmentUrls,
        updated_at: new Date().toISOString()
      });
    }

    return historyId;
  } catch (error) {
    console.error('Error adding medical history with attachments:', error);
    throw error;
  }
};

// Add new medical history record (original function for backward compatibility)
export const addMedicalHistory = async (medicalHistory: Omit<MedicalHistory, 'history_id' | 'created_at' | 'updated_at'>): Promise<string> => {
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

// Update medical history record with attachments
export const updateMedicalHistoryWithAttachments = async (
  historyId: string, 
  updates: Partial<Omit<MedicalHistory, 'history_id'>>,
  newAttachmentFiles: File[] = [],
  removedAttachmentUrls: string[] = [],
  onProgress?: (progress: number, fileName: string) => void
): Promise<void> => {
  try {
    // Get current record to access patient_id and existing attachments
    const docRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, historyId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Medical history record not found');
    }
    
    const currentData = docSnap.data() as MedicalHistory;
    const currentAttachments = currentData.attachments || [];
    const patientId = currentData.patient_id;

    // Delete removed attachments from storage
    if (removedAttachmentUrls.length > 0) {
      for (const url of removedAttachmentUrls) {
        try {
          await deleteMedicalAttachment(url);
        } catch (error) {
          console.warn('Error deleting attachment:', url, error);
        }
      }
    }

    // Upload new attachments
    let newAttachmentUrls: string[] = [];
    if (newAttachmentFiles.length > 0) {
      newAttachmentUrls = await uploadMultipleMedicalAttachments(
        newAttachmentFiles,
        patientId,
        historyId,
        onProgress
      );
    }

    // Calculate final attachment URLs
    const remainingAttachments = currentAttachments.filter(
      url => !removedAttachmentUrls.includes(url)
    );
    const finalAttachments = [...remainingAttachments, ...newAttachmentUrls];

    // Update the record
    await updateDoc(docRef, {
      ...updates,
      attachments: finalAttachments,
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating medical history with attachments:', error);
    throw error;
  }
};

// Update medical history record (original function for backward compatibility)
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

// Delete medical history record with attachments
export const deleteMedicalHistoryWithAttachments = async (historyId: string): Promise<void> => {
  try {
    // Get the record to access attachments
    const docRef = doc(db, COLLECTIONS.MEDICAL_HISTORY, historyId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as MedicalHistory;
      const attachments = data.attachments || [];
      
      // Delete all attachments from storage
      for (const url of attachments) {
        try {
          await deleteMedicalAttachment(url);
        } catch (error) {
          console.warn('Error deleting attachment during cleanup:', url, error);
        }
      }
    }
    
    // Delete the document
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting medical history with attachments:', error);
    throw error;
  }
};

// Delete medical history record (original function for backward compatibility)
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
