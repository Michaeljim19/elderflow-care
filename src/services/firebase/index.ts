// Central database service file that exports all Firebase operations
// This provides a single import point for all database operations

// Patient operations
export {
  getPatients,
  getPatient,
  addPatient,
  updatePatient,
  deletePatient,
  getPatientsByCaregiver
} from './patients';

// Medication operations
export {
  getMedications,
  getMedication,
  addMedication,
  updateMedication,
  deleteMedication,
  getMedicationsByPatient
} from './medications';

// Caregiver operations
export {
  getCaregivers,
  getCaregiver,
  addCaregiver,
  updateCaregiver,
  deleteCaregiver
} from './caregivers';

// Medical History operations
export {
  getMedicalHistories,
  getMedicalHistoryByPatient,
  getMedicalHistory,
  addMedicalHistory,
  updateMedicalHistory,
  deleteMedicalHistory,
  getMedicalHistoryByCondition
} from './medicalHistory';

// Caregiver Shifts operations
export {
  getCaregiverShifts,
  getShiftsByCaregiver,
  getShiftsByDateRange,
  getShiftsByCaregiverAndDateRange,
  getCaregiverShift,
  addCaregiverShift,
  updateCaregiverShift,
  deleteCaregiverShift,
  getShiftsByType,
  getCurrentShifts
} from './caregiverShifts';

// Reminder Logs operations
export {
  getReminderLogs,
  getReminderLogsByPatient,
  getReminderLogsByMedication,
  getReminderLogsByStatus,
  getPendingReminders,
  getUpcomingRemindersByPatient,
  getReminderLogsByDateRange,
  getReminderLog,
  addReminderLog,
  updateReminderLog,
  acknowledgeReminder,
  markReminderAsMissed,
  deleteReminderLog,
  generateMedicationReminders
} from './reminderLogs';

// Collections reference
export { COLLECTIONS } from './collections';

// Types
export * from '@/types';
