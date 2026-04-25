// TypeScript interfaces based on ERD - User-Centered Design
import { Timestamp } from 'firebase/firestore';

// 1. User - Central entity
export interface User {
  user_id: string; // Firebase Auth UID or Firestore document ID
  first_name: string;
  middle_name?: string;
  last_name: string;
  email: string;
  password?: string; // Not stored in Firestore for security
  role: 'Patient' | 'Caregiver' | 'Admin' | 'Guardian';
  contact_number: string;
  address: string;
  birthdate?: string;
  gender?: 'Male' | 'Female' | 'Other';
  birthday?: string; // Birthday field for users
  created_at: Timestamp;
  updated_at: Timestamp;
  is_active: boolean;
  auth_created?: boolean;
}

// 2. Patient - Extends User (with temporary compatibility fields)
export interface Patient {
  id: string; // Document ID
  patient_id: string; // Same as user_id (FK → User.user_id)
  user_id?: string; // Reference to User.user_id for linking
  
  // Core patient fields
  birthdate: string;
  gender: 'Male' | 'Female' | 'Other';
  assigned_caregiver_id?: string; // FK → Caregiver.caregiver_id
  
  // Temporary compatibility fields (should be in User entity)
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  birthday?: string;
  contact_number?: number;
  address?: string;
  
  // Additional patient-specific fields
  assigned_day_caregiver_id?: string; // FK → Caregiver.caregiver_id (Day shift)
  assigned_night_caregiver_id?: string; // FK → Caregiver.caregiver_id (Night shift)
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  email?: string; // Changed from guardian_email to email
  care_notes?: string;
  medical_conditions?: string;
  mobility_level?: 'Independent' | 'Assisted' | 'Wheelchair' | 'Bedridden';
  contract_start_date?: string;
  contract_end_date?: string;
  is_active?: boolean;
  created_at?: any;
  updated_at?: any;
}

// 3. Caregiver - Extends User (with temporary compatibility fields)
export interface Caregiver {
  caregiver_id: string; // Same as user_id (FK → User.user_id)
  user_id?: string; // Reference to User.user_id
  shift_type: 'Day' | 'Night';
  
  // Temporary compatibility fields (should be in User entity)
  first_name?: string;
  last_name?: string;
  email?: string;
  contact_number?: number;
  address?: string | CaregiverAddress;
  
  // Additional caregiver-specific fields
  hire_date?: string;
  license_number?: string;
  license_picture?: string;
  specialization?: string;
  max_patients?: number;
  assigned_patients_count?: number;
  status?: 'pending' | 'Active' | 'Inactive' | 'On Leave';
  auth_created?: boolean;
  emailVerified?: boolean;
  email_verified?: boolean;
  is_active?: boolean;
  verified?: boolean;
  
  // Additional fields found in the system
  middle_name?: string;
  birthday?: string;
  role?: string;
  shift_start_date?: any;
  shift_end_date?: any;
  contract_start_date?: string;
  contract_end_date?: string;
  temporary_schedule_reason?: string;
  original_shift_type?: string;
  original_shift_start_date?: any;
  original_shift_end_date?: any;
  created_at?: any;
  updated_at?: any;
  employment_start?: any;
  license_type?: string;
  employment_status?: 'active' | 'inactive';
  hourly_rate?: number;
  availability?: any[];
  emergency_contact?: string;
  emergency_contact_name?: string;
}

// 4. Medication
export interface Medication {
  id: string; // Document ID
  medication_id: string;
  patient_id: string; // FK → Patient.patient_id
  name: string; // Medication name field
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
  severity?: string;
  status?: string;
  medications?: string;
  allergies?: string;
  attachments?: string[]; // PDF/image paths
  notes?: string; // Added notes field
  
  // New consolidated medical history fields
  current_medical_conditions?: string[]; // Array of current medical conditions
  past_medical_history?: string[]; // Array of past medical conditions
  current_medications?: string[]; // Array of current medications
  known_allergies?: string[]; // Array of known allergies
  serialized_conditions?: string; // Backward compatibility serialized format
  
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

// 7. Reminder
export interface Reminder {
  id: string; // Document ID
  reminder_id: string;
  caregiverRef: string; // Reference to caregiver
  userId: string; // User ID
  title: string;
  description: string;
  type: 'Task' | 'Medication' | 'Appointment' | 'Custom';
  repeat: 'Once' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  is_active: boolean;
  status?: 'Scheduled' | 'Sent' | 'Acknowledged' | 'Skipped' | 'Missed';
  notification_times: Array<{
    hour: number;
    minute: number;
  }>;
  createdTime: Timestamp;
  updatedTime?: Timestamp;
  
  // Legacy fields for backward compatibility
  medication_id?: string;
  patient_id?: string;
  reminder_type?: 'Medication' | 'Appointment' | 'Custom';
  scheduled_time?: Timestamp;
  frequency?: 'Once' | 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

// Notification time structure (simplified)
export interface NotificationTime {
  hour: number;
  minute: number;
  repeat?: string; // Made optional since the actual structure doesn't have it
}

// 8. Reminder_Log
export interface ReminderLog {
  id: string; // Document ID
  reminder_id: string;
  userId?: string; // User ID field
  caregiverRef?: string; // Caregiver reference field
  medication_id: string; // FK → Medication.medication_id
  patient_id: string; // FK → Patient.patient_id
  scheduled_time: Timestamp;
  status: 'Scheduled' | 'Sent' | 'Acknowledged' | 'Skipped' | 'Missed';
  timestamp: Timestamp;
  acknowledged_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Reminder status type
export type ReminderStatus = 'Scheduled' | 'Sent' | 'Acknowledged' | 'Skipped' | 'Missed';

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
  birthdate?: string;
  gender?: 'Male' | 'Female' | 'Other';
  password?: string;
}

export interface CreatePatientRequest extends CreateUserRequest {
  birthdate: string;
  gender: 'Male' | 'Female' | 'Other';
  assigned_caregiver_id?: string;
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

export interface CaregiverAddress {
  province: string;
  city_municipality: string;
  barangay: string;
  street: string;
}

// Account management types (for the new user-centered system)
export interface Account {
  id: string;
  email: string;
  generated_email: string;
  generated_password: string;
  name: string;
  role: 'caregiver' | 'patient';
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
