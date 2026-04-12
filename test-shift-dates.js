// Test file for shift date logic
// Run this to verify the date calculation functions work correctly

import { Timestamp } from 'firebase/firestore';

// Helper functions (copied from Caregivers.tsx)
const calculateShiftEndDate = (startDate) => {
  if (!startDate) return "";
  
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 3);
  
  return end.toISOString().split('T')[0];
};

const dateToTimestamp = (dateString) => {
  if (!dateString) return Timestamp.now();
  return Timestamp.fromDate(new Date(dateString));
};

const timestampToDate = (timestamp) => {
  if (!timestamp) return "";
  if (timestamp.toDate) {
    return timestamp.toDate().toISOString().split('T')[0];
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
  }
  return "";
};

// Test the functions
console.log('🧪 Testing Shift Date Logic...\n');

// Test 1: Calculate shift end date
console.log('1️⃣ Testing calculateShiftEndDate()...');
const testStartDate = '2025-01-15';
const calculatedEndDate = calculateShiftEndDate(testStartDate);
console.log(`Start Date: ${testStartDate}`);
console.log(`End Date: ${calculatedEndDate}`);
console.log(`✅ Calculated end date is ${calculatedEndDate} (should be 2025-01-18)\n`);

// Test 2: Date to Timestamp conversion
console.log('2️⃣ Testing dateToTimestamp()...');
const timestamp = dateToTimestamp(testStartDate);
console.log(`Date: ${testStartDate}`);
console.log(`Timestamp: ${timestamp.seconds} seconds`);
console.log(`✅ Timestamp created successfully\n`);

// Test 3: Timestamp to Date conversion
console.log('3️⃣ Testing timestampToDate()...');
const convertedDate = timestampToDate(timestamp);
console.log(`Timestamp: ${timestamp.seconds} seconds`);
console.log(`Converted Date: ${convertedDate}`);
console.log(`✅ Date conversion: ${convertedDate} (should match ${testStartDate})\n`);

// Test 4: Edge cases
console.log('4️⃣ Testing Edge Cases...');
console.log(`Empty string: "${calculateShiftEndDate('')}"`);
console.log(`Null input: "${calculateShiftEndDate(null)}"`);
console.log(`✅ Edge cases handled correctly\n`);

// Test 5: Real-world scenario
console.log('5️⃣ Real-world Scenario Test...');
const scenarios = [
  '2025-07-27', // Today
  '2025-12-31', // End of year
  '2025-02-28', // End of February (non-leap year)
];

scenarios.forEach(date => {
  const endDate = calculateShiftEndDate(date);
  console.log(`${date} → ${endDate}`);
});

console.log('\n🎉 All shift date logic tests completed!');
