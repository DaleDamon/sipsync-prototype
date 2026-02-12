const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// POST /api/wines/restaurant/:restaurantId/add
// Add a wine to a restaurant's wine list
router.post('/restaurant/:restaurantId/add', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      year,
      producer,
      varietal,
      region,
      name,
      type,
      acidity,
      tannins,
      bodyWeight,
      flavorProfile,
      sweetnessLevel,
      price,
    } = req.body;

    // Support both new format (producer/varietal) and old format (name)
    const hasNewFormat = producer || varietal;
    const hasOldFormat = name;

    if (!type) {
      return res.status(400).json({ error: 'Wine type is required' });
    }

    // Validate new format fields if provided
    if (hasNewFormat) {
      if (!producer || !producer.trim()) {
        return res.status(400).json({ error: 'Producer is required' });
      }

      if (!varietal || !varietal.trim()) {
        return res.status(400).json({ error: 'Varietal is required' });
      }

      if (!region || !region.trim()) {
        return res.status(400).json({ error: 'Region is required' });
      }
    } else if (!hasOldFormat) {
      // If neither new nor old format provided, error
      return res.status(400).json({
        error: 'Either provide (producer, varietal, region) or (name) field'
      });
    }

    // Validate wine type
    const validTypes = ['red', 'white', 'rosé', 'sparkling', 'dessert'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid wine type "${type}". Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate acidity if provided
    const validAcidity = ['low', 'medium', 'high'];
    if (acidity && !validAcidity.includes(acidity)) {
      return res.status(400).json({
        error: `Invalid acidity "${acidity}". Must be one of: ${validAcidity.join(', ')}`
      });
    }

    // Validate tannins if provided
    const validTannins = ['low', 'medium', 'high'];
    if (tannins && !validTannins.includes(tannins)) {
      return res.status(400).json({
        error: `Invalid tannins "${tannins}". Must be one of: ${validTannins.join(', ')}`
      });
    }

    // Validate bodyWeight if provided
    const validBodyWeight = ['light', 'medium', 'full'];
    if (bodyWeight && !validBodyWeight.includes(bodyWeight)) {
      return res.status(400).json({
        error: `Invalid bodyWeight "${bodyWeight}". Must be one of: ${validBodyWeight.join(', ')}`
      });
    }

    // Validate sweetnessLevel if provided
    const validSweetness = ['dry', 'medium', 'sweet'];
    if (sweetnessLevel && !validSweetness.includes(sweetnessLevel)) {
      return res.status(400).json({
        error: `Invalid sweetnessLevel "${sweetnessLevel}". Must be one of: ${validSweetness.join(', ')}`
      });
    }

    // Validate price
    if (typeof price !== 'undefined' && (typeof price !== 'number' || price < 0)) {
      return res.status(400).json({ error: 'Price must be a non-negative number' });
    }

    // Validate flavorProfile is an array
    if (flavorProfile && !Array.isArray(flavorProfile)) {
      return res.status(400).json({ error: 'flavorProfile must be an array of flavor strings' });
    }

    const wine = {
      // New format fields (if provided)
      ...(hasNewFormat && {
        year: year || '',
        producer: producer.trim(),
        varietal: varietal.trim(),
        region: region.trim(),
      }),
      // Old format field (if provided, for backward compatibility)
      ...(hasOldFormat && { name }),
      // Common fields
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
