const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// POST /api/wines/restaurant/:restaurantId/add
// Add a wine to a restaurant's wine list
router.post('/restaurant/:restaurantId/add', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      name,
      type,
      acidity,
      tannins,
      bodyWeight,
      flavorProfile,
      sweetnessLevel,
      price,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Wine name and type are required' });
    }

    const wine = {
      name,
      type,
      acidity: acidity || 'medium',
      tannins: tannins || 'medium',
      bodyWeight: bodyWeight || 'medium',
      flavorProfile: flavorProfile || [],
      sweetnessLevel: sweetnessLevel || 'dry',
      price: price || 0,
      inventoryStatus: 'normal',
      createdAt: new Date(),
    };

    const wineRef = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('wines')
      .add(wine);

    res.json({
      message: 'Wine added successfully',
      wineId: wineRef.id,
      wine,
    });
  } catch (error) {
    console.error('Error adding wine:', error);
    res.status(500).json({ error: 'Failed to add wine' });
  }
});

// GET /api/wines/restaurant/:restaurantId
// Get all wines for a restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;

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

    res.json({
      restaurantId,
      wines,
      count: wines.length,
    });
  } catch (error) {
    console.error('Error getting wines:', error);
    res.status(500).json({ error: 'Failed to get wines' });
  }
});

// GET /api/wines/:wineId
// Get a specific wine
router.get('/:wineId', async (req, res) => {
  try {
    const { wineId } = req.params;

    // This would need restaurant context in production
    // For now, returning a placeholder
    res.json({
      message: 'Get specific wine - needs restaurant context',
    });
  } catch (error) {
    console.error('Error getting wine:', error);
    res.status(500).json({ error: 'Failed to get wine' });
  }
});

module.exports = router;
