// TypeScript interfaces based on ERD - User-Centered Design
import { Timestamp } from 'firebase/firestore';

// 1. User - Central entity
export interface User {
  user_id: string; // Firebase Auth UID or Firestore document ID
  first_name: string;
  last_name: string;
  email: string;
  password?: string; // Not stored in Firestore for security
  role: 'Patient' | 'Caregiver' | 'Admin' | 'Guardian';
  contact_number: string;
  address: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  is_active: boolean;
}

// 2. Patient - Extends User
export interface Patient {
  patient_id: string; // Same as user_id (FK → User.user_id)
  birthdate: string;
  gender: 'Male' | 'Female' | 'Other';
  assigned_caregiver_id?: string; // FK → Caregiver.caregiver_id
  // Additional patient-specific fields
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  guardian_email?: string;
  care_notes?: string;
  medical_conditions?: string;
  mobility_level?: 'Independent' | 'Assisted' | 'Wheelchair' | 'Bedridden';
  contract_start_date?: string;
  contract_end_date?: string;
}

// 3. Caregiver - Extends User
export interface Caregiver {
  caregiver_id: string; // Same as user_id (FK → User.user_id)
  shift_type: 'Day' | 'Night';
  // Additional caregiver-specific fields
  hire_date?: string;
  license_number?: string;
  license_picture?: string;
  specialization?: string;
  max_patients?: number;
  assigned_patients_count?: number;
  status?: 'Active' | 'Inactive' | 'On Leave';
}

// 4. Medication
export interface Medication {
  medication_id: string;
  patient_id: string; // FK → Patient.patient_id
  medication_name: string;
  dosage: string;
  frequency: string;
  time_of_day: 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'As needed';
  start_date: string;
  end_date?: string;
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  is_active: boolean;
}

// 5. Medical_History
export interface MedicalHistory {
  history_id: string;
  patient_id: string; // FK → Patient.patient_id
  condition: string;
  description?: string;
  date_diagnosed: string;
  treatment?: string;
  attachments?: string[]; // PDF/image paths
  created_at: Timestamp;
  updated_at: Timestamp;
}

// 6. Caregiver_Shift  
export interface CaregiverShift {
  shift_id: string;
  caregiver_id: string; // FK → Caregiver.caregiver_id
  shift_date: Timestamp;
  shift_type: 'Day' | 'Night';
  start_time: Timestamp;
  end_time: Timestamp;
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// 7. Reminder_Log
export interface ReminderLog {
  reminder_id: string;
  medication_id: string; // FK → Medication.medication_id
  patient_id: string; // FK → Patient.patient_id
  scheduled_time: Timestamp;
  status: 'Sent' | 'Acknowledged' | 'Skipped';
  timestamp: Timestamp;
}

// Additional types for backward compatibility and system operations
export type ShiftType = 'Day' | 'Night';
export type UserRole = 'Patient' | 'Caregiver' | 'Admin' | 'Guardian';
export type CaregiverRole = 'Eldercare' | 'Nurse' | 'Therapist';

// Helper interfaces for forms and API
export interface CreateUserRequest {
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  contact_number: string;
  address: string;
  password?: string;
}

export interface CreatePatientRequest extends CreateUserRequest {
  birthdate: string;
  gender: 'Male' | 'Female' | 'Other';
  assigned_caregiver_id?: string;
  guardian_email?: string;
}

export interface CreateCaregiverRequest extends CreateUserRequest {
  shift_type: ShiftType;
  license_number?: string;
  specialization?: string;
}

// Firebase specific types
export interface FirebaseUser extends User {
  uid: string; // Firebase Auth UID - required override
}

export interface FirebasePatient extends Patient {
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FirebaseCaregiver extends Caregiver {
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Legacy type aliases for backward compatibility
export type { Patient as LegacyPatient };
export type { Caregiver as LegacyCaregiver };

// Utility types
export interface Address {
  province: string;
  city_municipality: string;
  barangay: string;
  street: string;
}

export interface ContactInfo {
  name: string;
  phone: string;
  relationship: string;
}

// Account management types (for the new user-centered system)
export interface Account {
  id: string;
  email: string;
  generated_email: string;
  generated_password: string;
  name: string;
  role: 'caregiver' | 'guardian';
  status: 'pending' | 'active' | 'suspended';
  verified: boolean;
  password_changed: boolean;
  createdAt: Timestamp;
  verifiedAt?: Timestamp;
  lastLogin?: Timestamp;
  password_changed_at?: Timestamp;
  suspended_at?: Timestamp;
  suspension_reason?: string;
  reactivated_at?: Timestamp;
  verification_token?: string;
}

// Constants for caregiver patient limits
export const CAREGIVER_PATIENT_LIMITS = {
  Day: 2,
  Night: 4
} as const;

// Helper functions
export const getMaxPatientsForShift = (shiftType: ShiftType): number => {
  return CAREGIVER_PATIENT_LIMITS[shiftType] || 2; // Default to 2
};

export const canCaregiverTakeMorePatients = (caregiver: Caregiver): boolean => {
  const maxPatients = getMaxPatientsForShift(caregiver.shift_type);
  return (caregiver.assigned_patients_count || 0) < maxPatients;
};

export const getAvailablePatientSlots = (caregiver: Caregiver): number => {
  const maxPatients = getMaxPatientsForShift(caregiver.shift_type);
  return maxPatients - (caregiver.assigned_patients_count || 0);
};
