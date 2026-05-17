const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { wines: null, fetchedAt: null };

function isFresh() {
  return cache.fetchedAt && (Date.now() - cache.fetchedAt) < CACHE_TTL_MS;
}

async function getWineCache(db) {
  if (isFresh()) return cache;

  const [winesSnap, restaurantsSnap] = await Promise.all([
    db.collectionGroup('wines').select(
      'producer', 'varietal', 'region', 'year', 'name',
      'type', 'price', 'glassPrice', 'acidity', 'tannins',
      'bodyWeight', 'sweetnessLevel', 'flavorProfile', 'inventoryStatus', 'flagCount'
    ).get(),
    db.collection('restaurants').select('name', 'city').get(),
  ]);

  const restaurantMap = {};
  restaurantsSnap.forEach(doc => {
    restaurantMap[doc.id] = {
      name: doc.data().name || 'Unnamed Restaurant',
      city: doc.data().city || '',
    };
  });

  const wines = [];
  winesSnap.forEach(doc => {
    const restaurantId = doc.ref.parent.parent.id;
    const restaurant = restaurantMap[restaurantId] || { name: 'Unknown', city: '' };
    wines.push({
      wineId: doc.id,
      restaurantId,
      restaurantName: restaurant.name,
      restaurantCity: restaurant.city,
      ...doc.data(),
    });
  });

  cache.wines = wines;
  cache.fetchedAt = Date.now();
  console.log(`[wineCache] Refreshed — ${wines.length} wines across ${Object.keys(restaurantMap).length} restaurants`);

  return cache;
}

function invalidateWineCache() {
  cache.fetchedAt = null;
  console.log('[wineCache] Invalidated');
}

module.exports = { getWineCache, invalidateWineCache };
