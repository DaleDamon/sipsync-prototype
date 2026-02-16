const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// Helper function to generate default food pairings based on wine type
function getDefaultFoodPairings(wineType) {
  const pairingsByType = {
    red: [
      { name: 'Grilled Steak', description: 'Medium to full-bodied red wine pairs perfectly with a juicy grilled steak', pairing: 'Classic pairing that highlights both the wine and meat' },
      { name: 'Roasted Lamb', description: 'Red wine complements the rich, savory flavors of roasted lamb', pairing: 'Traditional French bistro pairing' },
      { name: 'Beef Burger', description: 'A quality red wine elevates a gourmet burger experience', pairing: 'Great for casual dining' },
    ],
    white: [
      { name: 'Grilled Fish', description: 'White wine\'s acidity complements fresh grilled fish beautifully', pairing: 'Coastal Mediterranean tradition' },
      { name: 'Pasta Alfredo', description: 'Creamy pasta sauces pair wonderfully with white wine', pairing: 'Italian classic combination' },
      { name: 'Shrimp Scampi', description: 'Light white wine enhances garlic and butter flavors in shrimp', pairing: 'Sophisticated seafood pairing' },
    ],
    rosé: [
      { name: 'Salad with Goat Cheese', description: 'Rosé\'s light fruitiness pairs with fresh salads and tangy cheese', pairing: 'Perfect summer lunch' },
      { name: 'Grilled Chicken', description: 'Rosé is versatile enough for grilled chicken dishes', pairing: 'Balanced flavor combination' },
      { name: 'Fruit Dessert', description: 'Rosé\'s sweetness complements fruit-based desserts', pairing: 'Delicate and refreshing' },
    ],
    sparkling: [
      { name: 'Oysters', description: 'Sparkling wine\'s bubbles and acidity are perfect with fresh oysters', pairing: 'Classic French coastal pairing' },
      { name: 'Caviar & Canapés', description: 'Champagne and caviar is the ultimate celebration pairing', pairing: 'Luxurious and elegant' },
      { name: 'Appetizer Platter', description: 'Sparkling wine works with a variety of appetizers', pairing: 'Great for parties and celebrations' },
    ],
    dessert: [
      { name: 'Chocolate Cake', description: 'Sweet dessert wines pair beautifully with rich chocolate desserts', pairing: 'Classic indulgent combination' },
      { name: 'Crème Brûlée', description: 'The caramel and custard flavors complement dessert wine perfectly', pairing: 'Sophisticated French pairing' },
      { name: 'Fruit Tart', description: 'Fruit-forward dessert wines enhance fresh fruit tarts', pairing: 'Light and elegant finish' },
    ],
  };

  // Normalize wine type (handle special characters and case variations)
  const normalizedType = wineType.toLowerCase()
    .replace(/\u00e9/g, 'e')  // é to e
    .replace(/\u00f4/g, 'o')  // ô to o
    .replace(/[^\w]/g, '')    // Remove other special characters
    .trim();

  // Check for rosé variations
  if (normalizedType.includes('rose') || normalizedType.includes('ros')) {
    return pairingsByType.rosé;
  }

  return pairingsByType[normalizedType] || pairingsByType.dessert || pairingsByType.red;
}

// Helper function to get display name for wine (supports both old and new format)
function getWineDisplayName(wine) {
  const parts = [];
  if (wine.year && wine.year.trim()) parts.push(wine.year);
  if (wine.producer && wine.producer.trim()) parts.push(wine.producer);
  if (wine.varietal && wine.varietal.trim()) parts.push(wine.varietal);
  return parts.join(' ') || wine.name || 'Unnamed Wine';
}

