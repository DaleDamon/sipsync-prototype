const { db } = require('../firebase');

// True duplicates: same wine, same price — keep first ID, delete second ID
// Identified by findDuplicateWines.js
const TO_DELETE = [
  // The Gage — Vadin Plateau Blanc de Noirs Champagne ($300 both)
  { restaurant: 'The Gage',   wineId: 'aDLt5cCqapl4N57FniOl' },
  // Fora — Erste + Neue Riesling ($60 both)
  { restaurant: 'Fora',       wineId: 'z3o3BxZo8u6PYcBLLVwi' },
  // Kinzie Chophouse — 2019 Silver Oak Cabernet Sauvignon ($450 both)
  { restaurant: 'Kinzie',     wineId: 'zrJljoi9jUuCXyu7ReGB'  },
  // Kinzie Chophouse — Overture by Opus One ($380 both)
  { restaurant: 'Kinzie',     wineId: 'khLQofIIE3eXa1ZPl1Em'  },
];

async function removeDuplicates() {
  const restaurantsSnapshot = await db.collection('restaurants').get();

  // Build a map of wineId -> restaurantId by searching all restaurants
  const wineToRestaurant = {};
  for (const doc of restaurantsSnapshot.docs) {
    const winesSnapshot = await db
      .collection('restaurants').doc(doc.id)
      .collection('wines').get();
    winesSnapshot.forEach(w => { wineToRestaurant[w.id] = doc.id; });
  }

  for (const { restaurant, wineId } of TO_DELETE) {
    const restaurantId = wineToRestaurant[wineId];
    if (!restaurantId) {
      console.log(`SKIP — could not find restaurant for wine ${wineId} (${restaurant})`);
      continue;
    }
    await db.collection('restaurants').doc(restaurantId)
      .collection('wines').doc(wineId).delete();
    console.log(`DELETED — ${restaurant}: wine ${wineId}`);
  }

  console.log('\nDone.');
  process.exit(0);
}

removeDuplicates().catch(err => { console.error(err); process.exit(1); });
