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
}

export interface Medication {
  medication_id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  time_of_day: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  start_date: string;
  end_date?: string;
  notes?: string;
}

export interface MedicalHistory {
  history_id: string;
  patient_id: string;
  condition: string;
  description: string;
  date_diagnosed: string;
  treatment: string;
  attachments?: string[]; // Array of file paths
}

export interface Caregiver {
  caregiver_id: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  shift_type: 'Day' | 'Night' | 'Both';
  role?: string;
  status: 'Active' | 'Inactive';
}

export interface CaregiverShift {
  shift_id: string;
  caregiver_id: string;
  shift_date: string;
  shift_type: 'Day' | 'Night';
  start_time: string;
  end_time: string;
}

export interface ReminderLog {
  reminder_id: string;
  medication_id: string;
  patient_id: string;
  scheduled_time: string;
  status: 'Sent' | 'Acknowledged' | 'Skipped' | 'Pending';
  timestamp: string;
}

// Additional utility types
export type ShiftType = 'Day' | 'Night' | 'Both';
export type PatientGender = 'Male' | 'Female' | 'Other';
export type ReminderStatus = 'Sent' | 'Acknowledged' | 'Skipped' | 'Pending';
export type CaregiverStatus = 'Active' | 'Inactive';