// Helper function to calculate match score between user preferences and wine
function calculateMatchScore(userPreferences, wine) {
  console.log('\n=== MATCH SCORE CALCULATION ===');
  console.log('Wine:', getWineDisplayName(wine));
  console.log('User Preferences:', JSON.stringify(userPreferences, null, 2));
  console.log('Wine Data:', JSON.stringify({
    type: wine.type,
    acidity: wine.acidity,
    tannins: wine.tannins,
    bodyWeight: wine.bodyWeight,
    flavorProfile: wine.flavorProfile,
    sweetnessLevel: wine.sweetnessLevel,
    price: wine.price
  }, null, 2));

  let totalScore = 0;
  let categoryCount = 0;

  // Acidity match
  if (userPreferences.acidity) {
    const acidityMatch = userPreferences.acidity === wine.acidity ? 1 : 0.5;
    totalScore += acidityMatch;
    categoryCount++;
    console.log(`Acidity: ${userPreferences.acidity} vs ${wine.acidity} = ${acidityMatch} (total: ${totalScore}/${categoryCount})`);
  }

  // Tannins match
  if (userPreferences.tannins) {
    const tanninsMatch = userPreferences.tannins === wine.tannins ? 1 : 0.5;
    totalScore += tanninsMatch;
    categoryCount++;
    console.log(`Tannins: ${userPreferences.tannins} vs ${wine.tannins} = ${tanninsMatch} (total: ${totalScore}/${categoryCount})`);
  }

  // Body weight match
  if (userPreferences.bodyWeight) {
    const bodyMatch = userPreferences.bodyWeight === wine.bodyWeight ? 1 : 0.5;
    totalScore += bodyMatch;
    categoryCount++;
    console.log(`Body: ${userPreferences.bodyWeight} vs ${wine.bodyWeight} = ${bodyMatch} (total: ${totalScore}/${categoryCount})`);
  }

  // Flavor profile match
  // Available flavor notes: oak, cherry, citrus, berry, vanilla, spice, floral, chocolate, earthy, tropical, herbal, honey
  if (userPreferences.flavorNotes && userPreferences.flavorNotes.length > 0) {
    const matchedFlavors = userPreferences.flavorNotes.filter((flavor) =>
      wine.flavorProfile.includes(flavor)
    );
    const flavorMatch = matchedFlavors.length / userPreferences.flavorNotes.length;
    totalScore += flavorMatch;
    categoryCount++;
    console.log(`Flavors: [${userPreferences.flavorNotes.join(', ')}] vs [${wine.flavorProfile.join(', ')}]`);
    console.log(`  Matched: [${matchedFlavors.join(', ')}] = ${flavorMatch} (${matchedFlavors.length}/${userPreferences.flavorNotes.length}) (total: ${totalScore}/${categoryCount})`);
  }

  // Sweetness match
  if (userPreferences.sweetness) {
    const sweetnessMatch = userPreferences.sweetness === wine.sweetnessLevel ? 1 : 0.5;
    totalScore += sweetnessMatch;
    categoryCount++;
    console.log(`Sweetness: ${userPreferences.sweetness} vs ${wine.sweetnessLevel} = ${sweetnessMatch} (total: ${totalScore}/${categoryCount})`);
  }

  // Price match
  if (userPreferences.priceRange) {
    const { min, max } = userPreferences.priceRange;
    const priceMatch = wine.price >= min && wine.price <= max ? 1 : 0.5;
    totalScore += priceMatch;
    categoryCount++;
    console.log(`Price: $${wine.price} in [$${min}-$${max}] = ${priceMatch} (total: ${totalScore}/${categoryCount})`);
  }

  // Wine type match
  if (userPreferences.wineType && userPreferences.wineType !== 'any') {
    const typeMatch = userPreferences.wineType === wine.type ? 1 : 0;
    totalScore += typeMatch;
    categoryCount++;
    console.log(`Type: ${userPreferences.wineType} vs ${wine.type} = ${typeMatch} (total: ${totalScore}/${categoryCount})`);
  }

  const finalScore = categoryCount > 0 ? totalScore / categoryCount : 0;
  console.log(`\nFINAL SCORE: ${totalScore} / ${categoryCount} = ${finalScore} (${Math.round(finalScore * 100)}%)`);
  console.log('=== END CALCULATION ===\n');

  return finalScore;
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
      .filter((wine) => {
        // If wine type is specified, filter to only that type
        if (userPreferences.wineType && userPreferences.wineType !== 'any') {
          console.log(`[FILTER] Checking wine type: ${wine.type} vs ${userPreferences.wineType}`);
          return wine.type === userPreferences.wineType;
        }
        return true; // If no type specified, include all wines
      })
      .filter((wine) => wine.matchScore >= 0.6) // Only show wines with 60%+ match
      .sort((a, b) => b.matchScore - a.matchScore);

    console.log(`[PAIRINGS] Before slice: ${matchedWines.length} wines`);
    matchedWines = matchedWines.slice(0, 6); // Return top 6 matches
    console.log(`[PAIRINGS] After slice: ${matchedWines.length} wines`);

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

        let foodPairings = [];
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

        // If no food pairings found, generate default pairings for this wine type
        if (foodPairings.length === 0) {
          const defaultPairings = getDefaultFoodPairings(wine.type);
          foodPairings = defaultPairings.map((pairing, index) => ({
            pairingId: `default-${wine.wineId}-${index}`,
            pairingScore: 8,
            pairingReason: pairing.pairing,
            foodItem: {
              foodItemId: `default-${wine.wineId}-${index}`,
              name: pairing.name,
              description: pairing.description,
            },
            isDefault: true,
          }));
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
      _debug: {
        sliceLimit: 6,
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
