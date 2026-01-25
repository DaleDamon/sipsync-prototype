const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// Helper function to calculate match score between user preferences and wine
function calculateMatchScore(userPreferences, wine) {
  let totalScore = 0;
  let categoryCount = 0;

  // Acidity match
  if (userPreferences.acidity) {
    const acidityMatch = userPreferences.acidity === wine.acidity ? 1 : 0.5;
    totalScore += acidityMatch;
    categoryCount++;
  }

  // Tannins match
  if (userPreferences.tannins) {
    const tanninsMatch = userPreferences.tannins === wine.tannins ? 1 : 0.5;
    totalScore += tanninsMatch;
    categoryCount++;
  }

  // Body weight match
  if (userPreferences.bodyWeight) {
    const bodyMatch = userPreferences.bodyWeight === wine.bodyWeight ? 1 : 0.5;
    totalScore += bodyMatch;
    categoryCount++;
  }

  // Flavor profile match
  if (userPreferences.flavorNotes && userPreferences.flavorNotes.length > 0) {
    const matchedFlavors = userPreferences.flavorNotes.filter((flavor) =>
      wine.flavorProfile.includes(flavor)
    );
    const flavorMatch = matchedFlavors.length / userPreferences.flavorNotes.length;
    totalScore += flavorMatch;
    categoryCount++;
  }

  // Sweetness match
  if (userPreferences.sweetness) {
    const sweetnessMatch = userPreferences.sweetness === wine.sweetnessLevel ? 1 : 0.5;
    totalScore += sweetnessMatch;
    categoryCount++;
  }

  // Price match
  if (userPreferences.priceRange) {
    const { min, max } = userPreferences.priceRange;
    const priceMatch = wine.price >= min && wine.price <= max ? 1 : 0.5;
    totalScore += priceMatch;
    categoryCount++;
  }

  // Wine type match
  if (userPreferences.wineType && userPreferences.wineType !== 'any') {
    const typeMatch = userPreferences.wineType === wine.type ? 1 : 0;
    totalScore += typeMatch;
    categoryCount++;
  }

  return categoryCount > 0 ? totalScore / categoryCount : 0;
}

// POST /api/pairings/find
// Find wine matches based on user preferences
router.post('/find', async (req, res) => {
  try {
    const { restaurantId, userPreferences } = req.body;

    if (!restaurantId || !userPreferences) {
      return res.status(400).json({ error: 'Restaurant ID and preferences are required' });
    }

    // Get all wines for the restaurant
    const winesSnapshot = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('wines')
      .get();

    const wines = [];
    winesSnapshot.forEach((doc) => {
      wines.push({
        wineId: doc.id,
        ...doc.data(),
      });
    });

    // Calculate match scores
    const scoredWines = wines.map((wine) => ({
      ...wine,
      matchScore: calculateMatchScore(userPreferences, wine),
    }));

    // Filter and sort by match score
    let matchedWines = scoredWines
      .filter((wine) => wine.matchScore >= 0.6) // Only show wines with 60%+ match
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10); // Return top 10 matches

    // Fetch food pairings for each wine
    matchedWines = await Promise.all(
      matchedWines.map(async (wine) => {
        const pairingsSnapshot = await db
          .collection('restaurants')
          .doc(restaurantId)
          .collection('pairings')
          .where('wineId', '==', wine.wineId)
          .get();

        // Sort by pairing score descending and limit to top 3
        const pairingsDocs = pairingsSnapshot.docs
          .sort((a, b) => (b.data().pairingScore || 0) - (a.data().pairingScore || 0))
          .slice(0, 3);

        const foodPairings = [];
        for (const doc of pairingsDocs) {
          const pairing = doc.data();
          // Fetch food item details
          const foodDoc = await db
            .collection('restaurants')
            .doc(restaurantId)
            .collection('foodItems')
            .doc(pairing.foodItemId)
            .get();

          if (foodDoc.exists) {
            foodPairings.push({
              pairingId: doc.id,
              pairingScore: pairing.pairingScore,
              pairingReason: pairing.pairingReason,
              foodItem: {
                foodItemId: pairing.foodItemId,
                ...foodDoc.data(),
              },
            });
          }
        }

        return {
          ...wine,
          foodPairings,
        };
      })
    );

    res.json({
      restaurantId,
      userPreferences,
      matches: matchedWines,
      totalMatches: matchedWines.length,
    });
  } catch (error) {
    console.error('Error finding pairings:', error);
    res.status(500).json({ error: 'Failed to find wine pairings' });
  }
});

// POST /api/pairings/add-food-pairing
// Add a food pairing for a wine
router.post('/add-food-pairing', async (req, res) => {
  try {
    const { restaurantId, wineId, foodItemId, pairingScore, pairingReason } = req.body;

    if (!restaurantId || !wineId || !foodItemId) {
      return res.status(400).json({
        error: 'Restaurant ID, wine ID, and food item ID are required',
      });
    }

    const pairing = {
      wineId,
      foodItemId,
      pairingScore: pairingScore || 8,
      pairingReason: pairingReason || '',
      createdAt: new Date(),
    };

    const pairingRef = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('pairings')
      .add(pairing);

    res.json({
      message: 'Food pairing added successfully',
      pairingId: pairingRef.id,
      pairing,
    });
  } catch (error) {
    console.error('Error adding pairing:', error);
    res.status(500).json({ error: 'Failed to add pairing' });
  }
});

// GET /api/pairings/restaurant/:restaurantId/wine/:wineId
// Get food pairings for a specific wine
router.get('/restaurant/:restaurantId/wine/:wineId', async (req, res) => {
  try {
    const { restaurantId, wineId } = req.params;

    const pairingsSnapshot = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('pairings')
      .where('wineId', '==', wineId)
      .orderBy('pairingScore', 'desc')
      .get();

    const pairings = [];
    pairingsSnapshot.forEach((doc) => {
      pairings.push({
        pairingId: doc.id,
        ...doc.data(),
      });
    });

    res.json({
      restaurantId,
      wineId,
      pairings,
      count: pairings.length,
    });
  } catch (error) {
    console.error('Error getting pairings:', error);
    res.status(500).json({ error: 'Failed to get pairings' });
  }
});

// POST /api/pairings/save-pairing
// Save a pairing to user's history
router.post('/save-pairing', async (req, res) => {
  try {
    const { userId, restaurantId, wineId, foodItemId, matchScore, wineName, restaurantName } = req.body;

    if (!userId || !restaurantId || !wineId) {
      return res.status(400).json({ error: 'userId, restaurantId, and wineId are required' });
    }

    // Create pairing history entry in user's subcollection
    const pairingHistoryRef = await db
      .collection('users')
      .doc(userId)
      .collection('pairing_history')
      .add({
        restaurantId,
        restaurantName: restaurantName || '',
        wineId,
        wineName: wineName || '',
        foodItemId: foodItemId || null,
        foodName: '',
        matchScore: matchScore || 0,
        saved_at: new Date(),
        notes: ''
      });

    res.json({
      message: 'Pairing saved successfully',
      pairingHistoryId: pairingHistoryRef.id,
      saved_at: new Date()
    });
  } catch (error) {
    console.error('Error saving pairing:', error);
    res.status(500).json({ error: 'Failed to save pairing' });
  }
});

module.exports = router;
