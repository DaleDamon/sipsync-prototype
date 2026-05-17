// One-off script: add a restaurant directly to Firestore
// Run: node scripts/add-restaurant.js
require('dotenv').config();
const { db } = require('../firebase');
const QRCode = require('qrcode');

async function addRestaurant() {
  const name = 'Steak 48';
  const address = {
    street: '615 N Wabash Ave',
    city: 'Chicago',
    state: 'IL',
    zipCode: '60611',
    country: 'USA',
  };
  const latitude = 41.8926;
  const longitude = -87.6269;

  const restaurantData = {
    name,
    city: address.city,
    address,
    coordinates: { latitude, longitude, source: 'manual', lastUpdated: new Date().toISOString() },
    latitude,
    longitude,
    contact: {},
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

  console.log(`✓ Created: ${name} (${address.city})`);
  console.log(`  ID: ${restaurantId}`);
  console.log(`  QR URL: ${qrUrl}`);
}

addRestaurant().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
