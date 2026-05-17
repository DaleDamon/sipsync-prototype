require('dotenv').config();
const { db } = require('../firebase');

async function main() {
  const restaurantId = process.argv[2];
  if (!restaurantId) { console.error('Usage: node scripts/listRestaurantWines.js <restaurantId>'); process.exit(1); }
  const snap = await db.collection('restaurants').doc(restaurantId).collection('wines').get();
  console.log(`${snap.size} wines:`);
  snap.forEach(doc => {
    const w = doc.data();
    console.log(`  [${w.type}] ${w.year || ''} ${w.producer} - ${w.varietal}, ${w.region} | glass:${w.glassPrice} bottle:${w.price}`);
  });
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
