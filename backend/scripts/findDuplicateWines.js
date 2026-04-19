const { db } = require('../firebase');

function getKey(wine) {
  const year = (wine.year || '').trim().toLowerCase();
  const producer = (wine.producer || '').trim().toLowerCase();
  const varietal = (wine.varietal || '').trim().toLowerCase();
  const region = (wine.region || '').trim().toLowerCase();
  return `${year}|${producer}|${varietal}|${region}`;
}

function displayName(wine) {
  const parts = [];
  if (wine.year && wine.year.trim()) parts.push(wine.year.trim());
  if (wine.producer && wine.producer.trim()) parts.push(wine.producer.trim());
  if (wine.varietal && wine.varietal.trim()) parts.push(wine.varietal.trim());
  return parts.join(' ') || wine.name || '(unnamed)';
}

async function findDuplicates() {
  const restaurantsSnapshot = await db.collection('restaurants').get();
  let totalDuplicateGroups = 0;

  for (const restaurantDoc of restaurantsSnapshot.docs) {
    const restaurantName = restaurantDoc.data().name || restaurantDoc.id;
    const winesSnapshot = await db
      .collection('restaurants')
      .doc(restaurantDoc.id)
      .collection('wines')
      .get();

    const seen = {};
    winesSnapshot.forEach(doc => {
      const wine = { id: doc.id, ...doc.data() };
      const key = getKey(wine);
      if (!seen[key]) seen[key] = [];
      seen[key].push(wine);
    });

    const duplicates = Object.values(seen).filter(group => group.length > 1);
    if (duplicates.length > 0) {
      console.log(`\n── ${restaurantName} (${duplicates.length} duplicate group${duplicates.length > 1 ? 's' : ''}) ──`);
      duplicates.forEach(group => {
        console.log(`  "${displayName(group[0])}" — ${group.length} copies`);
        group.forEach(w => console.log(`    id: ${w.id}  price: $${w.price || '?'}  type: ${w.type || '?'}`));
      });
      totalDuplicateGroups += duplicates.length;
    }
  }

  if (totalDuplicateGroups === 0) {
    console.log('\nNo duplicates found across any restaurant.');
  } else {
    console.log(`\nTotal: ${totalDuplicateGroups} duplicate group(s) found.`);
  }
  process.exit(0);
}

findDuplicates().catch(err => { console.error(err); process.exit(1); });
