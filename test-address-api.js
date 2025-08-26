// Simple test file to verify PSGC API functionality
// Run this with: node test-address-api.js

import { addressService } from './src/services/address.js';

async function testAddressAPI() {
  console.log('🧪 Testing PSGC Address API...\n');

  try {
    // Test 1: Get provinces
    console.log('1️⃣ Testing getProvinces()...');
    const provinces = await addressService.getProvinces();
    console.log(`✅ Found ${provinces.length} provinces:`, provinces.map(p => p.name));
    
    if (provinces.length === 0) {
      console.log('❌ No provinces found!');
      return;
    }

    // Test 2: Get cities for the first province (should be Bulacan or Pampanga)
    const firstProvince = provinces[0];
    console.log(`\n2️⃣ Testing getCitiesByProvince() for ${firstProvince.name}...`);
    const cities = await addressService.getCitiesByProvince(firstProvince.code);
    console.log(`✅ Found ${cities.length} cities:`, cities.map(c => c.name));

    if (cities.length === 0) {
      console.log('❌ No cities found!');
      return;
    }

    // Test 3: Get barangays for the first city
    const firstCity = cities[0];
    console.log(`\n3️⃣ Testing getBarangaysByCity() for ${firstCity.name}...`);
    const barangays = await addressService.getBarangaysByCity(firstCity.code);
    console.log(`✅ Found ${barangays.length} barangays:`, barangays.slice(0, 5).map(b => b.name), '...');

    // Test 4: Build full address
    if (barangays.length > 0) {
      const firstBarangay = barangays[0];
      console.log(`\n4️⃣ Testing getFullAddress()...`);
      const fullAddress = await addressService.getFullAddress(
        firstProvince.code, 
        firstCity.code, 
        firstBarangay.code, 
        '123 Sample Street'
      );
      console.log(`✅ Full address: ${fullAddress}`);
    }

    console.log('\n🎉 All tests passed! PSGC API is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testAddressAPI();
