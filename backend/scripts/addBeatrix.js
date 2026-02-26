/**
 * Script to add Beatrix River North to the database
 *
 * Usage: node scripts/addBeatrix.js
 */

const geocoding = require('../services/geocoding');
const QRCode = require('qrcode');
require('dotenv').config();

// Use existing Firebase initialization
const { db } = require('../firebase');

const beatrixData = {
  name: 'Beatrix',
  address: {
    street: '519 N Clark St',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60654',
    country: 'USA',
    neighborhood: 'River North'
  },
  contact: {
    phone: '+1 (312) 284-1377',
    website: 'https://www.beatrixrestaurants.com/beatrix/river-north/'
  }
};

async function addBeatrix() {
  console.log('\n========================================');
  console.log('Adding Beatrix to Database');
  console.log('========================================\n');

  try {
    // Check if Beatrix already exists
    const existingSnapshot = await db.collection('restaurants')
      .where('name', '==', beatrixData.name)
      .get();

    if (!existingSnapshot.empty) {
      console.log('⚠ Beatrix already exists in the database');
      console.log('Existing restaurant ID:', existingSnapshot.docs[0].id);
      process.exit(0);
    }

    console.log('→ Geocoding address...');
    console.log(`  ${beatrixData.address.street}, ${beatrixData.address.city}, ${beatrixData.address.state} ${beatrixData.address.zipCode}`);

    // Geocode address
    const coords = await geocoding.geocodeAddress(beatrixData.address);

    console.log('✓ Geocoded successfully:');
    console.log(`  Coordinates: lat=${coords.latitude}, lng=${coords.longitude}`);
    console.log(`  Accuracy: ${coords.accuracy}`);
    console.log(`  Formatted: ${coords.formattedAddress}\n`);

    // Create restaurant document
    const restaurantData = {
      name: beatrixData.name,
      city: beatrixData.address.city,
      address: beatrixData.address,
      coordinates: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        source: process.env.GEOCODING_PROVIDER || 'google',
        lastUpdated: new Date().toISOString()
      },
      contact: beatrixData.contact,
      // Backward compatibility
      latitude: coords.latitude,
      longitude: coords.longitude,
      location: {},
      wineList: [],
      menu: [],
      createdAt: new Date()
    };

    console.log('→ Creating restaurant document...');
    const restaurantRef = await db.collection('restaurants').add(restaurantData);
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
    console.log('Beatrix Added Successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('✗ Error adding Beatrix:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run script
addBeatrix();
