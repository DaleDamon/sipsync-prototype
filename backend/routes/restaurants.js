const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const QRCode = require('qrcode');
const { adminAuth } = require('../middleware/adminAuth');
const geocoding = require('../services/geocoding');

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
      rest.id = doc.id;
      rest.restaurantId = doc.id;
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

// NEW: POST /api/restaurants - Create restaurant with address and geocoding
router.post('/', adminAuth, async (req, res) => {
  try {
    const { name, address, contact } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Restaurant name is required' });
    }

    if (!address || !address.street || !address.city || !address.state || !address.zipCode) {
      return res.status(400).json({ error: 'Complete address required (street, city, state, zipCode)' });
    }

    // Geocode address to get coordinates
    let coordinates;
    try {
      const coords = await geocoding.geocodeAddress(address);
      coordinates = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        source: process.env.GEOCODING_PROVIDER || 'google',
        lastUpdated: new Date().toISOString()
      };
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError);
      return res.status(400).json({
        error: 'Geocoding failed',
        message: geocodeError.message,
        suggestion: 'Please verify the address is correct'
      });
    }

    // Create restaurant document
    const restaurantData = {
      name,
      city: address.city,
      address: {
        street: address.street,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode,
        country: address.country || 'USA',
        neighborhood: address.neighborhood || ''
      },
      coordinates,
      contact: contact || {},
      // Backward compatibility - keep old latitude/longitude fields
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      location: {},
      wineList: [],
      menu: [],
      createdAt: new Date()
    };

    const restaurantRef = await db.collection('restaurants').add(restaurantData);
    const restaurantId = restaurantRef.id;

    // Generate QR code
    const baseUrl = process.env.SIPSYNC_BASE_URL || 'http://localhost:3000';
    const qrUrl = `${baseUrl}/restaurant/${restaurantId}`;
    const qrCode = await QRCode.toDataURL(qrUrl);

    await restaurantRef.update({ qrCodeUrl: qrUrl });

    res.json({
      message: 'Restaurant created successfully',
      restaurantId,
      restaurant: { ...restaurantData, id: restaurantId, qrCodeUrl: qrUrl, qrCodeImage: qrCode }
    });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({ error: 'Failed to create restaurant', message: error.message });
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

// Fourth: PUT /api/restaurants/:restaurantId - Update restaurant (address triggers re-geocoding)
router.put('/:restaurantId', adminAuth, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, address, contact } = req.body;

    const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
    if (!restaurantDoc.exists) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const updates = {};

    // Update name if provided
    if (name) {
      updates.name = name;
    }

    // Update address and re-geocode if address is provided
    if (address) {
      // Validate address fields
      if (!address.street || !address.city || !address.state || !address.zipCode) {
        return res.status(400).json({ error: 'Complete address required (street, city, state, zipCode)' });
      }

      // Re-geocode address
      try {
        const coords = await geocoding.geocodeAddress(address);

        updates.address = {
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country || 'USA',
          neighborhood: address.neighborhood || ''
        };

        updates.coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          source: process.env.GEOCODING_PROVIDER || 'google',
          lastUpdated: new Date().toISOString()
        };

        updates.city = address.city;

        // Backward compatibility
        updates.latitude = coords.latitude;
        updates.longitude = coords.longitude;
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
        return res.status(400).json({
          error: 'Geocoding failed',
          message: geocodeError.message,
          suggestion: 'Please verify the address is correct'
        });
      }
    }

    // Update contact if provided
    if (contact) {
      updates.contact = contact;
    }

    // Perform update
    await db.collection('restaurants').doc(restaurantId).update(updates);

    res.json({
      message: 'Restaurant updated successfully',
      restaurantId,
      updates
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({ error: 'Failed to update restaurant', message: error.message });
  }
});

module.exports = router;
