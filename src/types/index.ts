// TypeScript interfaces based on ERD

export interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: 'Male' | 'Female' | 'Other';
  contact_number: string;
  address: string;
  assigned_caregiver_id?: string;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export interface Caregiver {
  caregiver_id: string;
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
  shift_type: 'Day' | 'Night' | 'Rotating' | 'On-call';
  shift_start_date?: any; // Firebase Timestamp
  shift_end_date?: any; // Firebase Timestamp
  role: 'nurse' | 'caregiver' | 'admin' | 'doctor' | 'family';
  specialization?: string;
  hire_date: string;
  status: 'Active' | 'Inactive';
  created_at: any; // Firebase Timestamp
  updated_at: any; // Firebase Timestamp
}

export interface CaregiverShift {
  shift_id: string;
  caregiver_id: string;
  shift_date: string;
  shift_type: 'Day' | 'Night';
  start_time: string;
  end_time: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ReminderLog {
  reminder_id: string;
  medication_id: string;
  patient_id: string;
  scheduled_time: string;
  status: 'Scheduled' | 'Sent' | 'Acknowledged' | 'Skipped' | 'Missed';
  timestamp: string;
  acknowledged_by?: string; // Caregiver ID who acknowledged
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Additional utility types
export type ShiftType = 'Day' | 'Night' | 'Rotating' | 'On-call';
export type PatientGender = 'Male' | 'Female' | 'Other';
export type ReminderStatus = 'Scheduled' | 'Sent' | 'Acknowledged' | 'Skipped' | 'Missed';
export type CaregiverStatus = 'Active' | 'Inactive';
export type CaregiverRole = 'nurse' | 'caregiver' | 'admin' | 'doctor' | 'family';
export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night' | 'As needed';

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