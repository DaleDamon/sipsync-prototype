// One-off script: add Rose Mary to Firestore
// Run: node scripts/addRoseMary.js
require('dotenv').config();
const { db } = require('../firebase');

async function addRestaurant() {
  const name = 'Rose Mary';
  const address = {
    street: '932 W Fulton Market',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60607',
    country: 'USA',
  };
  const latitude = 41.8869756;
  const longitude = -87.6511811;

  const restaurantData = {
    name,
    city: address.city,
    address,
    coordinates: { latitude, longitude, source: 'manual', lastUpdated: new Date().toISOString() },
    latitude,
    longitude,
    neighborhood: 'Fulton Market',
    contact: { phone: '(872) 260-3921' },
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
