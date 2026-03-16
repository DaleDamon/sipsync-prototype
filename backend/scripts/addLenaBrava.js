/**
 * Script to add Leña Brava Chicago to the database
 *
 * Usage: node scripts/addLenaBrava.js
 */

const geocoding = require('../services/geocoding');
const QRCode = require('qrcode');
require('dotenv').config();

// Use existing Firebase initialization
const { db } = require('../firebase');

const restaurantData = {
  name: 'Leña Brava',
  address: {
    street: '900 W Randolph St',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60607',
    country: 'USA',
    neighborhood: 'West Loop'
  },
  contact: {
    phone: '+1 (312) 733-1975',
    website: 'https://www.lenabrava.com/'
  }
};

async function addLenaBrava() {
  console.log('\n========================================');
  console.log('Adding Leña Brava Chicago to Database');
  console.log('========================================\n');

  try {
    // Check if Leña Brava already exists
    const existingSnapshot = await db.collection('restaurants')
      .where('name', '==', restaurantData.name)
      .get();

    if (!existingSnapshot.empty) {
      console.log('⚠ Leña Brava already exists in the database');
      console.log('Existing restaurant ID:', existingSnapshot.docs[0].id);
      process.exit(0);
    }

    console.log('→ Geocoding address...');
    console.log(`  ${restaurantData.address.street}, ${restaurantData.address.city}, ${restaurantData.address.state} ${restaurantData.address.zipCode}`);

    // Geocode address
    const coords = await geocoding.geocodeAddress(restaurantData.address);

    console.log('✓ Geocoded successfully:');
    console.log(`  Coordinates: lat=${coords.latitude}, lng=${coords.longitude}`);
    console.log(`  Accuracy: ${coords.accuracy}`);
    console.log(`  Formatted: ${coords.formattedAddress}\n`);

    // Create restaurant document
    const fullRestaurantData = {
      name: restaurantData.name,
      city: restaurantData.address.city,
      address: restaurantData.address,
      coordinates: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        source: process.env.GEOCODING_PROVIDER || 'google',
        lastUpdated: new Date().toISOString()
      },
      contact: restaurantData.contact,
      // Backward compatibility
      latitude: coords.latitude,
      longitude: coords.longitude,
      location: {},
      wineList: [],
      menu: [],
      createdAt: new Date()
    };

    console.log('→ Creating restaurant document...');
    const restaurantRef = await db.collection('restaurants').add(fullRestaurantData);
    const restaurantId = restaurantRef.id;

    // Generate QR code
    const baseUrl = process.env.SIPSYNC_BASE_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/restaurant/${restaurantId}`;
    await QRCode.toDataURL(qrUrl);

    await restaurantRef.update({ qrCodeUrl: qrUrl });

    console.log('✓ Restaurant created successfully!');
    console.log(`  Restaurant ID: ${restaurantId}`);
    console.log(`  QR Code URL: ${qrUrl}`);

    console.log('\n========================================');
    console.log('Leña Brava Added Successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('✗ Error adding Leña Brava:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run script
addLenaBrava();
