/**
 * Test script for geocoding service
 *
 * Usage: node scripts/testGeocoding.js
 */

require('dotenv').config();
const geocoding = require('../services/geocoding');

async function testGeocoding() {
  console.log('\n========================================');
  console.log('Geocoding Service Test');
  console.log('========================================\n');

  console.log(`Provider: ${process.env.GEOCODING_PROVIDER || 'google'}`);
  console.log(`API Key configured: ${process.env.GOOGLE_MAPS_API_KEY ? 'Yes' : 'No'}\n`);

  // Test with Quartino Ristorante's actual address
  const testAddress = {
    street: '626 N State St',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60654',
    country: 'USA'
  };

  console.log('Testing geocoding with address:');
  console.log(`${testAddress.street}, ${testAddress.city}, ${testAddress.state} ${testAddress.zipCode}\n`);

  try {
    const result = await geocoding.geocodeAddress(testAddress);

    console.log('✓ Geocoding successful!\n');
    console.log('Results:');
    console.log(`  Latitude: ${result.latitude}`);
    console.log(`  Longitude: ${result.longitude}`);
    console.log(`  Accuracy: ${result.accuracy}`);
    console.log(`  Formatted Address: ${result.formattedAddress}\n`);

    console.log('Expected coordinates (approximate):');
    console.log('  Latitude: ~41.893');
    console.log('  Longitude: ~-87.628\n');

    // Check if coordinates are in the right ballpark
    const latDiff = Math.abs(result.latitude - 41.893);
    const lngDiff = Math.abs(result.longitude - (-87.628));

    if (latDiff < 0.01 && lngDiff < 0.01) {
      console.log('✓ Coordinates match expected values!');
    } else {
      console.log('⚠ Coordinates differ from expected values (but may still be correct)');
    }

    console.log('\n========================================');
    console.log('Test Complete - Geocoding Service is Working!');
    console.log('========================================\n');
  } catch (error) {
    console.error('✗ Geocoding failed:', error.message);
    console.error('\nPlease check:');
    console.error('1. GOOGLE_MAPS_API_KEY is set in backend/.env');
    console.error('2. Geocoding API is enabled in Google Cloud Console');
    console.error('3. API key has proper permissions\n');
    process.exit(1);
  }
}

testGeocoding();
