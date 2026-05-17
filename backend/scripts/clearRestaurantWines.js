require('dotenv').config();
const { db } = require('../firebase');

async function main() {
  const restaurantId = process.argv[2];
  if (!restaurantId) { console.error('Usage: node scripts/clearRestaurantWines.js <restaurantId>'); process.exit(1); }
  const snap = await db.collection('restaurants').doc(restaurantId).collection('wines').get();
  if (snap.empty) { console.log('No wines to delete.'); return; }
  const batch = db.batch();
  snap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  await db.collection('restaurants').doc(restaurantId).update({ wineCount: 0, wineList: [] });
  console.log(`✓ Deleted ${snap.size} wines from restaurant ${restaurantId}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
