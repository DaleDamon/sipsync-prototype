// One-off script: add Terrace 16 to Firestore
// Run: node scripts/addTerrace16.js
require('dotenv').config();
const { db } = require('../firebase');

async function addRestaurant() {
  const name = 'Terrace 16';
  const address = {
    street: '401 N Wabash Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60611',
    country: 'USA',
  };
  const latitude = 41.8884;
  const longitude = -87.6265;

  const restaurantData = {
    name,
    city: address.city,
    address,
    coordinates: { latitude, longitude, source: 'manual', lastUpdated: new Date().toISOString() },
    latitude,
    longitude,
    neighborhood: 'Streeterville',
    contact: { phone: '(312) 588-8030' },
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
