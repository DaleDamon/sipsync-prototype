/**
 * Script to add Avaspi to the database
 *
 * Usage: node scripts/addAvaspi.js
 */

const geocoding = require('../services/geocoding');
const QRCode = require('qrcode');
require('dotenv').config();

const { db } = require('../firebase');

const restaurantData = {
  name: 'Avaspi',
  address: {
    street: '1258 W Belmont Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60657',
    country: 'USA',
    neighborhood: 'Lakeview'
  },
  contact: {
    phone: '+1 (773) 720-1297',
    website: 'https://avaspirestaurant.com/'
  }
};

async function addAvaspi() {
  console.log('\n========================================');
  console.log('Adding Avaspi to Database');
  console.log('========================================\n');

  try {
    const existingSnapshot = await db.collection('restaurants')
      .where('name', '==', restaurantData.name)
      .get();

    if (!existingSnapshot.empty) {
      console.log('⚠ Avaspi already exists in the database');
      console.log('Existing restaurant ID:', existingSnapshot.docs[0].id);
      process.exit(0);
    }

    console.log('→ Geocoding address...');
    console.log(`  ${restaurantData.address.street}, ${restaurantData.address.city}, ${restaurantData.address.state} ${restaurantData.address.zipCode}`);

    const coords = await geocoding.geocodeAddress(restaurantData.address);

    console.log('✓ Geocoded successfully:');
    console.log(`  Coordinates: lat=${coords.latitude}, lng=${coords.longitude}`);
    console.log(`  Accuracy: ${coords.accuracy}`);
    console.log(`  Formatted: ${coords.formattedAddress}\n`);

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

    const baseUrl = process.env.SIPSYNC_BASE_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/restaurant/${restaurantId}`;
    await QRCode.toDataURL(qrUrl);
    await restaurantRef.update({ qrCodeUrl: qrUrl });

    console.log('✓ Restaurant created successfully!');
    console.log(`  Restaurant ID: ${restaurantId}`);
    console.log(`  QR Code URL: ${qrUrl}`);

    console.log('\n========================================');
    console.log('Avaspi Added Successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('✗ Error adding Avaspi:', error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

addAvaspi();
