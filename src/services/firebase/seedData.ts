import { 
  addPatient, 
  addCaregiver, 
  addMedication, 
  addMedicalHistory, 
  addCaregiverShift, 
  generateMedicationReminders 
} from './index';
import { 
  Patient, 
  Caregiver, 
  Medication, 
  MedicalHistory, 
  CaregiverShift 
} from '@/types';

// Sample patients data
const samplePatients: Omit<Patient, 'patient_id'>[] = [
  {
    first_name: 'Margaret',
    last_name: 'Johnson',
    birthdate: '1935-03-15',
    gender: 'Female',
    contact_number: '+1 (555) 123-4567',
    address: '123 Elm Street, Springfield, IL 62701',
    assigned_caregiver_id: '', // Will be set after caregivers are created
    is_active: true,
    created_at: '',
    updated_at: ''
  },
  {
    first_name: 'Robert',
    last_name: 'Williams',
    birthdate: '1940-07-22',
    gender: 'Male',
    contact_number: '+1 (555) 234-5678',
    address: '456 Oak Avenue, Springfield, IL 62702',
    assigned_caregiver_id: '', // Will be set after caregivers are created
    is_active: true,
    created_at: '',
    updated_at: ''
  },
  {
    first_name: 'Dorothy',
    last_name: 'Brown',
    birthdate: '1938-11-08',
    gender: 'Female',
    contact_number: '+1 (555) 345-6789',
    address: '789 Pine Road, Springfield, IL 62703',
    assigned_caregiver_id: '', // Will be set after caregivers are created
    is_active: true,
    created_at: '',
    updated_at: ''
  }
];

// Sample caregivers data
const sampleCaregivers: Omit<Caregiver, 'caregiver_id'>[] = [
  {
    first_name: 'Sarah',
    last_name: 'Davis',
    email: 'sarah.davis@elderflowcare.com',
    contact_number: '+1 (555) 111-2222',
    shift_type: 'Day',
    role: 'nurse',
    specialization: 'Geriatric Care',
    hire_date: '2020-01-15',
    status: 'Active',
    created_at: '',
    updated_at: ''
  },
  {
    first_name: 'Michael',
    last_name: 'Wilson',
    email: 'michael.wilson@elderflowcare.com',
    contact_number: '+1 (555) 222-3333',
    shift_type: 'Night',
    role: 'nurse',
    specialization: 'Medication Management',
    hire_date: '2019-06-20',
    status: 'Active',
    created_at: '',
    updated_at: ''
  },
  {
    first_name: 'Lisa',
    last_name: 'Thompson',
    email: 'lisa.thompson@elderflowcare.com',
    contact_number: '+1 (555) 333-4444',
    shift_type: 'Rotating',
    role: 'caregiver',
    specialization: 'Physical Therapy Assistant',
    hire_date: '2021-03-10',
    status: 'Active',
    created_at: '',
    updated_at: ''
  }
];

// Function to create sample patients
export const createSamplePatients = async (): Promise<string[]> => {
  console.log('Creating sample patients...');
  const patientIds: string[] = [];
  
  for (const patient of samplePatients) {
    try {
      const patientId = await addPatient(patient);
      patientIds.push(patientId);
      console.log(`✅ Created patient: ${patient.first_name} ${patient.last_name}`);
    } catch (error) {
      console.error(`❌ Error creating patient ${patient.first_name} ${patient.last_name}:`, error);
    }
  }
  
  return patientIds;
};

// Function to create sample caregivers
export const createSampleCaregivers = async (): Promise<string[]> => {
  console.log('Creating sample caregivers...');
  const caregiverIds: string[] = [];
  
  for (const caregiver of sampleCaregivers) {
    try {
      const caregiverId = await addCaregiver(caregiver);
      caregiverIds.push(caregiverId);
      console.log(`✅ Created caregiver: ${caregiver.first_name} ${caregiver.last_name}`);
    } catch (error) {
      console.error(`❌ Error creating caregiver ${caregiver.first_name} ${caregiver.last_name}:`, error);
    }
  }
  
  return caregiverIds;
};

// Function to create sample medications
export const createSampleMedications = async (patientIds: string[]): Promise<string[]> => {
  console.log('Creating sample medications...');
  const medicationIds: string[] = [];
  
  const sampleMedications: Omit<Medication, 'medication_id'>[] = [
    {
      patient_id: patientIds[0],
      medication_name: 'Lisinopril',
      dosage: '10mg',
      frequency: 'Once daily',
      time_of_day: 'Morning',
      start_date: '2024-01-01',
      notes: 'For blood pressure management',
      is_active: true,
      created_at: '',
      updated_at: ''
    },
    {
      patient_id: patientIds[0],
      medication_name: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      time_of_day: 'Morning',
      start_date: '2024-01-01',
      notes: 'For diabetes management',
      is_active: true,
      created_at: '',
      updated_at: ''
    },
    {
      patient_id: patientIds[1],
      medication_name: 'Atorvastatin',
      dosage: '20mg',
      frequency: 'Once daily',
      time_of_day: 'Evening',
      start_date: '2024-01-15',
      notes: 'For cholesterol management',
      is_active: true,
      created_at: '',
      updated_at: ''
    },
    {
      patient_id: patientIds[2],
      medication_name: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Once daily',
      time_of_day: 'Morning',
      start_date: '2024-02-01',
      notes: 'For blood pressure',
      is_active: true,
      created_at: '',
      updated_at: ''
    }
  ];
  
  for (const medication of sampleMedications) {
    try {
      const medicationId = await addMedication(medication);
      medicationIds.push(medicationId);
      console.log(`✅ Created medication: ${medication.medication_name} for patient`);
    } catch (error) {
      console.error(`❌ Error creating medication ${medication.medication_name}:`, error);
    }
  }
  
  return medicationIds;
};

