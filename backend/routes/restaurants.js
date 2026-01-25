const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const QRCode = require('qrcode');

console.log('[RESTAURANTS.JS] Module loaded');

// First: GET /api/restaurants - Get all restaurants with wine count
router.get('/', async (req, res) => {
  console.log('[RESTAURANTS GET /] Route called');
  try {
    const restaurantsSnapshot = await db.collection('restaurants').get();
    console.log(`[RESTAURANTS GET /] Found ${restaurantsSnapshot.size} restaurants`);
    const restaurants = [];

    for (const doc of restaurantsSnapshot.docs) {
      const winesSnapshot = await db
        .collection('restaurants')
        .doc(doc.id)
        .collection('wines')
        .get();

      const rest = doc.data();
      rest.wineCount = winesSnapshot.size;
      console.log(`[RESTAURANTS GET /] ${rest.name}: ${winesSnapshot.size} wines`);
      restaurants.push(rest);
    }

    console.log(`[RESTAURANTS GET /] Sending response with ${restaurants.length} restaurants`);
    res.json({ restaurants, count: restaurants.length });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get restaurants' });
  }
});

// Second: POST /api/restaurants/create
router.post('/create', async (req, res) => {
  try {
    const { name, location, city } = req.body;
    if (!name || !city) {
      return res.status(400).json({ error: 'Restaurant name and city are required' });
    }

    const restaurant = {
      name,
      location: location || {},
      city,
      wineList: [],
      menu: [],
      createdAt: new Date(),
    };

    const restaurantRef = await db.collection('restaurants').add(restaurant);
    const restaurantId = restaurantRef.id;

    const baseUrl = process.env.SIPSYNC_BASE_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/restaurant/${restaurantId}`;
    const qrCode = await QRCode.toDataURL(qrUrl);

    await restaurantRef.update({ qrCodeUrl: qrUrl });

    res.json({
      message: 'Restaurant created successfully',
      restaurantId,
      restaurant: { ...restaurant, qrCodeUrl: qrUrl, qrCodeImage: qrCode },
    });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Failed to create restaurant' });
  }
});

// Third: GET /api/restaurants/:restaurantId
router.get('/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();

    if (!restaurantDoc.exists) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({ restaurantId, ...restaurantDoc.data() });
  } catch (error) {
    console.error('Error getting restaurant:', error);
    res.status(500).json({ error: 'Failed to get restaurant' });
  }
});

module.exports = router;
