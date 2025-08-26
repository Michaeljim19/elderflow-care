// TypeScript interfaces based on ERD

export interface Patient {
  patient_id: string;
  user_id?: string; // Firebase Auth UID for linked user account
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: 'Male' | 'Female' | 'Other';
  contact_number: number;
  address: string;
  assigned_caregiver_id?: string; // Keep for backward compatibility
  // New caregiver assignments for day and night shifts
  assigned_day_caregiver_id?: string;
  assigned_night_caregiver_id?: string;
  // Emergency contact information
  emergency_contact_name?: string;
  emergency_contact_phone?: number;
  emergency_contact_relationship?: string;
  guardian_email?: string;
  // Care management
  care_notes?: string;
  medical_conditions?: string;
  mobility_level?: 'Independent' | 'Assisted' | 'Wheelchair' | 'Bedridden';
  // Contract information
  contract_start_date?: string;
  contract_end_date?: string;
  // System fields
  created_at: Timestamp;
  updated_at: Timestamp;
  is_active: boolean;
}

export interface Medication {
  medication_id: string;
  patient_id: string;
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

export interface MedicalHistory {
  history_id: string;
  patient_id: string;
  condition: string;
  description: string;
  date_diagnosed: string;
  treatment: string;
  attachments?: string[]; // Array of file paths
  // Enhanced medical fields
  severity: 'Mild' | 'Moderate' | 'Severe' | 'Critical';
  status: 'Active' | 'Resolved' | 'Chronic' | 'Under Treatment';
  doctor_name?: string;
  hospital_clinic?: string;
  symptoms?: string;
  medications?: string;
  allergies?: string;
  test_results?: string;
  follow_up_date?: string;
  notes?: string;
  vital_signs?: {
    blood_pressure?: string;
    heart_rate?: string;
    temperature?: string;
    weight?: string;
    height?: string;
  };
  family_history?: string;
  lifestyle_factors?: string;
  emergency_contact?: string;
  insurance_info?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Caregiver {
  caregiver_id: string;
  user_id?: string; // Firebase Auth UID for caregiver user account
  first_name: string;
  middle_name?: string;
  last_name: string;
  birthday?: string;
  email: string;
  contact_number: number;
  address?: {
    province: string;
    city_municipality: string;
    barangay: string;
    street: string;
  };
  shift_type: 'Day' | 'Night';
  shift_start_date?: any; // Firebase Timestamp
  shift_end_date?: any; // Firebase Timestamp
  role: 'nurse' | 'caregiver' | 'admin' | 'doctor' | 'family' | 'Eldercare';
  specialization?: string;
  hire_date: string;
  status: 'Active' | 'Inactive';
  assigned_patients_count: number; // Number of currently assigned patients
  max_patients: number; // Maximum patients based on shift type (Day: 2, Night: 4)
  license_number?: string; // License number field
  license_picture?: string; // License picture URL
  // Contract information
  contract_start_date?: Timestamp;
  contract_end_date?: Timestamp;
  temporary_schedule_reason?: string; // Optional field for temporary schedule assignments
  // Original schedule tracking
  original_shift_type?: 'Day' | 'Night'; // Store the caregiver's original/permanent shift type
  original_shift_start_date?: any; // Firebase Timestamp for when original schedule should resume
  original_shift_end_date?: any; // Firebase Timestamp
  created_at: any; // Firebase Timestamp
  updated_at: any; // Firebase Timestamp
}

import { Timestamp } from 'firebase/firestore';

export interface CaregiverShift {
  shift_id: string;
  caregiver_id: string;
  shift_date: Timestamp;
  shift_type: 'Day' | 'Night';
  start_time: Timestamp;
  end_time: Timestamp;
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ReminderLog {
  reminder_id: string;
  medication_id: string;
  patient_id: string;
  scheduled_time: string;
  status: 'Scheduled' | 'Sent' | 'Acknowledged' | 'Skipped' | 'Missed';
  timestamp: Timestamp;
  acknowledged_by?: string; // Caregiver ID who acknowledged
  notes?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Additional utility types
export type ShiftType = 'Day' | 'Night';
export type PatientGender = 'Male' | 'Female' | 'Other';
export type ReminderStatus = 'Scheduled' | 'Sent' | 'Acknowledged' | 'Skipped' | 'Missed';
export type CaregiverStatus = 'Active' | 'Inactive';
export type CaregiverRole = 'nurse' | 'caregiver' | 'admin' | 'doctor' | 'family' | 'Eldercare';
export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'As needed';

// Caregiver patient limits based on shift type
export const CAREGIVER_PATIENT_LIMITS = {
  Day: 2,
  Night: 4
} as const;

// Utility function to get maximum patients for a shift type
export const getMaxPatientsForShift = (shiftType: ShiftType): number => {
  return CAREGIVER_PATIENT_LIMITS[shiftType];
};

// Utility function to check if caregiver can take more patients
export const canCaregiverTakeMorePatients = (caregiver: Caregiver): boolean => {
  return caregiver.assigned_patients_count < caregiver.max_patients;
};

// Utility function to get available patient slots for a caregiver
export const getAvailablePatientSlots = (caregiver: Caregiver): number => {
  return Math.max(0, caregiver.max_patients - caregiver.assigned_patients_count);
};

// Helper interfaces for complex operations
export interface PatientWithCaregiver extends Patient {
  caregiver?: Caregiver;
}

export interface MedicationWithPatient extends Medication {
  patient?: Patient;
}

export interface CaregiverWithShifts extends Caregiver {
  shifts?: CaregiverShift[];
  assigned_patients?: Patient[];
}

// Filter interfaces for database queries
export interface PatientFilters {
  assigned_caregiver_id?: string;
  gender?: PatientGender;
  is_active?: boolean;
  search_term?: string;
}

export interface MedicationFilters {
  patient_id?: string;
  time_of_day?: TimeOfDay;
  is_active?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface CaregiverFilters {
  shift_type?: ShiftType;
  role?: CaregiverRole;
  status?: CaregiverStatus;
  search_term?: string;
}

export interface ReminderFilters {
  patient_id?: string;
  medication_id?: string;
  status?: ReminderStatus;
  date_range?: {
    start: string;
    end: string;
  };
}

// Account interface for account management and verification
export interface Account {
  verification_token?: string;
  id: string;
  email: string; // Contact email (where credentials are sent TO)
  generated_email: string; // System-generated login email  
  generated_password: string; // System-generated login password
  name: string;
  role: 'caregiver' | 'guardian';
  status: 'pending' | 'active' | 'suspended';
  verified: boolean;
  createdAt: Timestamp;
  verifiedAt?: Timestamp | null;
  lastLogin?: Timestamp | null;
  password_changed?: boolean;
  password_changed_at?: Timestamp | null;
  suspended_at?: Timestamp | null;
  suspension_reason?: string | null;
  reactivated_at?: Timestamp | null;
  // verification_code?: string | null // For code-based verification
}

// User interface for Firebase Auth integration
export interface User {
  uid: string; // Firebase Auth UID
  email: string;
  role: 'patient' | 'caregiver' | 'admin';
  user_lvl: 'admin' | 'caregiver' | 'patient'; // User level for permissions
  first_name: string;
  last_name: string;
  patient_id?: string; // Reference to patient record if role is 'patient'
  caregiver_id?: string; // Reference to caregiver record if role is 'caregiver'
  
  // Caregiver-specific fields (when user_lvl is 'caregiver')
  middle_name?: string;
  birthday?: string;
  phone?: string;
  contact_number?: number;
  address?: {
    province: string;
    city_municipality: string;
    barangay: string;
    street: string;
  };
  shift_type?: 'Day' | 'Night';
  shift_start_date?: any; // Firebase Timestamp
  shift_end_date?: any; // Firebase Timestamp
  hire_date?: string;
  status?: 'Active' | 'Inactive';
  assigned_patients_count?: number;
  max_patients?: number;
  specialization?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  date_of_birth?: string;
  license_number?: string;
  license_expiry?: string;
  license_image_base64?: string;
  license_picture?: string;
  specializations?: string[];
  hourly_rate?: number;
  availability?: string[];
  experience_years?: number;
  certifications?: string[];
  languages?: string[];
  notes?: string;
  
  // Contract information
  contract_start_date?: any;
  contract_end_date?: any;
  temporary_schedule_reason?: string;
  original_shift_type?: 'Day' | 'Night';
  original_shift_start_date?: any;
  original_shift_end_date?: any;
  
  created_at: Timestamp;
  updated_at?: Timestamp;
  is_active?: boolean;
}