// One-off script: add Chicago Oyster House to Firestore
// Run: node scripts/addChicagoOysterHouse.js
require('dotenv').config();
const { db } = require('../firebase');

async function addRestaurant() {
  const name = 'Chicago Oyster House';
  const address = {
    street: '1933 S Indiana Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60616',
    country: 'USA',
  };
  const latitude = 41.8563;
  const longitude = -87.6226;

  const restaurantData = {
    name,
    city: address.city,
    address,
    coordinates: { latitude, longitude, source: 'manual', lastUpdated: new Date().toISOString() },
    latitude,
    longitude,
    neighborhood: 'South Loop',
    contact: { phone: '(312) 225-8833' },
    location: {},
    wineList: [],
    menu: [],
    wineCount: 0,
    createdAt: new Date(),
  };

  const ref = await db.collection('restaurants').add(restaurantData);
  const restaurantId = ref.id;

  const baseUrl = process.env.SIPSYNC_BASE_URL || 'https://sipsync.onrender.com';
  const qrUrl = `${baseUrl}/restaurant/${restaurantId}`;
  await ref.update({ qrCodeUrl: qrUrl });

  console.log(`✓ Created: ${name}`);
  console.log(`  ID: ${restaurantId}`);
  console.log(`  Address: ${address.street}, ${address.city}, ${address.state} ${address.zipCode}`);
  console.log(`  Coords: ${latitude}, ${longitude}`);
  console.log(`  QR URL: ${qrUrl}`);
}

addRestaurant().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
