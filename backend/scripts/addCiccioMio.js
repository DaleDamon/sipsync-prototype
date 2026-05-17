// One-off script: add Ciccio Mio to Firestore
// Run: node scripts/addCiccioMio.js
require('dotenv').config();
const { db } = require('../firebase');

async function addRestaurant() {
  const name = 'Ciccio Mio';
  const address = {
    street: '226 W Kinzie Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60654',
    country: 'USA',
  };
  const latitude = 41.8894029;
  const longitude = -87.6351939;

  const restaurantData = {
    name,
    city: address.city,
    address,
    coordinates: { latitude, longitude, source: 'manual', lastUpdated: new Date().toISOString() },
    latitude,
    longitude,
    neighborhood: 'River North',
    contact: { phone: '(312) 796-3316' },
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
