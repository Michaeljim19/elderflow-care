import { addCaregiver } from "@/services/firebase/caregivers";

// Test caregiver data
const testCaregiver = {
  first_name: "John",
  last_name: "Doe", 
  email: "john.doe@test.com",
  contact_number: "1234567890",
  address: "123 Test Street",
  shift_type: "Day" as const,
  hire_date: new Date().toISOString(),
  license_number: "TEST123",
  specialization: "General Care"
};

// Function to create test caregiver
export const createTestCaregiver = async () => {
  try {
    console.log('Creating test caregiver...');
    const result = await addCaregiver(testCaregiver);
    console.log('Test caregiver created:', result);
    return result;
  } catch (error) {
    console.error('Error creating test caregiver:', error);
    throw error;
  }
};

// Call this function in browser console to create test data:
// createTestCaregiver().then(() => console.log('Done'));
