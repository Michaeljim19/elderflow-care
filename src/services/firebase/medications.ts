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
import { Medication } from '@/types';

const firstNonEmptyString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const normalizeMedication = (id: string, data: Record<string, any>): Medication => {
  const medicationName = firstNonEmptyString(data.medication_name, data.MedName, data.name, data.drug_name, data.MedType);
  const patientId = firstNonEmptyString(data.patient_id, data.patientId, data.user_id, data.userId, data.UserId);
  const timeOfDay = firstNonEmptyString(data.time_of_day, data.timeOfDay, data.TimeOfDay, data.MedTimeOfDay);
  const startDate = firstNonEmptyString(data.start_date, data.startDate, data.Date_recorded, data.Med_PurchaseDate);
  const endDate = firstNonEmptyString(data.end_date, data.endDate, data.Med_ExpireDate);
  const notes = firstNonEmptyString(data.notes, data.instructions, data.special_instructions, data.MedNotes);
  const dosageValue = firstNonEmptyString(data.dosage, data.dose, data.MedDosage);
  const dosageUnit = firstNonEmptyString(data.dosage_unit, data.dosageUnit, data.MedDosageUnit);

  return {
    id,
    medication_id: firstNonEmptyString(data.medication_id) || id,
    patient_id: patientId,
    name: medicationName,
    medication_name: medicationName,
    dosage: [dosageValue, dosageUnit].filter(Boolean).join(' ').trim() || dosageValue,
    frequency: firstNonEmptyString(data.frequency, data.schedule, data.MedType),
    time_of_day: (timeOfDay || 'Morning') as Medication['time_of_day'],
    start_date: startDate,
    end_date: endDate || undefined,
    notes: notes || undefined,
    created_at: data.created_at ?? data.createdAt ?? data.created_time,
    updated_at: data.updated_at ?? data.updatedAt ?? data.updated_time,
    is_active: data.is_active !== false && data.isActive !== false
  };
};

const medicationBelongsToPatient = (
  data: Record<string, any>,
  patientIds: string[],
  patientEmail?: string,
  patientName?: string
) => {
  const candidateIds = [
    data.patient_id,
    data.patientId,
    data.user_id,
    data.userId,
    data.UserId,
    data.patient_document_id,
    data.patientDocumentId
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim());

  const candidateEmails = [
    data.patient_email,
    data.patientEmail,
    data.email
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim().toLowerCase());

  const candidateNames = [
    data.patient_name,
    data.patientName,
    data.PatientName,
    data.name
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim().toLowerCase());

  const candidateFirstNames = [data.patient_first_name, data.patientFirstName, data.PatientFirstName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim().toLowerCase());

  const candidateLastNames = [data.patient_last_name, data.patientLastName, data.PatientLastName]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(value => value.trim().toLowerCase());

  const normalizedPatientName = patientName?.trim().toLowerCase();
  const nameMatches = normalizedPatientName
    ? candidateNames.includes(normalizedPatientName) ||
      candidateFirstNames.some(firstName => normalizedPatientName.startsWith(firstName)) ||
      candidateLastNames.some(lastName => normalizedPatientName.endsWith(lastName))
    : false;

  return patientIds.some(patientId => candidateIds.includes(patientId)) ||
    (patientEmail ? candidateEmails.includes(patientEmail.trim().toLowerCase()) : false) ||
    nameMatches;
};

const sortByMedicationName = (items: Medication[]) =>
  [...items].sort((a, b) => {
    const aRecord = a as Record<string, any>;
    const bRecord = b as Record<string, any>;
    const aName = (aRecord.medication_name || aRecord.name || aRecord.drug_name || '').toString();
    const bName = (bRecord.medication_name || bRecord.name || bRecord.drug_name || '').toString();
    return aName.localeCompare(bName);
  });

// Get all medications
export const getMedications = async (): Promise<Medication[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MEDICATIONS));
    const results = querySnapshot.docs.map(doc => normalizeMedication(doc.id, doc.data() as Record<string, any>));
    
    // Sort by medication_name in memory instead of using Firestore orderBy
    return sortByMedicationName(results);
  } catch (error) {
    console.error('Error fetching medications:', error);
    throw error;
  }
};

// Get medications by patient
export const getMedicationsByPatient = async (
  patientId: string | string[],
  patientEmail?: string,
  patientName?: string
): Promise<Medication[]> => {
  try {
    const patientIds = Array.isArray(patientId)
      ? patientId.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [patientId].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    const querySnapshot = await getDocs(collection(db, COLLECTIONS.MEDICATIONS));
    const results = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        data: doc.data() as Record<string, any>
      }))
      .filter(({ data }) => medicationBelongsToPatient(data, patientIds, patientEmail, patientName))
      .map(({ id, data }) => normalizeMedication(id, data));
    
    // Sort by medication_name in memory instead of using Firestore orderBy
    return sortByMedicationName(results);
  } catch (error) {
    console.error('Error fetching medications by patient:', error);
    throw error;
  }
};

// Get single medication
export const getMedication = async (medicationId: string): Promise<Medication | null> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medicationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return normalizeMedication(docSnap.id, docSnap.data() as Record<string, any>);
    }
    return null;
  } catch (error) {
    console.error('Error fetching medication:', error);
    throw error;
  }
};

// Add new medication
export const addMedication = async (medication: Omit<Medication, 'id' | 'medication_id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICATIONS), {
      ...medication,
      name: medication.name || medication.medication_name,
      medication_name: medication.medication_name || medication.name,
      start_date: medication.start_date,
      end_date: medication.end_date ?? '',
      notes: medication.notes ?? '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding medication:', error);
    throw error;
  }
};

// Update medication
export const updateMedication = async (medicationId: string, updates: Partial<Omit<Medication, 'id' | 'medication_id'>>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medicationId);
    await updateDoc(docRef, {
      ...updates,
      name: updates.name || updates.medication_name,
      medication_name: updates.medication_name || updates.name,
      start_date: updates.start_date,
      end_date: updates.end_date ?? '',
      notes: updates.notes ?? '',
      updated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    throw error;
  }
};

// Delete medication
export const deleteMedication = async (medicationId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medicationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting medication:', error);
    throw error;
  }
};