// Function to create sample medical history
export const createSampleMedicalHistory = async (patientIds: string[]): Promise<string[]> => {
  console.log('Creating sample medical history...');
  const historyIds: string[] = [];
  
  const sampleMedicalHistory: Omit<MedicalHistory, 'history_id'>[] = [
    {
      patient_id: patientIds[0],
      condition: 'Hypertension',
      description: 'High blood pressure diagnosed during routine checkup',
      date_diagnosed: '2020-05-15',
      treatment: 'Medication management and lifestyle changes',
      created_at: '',
      updated_at: ''
    },
    {
      patient_id: patientIds[0],
      condition: 'Type 2 Diabetes',
      description: 'Elevated blood glucose levels',
      date_diagnosed: '2021-02-10',
      treatment: 'Metformin and dietary modifications',
      created_at: '',
      updated_at: ''
    },
    {
      patient_id: patientIds[1],
      condition: 'High Cholesterol',
      description: 'Elevated LDL cholesterol levels',
      date_diagnosed: '2019-08-20',
      treatment: 'Statin therapy and diet changes',
      created_at: '',
      updated_at: ''
    },
    {
      patient_id: patientIds[2],
      condition: 'Osteoarthritis',
      description: 'Joint pain and stiffness in knees',
      date_diagnosed: '2018-11-30',
      treatment: 'Physical therapy and pain management',
      created_at: '',
      updated_at: ''
    }
  ];
  
  for (const history of sampleMedicalHistory) {
    try {
      const historyId = await addMedicalHistory(history);
      historyIds.push(historyId);
      console.log(`✅ Created medical history: ${history.condition}`);
    } catch (error) {
      console.error(`❌ Error creating medical history ${history.condition}:`, error);
    }
  }
  
  return historyIds;
};

// Function to create sample caregiver shifts
export const createSampleShifts = async (caregiverIds: string[]): Promise<string[]> => {
  console.log('Creating sample caregiver shifts...');
  const shiftIds: string[] = [];
  
  // Create shifts for the next 7 days
  const today = new Date();
  const shifts: Omit<CaregiverShift, 'shift_id'>[] = [];
  
  for (let i = 0; i < 7; i++) {
    const shiftDate = new Date(today);
    shiftDate.setDate(today.getDate() + i);
    const dateString = shiftDate.toISOString().split('T')[0];
    
    // Day shift
    shifts.push({
      caregiver_id: caregiverIds[0], // Sarah Davis
      shift_date: dateString,
      shift_type: 'Day',
      start_time: '08:00',
      end_time: '16:00',
      notes: 'Day shift coverage',
      created_at: '',
      updated_at: ''
    });
    
    // Night shift
    shifts.push({
      caregiver_id: caregiverIds[1], // Michael Wilson
      shift_date: dateString,
      shift_type: 'Night',
      start_time: '20:00',
      end_time: '08:00',
      notes: 'Night shift coverage',
      created_at: '',
      updated_at: ''
    });
  }
  
  for (const shift of shifts) {
    try {
      const shiftId = await addCaregiverShift(shift);
      shiftIds.push(shiftId);
      console.log(`✅ Created shift: ${shift.shift_type} shift for ${shift.shift_date}`);
    } catch (error) {
      console.error(`❌ Error creating shift:`, error);
    }
  }
  
  return shiftIds;
};

// Main function to seed all sample data
export const seedDatabase = async (): Promise<void> => {
  try {
    console.log('🌱 Starting database seeding...');
    
    // Create caregivers first
    const caregiverIds = await createSampleCaregivers();
    
    // Create patients
    const patientIds = await createSamplePatients();
    
    // Create medications
    const medicationIds = await createSampleMedications(patientIds);
    
    // Create medical history
    const historyIds = await createSampleMedicalHistory(patientIds);
    
    // Create caregiver shifts
    const shiftIds = await createSampleShifts(caregiverIds);
    
    // Generate some medication reminders
    console.log('Creating medication reminders...');
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
    const endDateString = endDate.toISOString().split('T')[0];
    
    for (let i = 0; i < Math.min(medicationIds.length, 2); i++) {
      try {
        await generateMedicationReminders(
          medicationIds[i],
          patientIds[i % patientIds.length],
          startDate,
          endDateString,
          'Once daily',
          'Morning'
        );
        console.log(`✅ Created reminders for medication ${i + 1}`);
      } catch (error) {
        console.error(`❌ Error creating reminders for medication ${i + 1}:`, error);
      }
    }
    
    console.log('🎉 Database seeding completed successfully!');
    console.log(`📊 Created:
    - ${caregiverIds.length} caregivers
    - ${patientIds.length} patients  
    - ${medicationIds.length} medications
    - ${historyIds.length} medical history records
    - ${shiftIds.length} caregiver shifts
    - Medication reminders for next 7 days`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};
