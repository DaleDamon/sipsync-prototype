const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { getWineDisplayName, calculateMatchScore } = require('../utils/wineScoring');
const { userAuth } = require('../middleware/userAuth');

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
      .filter((wine) => {
        // BTG-only hard filter
        if (userPreferences.btgOnly && !wine.glassPrice) return false;
        // If wine type is specified, filter to only that type
        if (userPreferences.wineType && userPreferences.wineType !== 'any') {
          console.log(`[FILTER] Checking wine type: ${wine.type} vs ${userPreferences.wineType}`);
          if (userPreferences.wineType === 'red') {
            return wine.type === 'red' || wine.type === 'rosé' || wine.type === 'rose';
          }
          return wine.type === userPreferences.wineType;
        }
        return true; // If no type specified, include all wines
      })
      .filter((wine) => wine.matchScore >= 0.6) // Only show wines with 60%+ match
      .sort((a, b) => b.matchScore - a.matchScore);

    console.log(`[PAIRINGS] Before slice: ${matchedWines.length} wines`);
    matchedWines = matchedWines.slice(0, 8); // Return top 8 matches
    console.log(`[PAIRINGS] After slice: ${matchedWines.length} wines`);

    res.json({
      restaurantId,
      userPreferences,
      matches: matchedWines,
      totalMatches: matchedWines.length,
      _debug: {
        sliceLimit: 8,
        actualCount: matchedWines.length,
        codeVersion: '2025-02-16-optimized'
      }
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
router.post('/save-pairing', userAuth, async (req, res) => {
  try {
    const { userId, restaurantId, wineId, foodItemId, matchScore, wineName, restaurantName,
            wineType, acidity, tannins, bodyWeight, sweetnessLevel, price, region } = req.body;

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
        wineType: wineType || '',
        acidity: acidity || '',
        tannins: tannins || '',
        bodyWeight: bodyWeight || '',
        sweetnessLevel: sweetnessLevel || '',
        price: price || 0,
        region: region || '',
        saved_at: new Date(),
        notes: '',
        rating: ''
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

// PATCH /api/pairings/rating
// Update the Pass/Pour/Cellar rating on a saved pairing
router.patch('/rating', userAuth, async (req, res) => {
  try {
    const { userId, pairingHistoryId, rating } = req.body;
    if (!userId || !pairingHistoryId || !rating) {
      return res.status(400).json({ error: 'userId, pairingHistoryId, and rating are required' });
    }
    if (!['pass', 'pour', 'cellar'].includes(rating)) {
      return res.status(400).json({ error: 'rating must be pass, pour, or cellar' });
    }
    await db.collection('users').doc(userId)
      .collection('pairing_history').doc(pairingHistoryId)
      .update({ rating });
    res.json({ message: 'Rating saved' });
  } catch (err) {
    console.error('Error saving rating:', err);
    res.status(500).json({ error: 'Failed to save rating' });
  }
});

module.exports = router;
