// Firestore collection names based on ERD
export const COLLECTIONS = {
  PATIENTS: 'patients',
  MEDICATIONS: 'medications', 
  MEDICAL_HISTORY: 'medical_history',
  CAREGIVERS: 'caregivers',
  CAREGIVER_SHIFTS: 'caregiver_shifts',
  REMINDER_LOGS: 'reminder_logs'
} as const;

// Collection references for type safety
export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];