const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// GET /api/analytics/popular-wines
// Get the most matched wines across all restaurants
router.get('/popular-wines', async (req, res) => {
  try {
    const restaurantsSnapshot = await db.collection('restaurants').get();
    const wineMatchCount = {};
    const wineDetails = {};

    // Iterate through all restaurants and count wine matches
    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const winesSnapshot = await db
        .collection('restaurants')
        .doc(restaurantDoc.id)
        .collection('wines')
        .get();

      winesSnapshot.forEach((wineDoc) => {
        const wine = wineDoc.data();
        const wineId = wineDoc.id;
        const key = `${wine.name}-${wine.type}`;

        if (!wineMatchCount[key]) {
          wineMatchCount[key] = {
            count: 0,
            wineId,
            restaurantId: restaurantDoc.id,
            details: wine,
          };
        }
        wineMatchCount[key].count += 1;
      });
    }

    // Sort by match count and return top 10
    const popularWines = Object.values(wineMatchCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((wine) => ({
        wineId: wine.wineId,
        name: wine.details.name,
        type: wine.details.type,
        price: wine.details.price,
        matchCount: wine.count,
        flavorProfile: wine.details.flavorProfile,
      }));

    res.json({
      popularWines,
      totalCount: popularWines.length,
    });
  } catch (error) {
    console.error('Error getting popular wines:', error);
    res.status(500).json({ error: 'Failed to get popular wines' });
  }
});

// GET /api/analytics/top-pairings
// Get the highest-scoring food and wine pairings
router.get('/top-pairings', async (req, res) => {
  try {
    const restaurantsSnapshot = await db.collection('restaurants').get();
    const allPairings = [];

    // Iterate through all restaurants and collect pairings
    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const pairingsSnapshot = await db
        .collection('restaurants')
        .doc(restaurantDoc.id)
        .collection('pairings')
        .get();

      for (const pairingDoc of pairingsSnapshot.docs) {
        const pairing = pairingDoc.data();

        // Fetch wine details
        const wineDoc = await db
          .collection('restaurants')
          .doc(restaurantDoc.id)
          .collection('wines')
          .doc(pairing.wineId)
          .get();

        // Fetch food item details
        const foodDoc = await db
          .collection('restaurants')
          .doc(restaurantDoc.id)
          .collection('foodItems')
          .doc(pairing.foodItemId)
          .get();

        if (wineDoc.exists && foodDoc.exists) {
          allPairings.push({
            pairingId: pairingDoc.id,
            pairingScore: pairing.pairingScore || 0,
            pairingReason: pairing.pairingReason,
            wine: {
              name: wineDoc.data().name,
              type: wineDoc.data().type,
              price: wineDoc.data().price,
            },
            foodItem: {
              name: foodDoc.data().name,
              description: foodDoc.data().description,
            },
          });
        }
      }
    }

    // Sort by pairing score and return top 10
    const topPairings = allPairings
      .sort((a, b) => b.pairingScore - a.pairingScore)
      .slice(0, 10);

    res.json({
      topPairings,
      totalCount: topPairings.length,
    });
  } catch (error) {
    console.error('Error getting top pairings:', error);
    res.status(500).json({ error: 'Failed to get top pairings' });
  }
});

// GET /api/analytics/restaurant-stats
// Get overall restaurant and wine statistics
router.get('/restaurant-stats', async (req, res) => {
  try {
    const restaurantsSnapshot = await db.collection('restaurants').get();
    const stats = {
      totalRestaurants: 0,
      totalWines: 0,
      totalFoodItems: 0,
      cities: new Set(),
      winesByType: { red: 0, white: 0, rosé: 0, sparkling: 0, other: 0 },
    };

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurant = restaurantDoc.data();
      stats.totalRestaurants += 1;

      if (restaurant.city) {
        stats.cities.add(restaurant.city);
      }

      // Count wines
      const winesSnapshot = await db
        .collection('restaurants')
        .doc(restaurantDoc.id)
        .collection('wines')
        .get();

      winesSnapshot.forEach((wineDoc) => {
        stats.totalWines += 1;
        const wineType = wineDoc.data().type || 'other';
        if (wineType in stats.winesByType) {
          stats.winesByType[wineType] += 1;
        } else {
          stats.winesByType['other'] += 1;
        }
      });

      // Count food items
      const foodSnapshot = await db
        .collection('restaurants')
        .doc(restaurantDoc.id)
        .collection('foodItems')
        .get();

      stats.totalFoodItems += foodSnapshot.size;
    }

    res.json({
      totalRestaurants: stats.totalRestaurants,
      totalWines: stats.totalWines,
      totalFoodItems: stats.totalFoodItems,
      totalCities: stats.cities.size,
      cities: Array.from(stats.cities),
      winesByType: stats.winesByType,
    });
  } catch (error) {
    console.error('Error getting restaurant stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/analytics/preference-trends
// Get the most common user preference patterns
router.get('/preference-trends', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const trends = {
      acidity: { low: 0, medium: 0, high: 0 },
      tannins: { low: 0, medium: 0, high: 0 },
      bodyWeight: { light: 0, medium: 0, full: 0 },
      wineTypes: {},
      totalUsers: usersSnapshot.size,
    };

    usersSnapshot.forEach((userDoc) => {
      const user = userDoc.data();
      if (user.savedPreferences && user.savedPreferences.length > 0) {
        const prefs = user.savedPreferences[0];

        if (prefs.acidity && trends.acidity[prefs.acidity] !== undefined) {
          trends.acidity[prefs.acidity] += 1;
        }
        if (prefs.tannins && trends.tannins[prefs.tannins] !== undefined) {
          trends.tannins[prefs.tannins] += 1;
        }
        if (prefs.bodyWeight && trends.bodyWeight[prefs.bodyWeight] !== undefined) {
          trends.bodyWeight[prefs.bodyWeight] += 1;
        }
        if (prefs.wineType && prefs.wineType !== 'any') {
          trends.wineTypes[prefs.wineType] = (trends.wineTypes[prefs.wineType] || 0) + 1;
        }
      }
    });

    res.json({
      trends,
      mostPopularAcidity: Object.entries(trends.acidity).sort((a, b) => b[1] - a[1])[0],
      mostPopularTannins: Object.entries(trends.tannins).sort((a, b) => b[1] - a[1])[0],
      mostPopularBodyWeight: Object.entries(trends.bodyWeight).sort((a, b) => b[1] - a[1])[0],
      mostPopularWineType: Object.entries(trends.wineTypes).sort((a, b) => b[1] - a[1])[0],
    });
  } catch (error) {
    console.error('Error getting preference trends:', error);
    res.status(500).json({ error: 'Failed to get preference trends' });
  }
});

module.exports = router;
