const express = require('express');
const router = express.Router();
const { db, auth } = require('../firebase');
const jwt = require('jsonwebtoken');
const twilio = require('twilio');

// Initialize Twilio client only if credentials are provided
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_account_sid') {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Store verification codes temporarily (in production, use Redis or database)
const verificationCodes = {};

// POST /api/auth/send-verification
// Sends an SMS verification code to the user's phone
router.post('/send-verification', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store the code (expires in 10 minutes)
    verificationCodes[phoneNumber] = {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000,
    };

    // Send SMS via Twilio (if configured)
    if (twilioClient) {
      await twilioClient.messages.create({
        body: `Your SipSync verification code is: ${code}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });
    } else {
      // For testing without Twilio, log the code
      console.log(`[TEST MODE] Verification code for ${phoneNumber}: ${code}`);
    }

    res.json({
      message: 'Verification code sent',
      phoneNumber,
      testCode: twilioClient ? undefined : code, // Include code in test mode for testing
    });
  } catch (error) {
    console.error('Error sending verification:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/auth/verify
// Verifies the code and creates/logs in the user
router.post('/verify', async (req, res) => {
  try {
    const { phoneNumber, code, name } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and code are required' });
    }

    // Check if code is valid and not expired
    const storedData = verificationCodes[phoneNumber];
    console.log(`[VERIFY] Phone: ${phoneNumber}, Code: ${code}, Stored: ${JSON.stringify(storedData)}`);

    if (!storedData || storedData.code !== code || storedData.expiresAt < Date.now()) {
      console.log(`[VERIFY] Code validation failed`);
      return res.status(401).json({ error: 'Invalid or expired verification code' });
    }

    // Remove used code
    delete verificationCodes[phoneNumber];

    // Check if user exists in Firestore
    console.log(`[VERIFY] Checking Firestore for user: ${phoneNumber}`);
    const userRef = db.collection('users').doc(phoneNumber);
    const userDoc = await userRef.get();
    console.log(`[VERIFY] Firestore query complete`);

    let userId;
    if (!userDoc.exists) {
      // Create new user
      if (!name) {
        return res.status(400).json({ error: 'Name is required for new users' });
      }

      await userRef.set({
        phoneNumber,
        name,
        savedPreferences: [],
        wineHistory: [],
        createdAt: new Date(),
      });

      userId = phoneNumber;
    } else {
      userId = phoneNumber;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId, phoneNumber },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'User verified and logged in',
      token,
      userId,
      phoneNumber,
    });
  } catch (error) {
    console.error('Error verifying code:', error.message || error);
    console.error('Full error:', error);
    res.status(500).json({
      error: 'Failed to verify code',
      details: error.message || error.toString(),
      code: error.code || 'UNKNOWN'
    });
  }
});

// GET /api/auth/user/:userId
// Get user profile
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      userId,
      ...userDoc.data(),
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// PUT /api/auth/user/:userId
// Update user preferences
router.put('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, savedPreferences } = req.body;

    const userRef = db.collection('users').doc(userId);
    const updateData = {};

    if (name) updateData.name = name;
    if (savedPreferences) updateData.savedPreferences = savedPreferences;

    await userRef.update(updateData);

    const updatedDoc = await userRef.get();

    res.json({
      message: 'User updated successfully',
      user: {
        userId,
        ...updatedDoc.data(),
      },
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// GET /api/auth/user/:userId/pairing-history
// Get user's pairing history
router.get('/user/:userId/pairing-history', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const pairingHistorySnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('pairing_history')
      .orderBy('saved_at', 'desc')
      .limit(limit)
      .get();

    const pairingHistory = [];
    pairingHistorySnapshot.forEach((doc) => {
      pairingHistory.push({
        historyId: doc.id,
        ...doc.data(),
        saved_at: doc.data().saved_at?.toDate?.() || new Date(doc.data().saved_at)
      });
    });

    res.json({
      userId,
      pairingHistory,
      count: pairingHistory.length
    });
  } catch (error) {
    console.error('Error getting pairing history:', error);
    res.status(500).json({ error: 'Failed to get pairing history' });
  }
});

// GET /api/auth/user/:userId/visited-restaurants
// Get unique restaurants user has saved pairings from
router.get('/user/:userId/visited-restaurants', async (req, res) => {
  try {
    const { userId } = req.params;

    const pairingHistorySnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('pairing_history')
      .orderBy('saved_at', 'desc')
      .get();

    // Group by restaurantId and keep most recent entry
    const restaurantMap = new Map();
    pairingHistorySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.restaurantId && !restaurantMap.has(data.restaurantId)) {
        restaurantMap.set(data.restaurantId, {
          restaurantId: data.restaurantId,
          restaurantName: data.restaurantName,
          lastVisit: data.saved_at?.toDate?.() || new Date(data.saved_at),
          pairingCount: 0
        });
      }
    });

    // Count pairings per restaurant
    pairingHistorySnapshot.forEach((doc) => {
      const data = doc.data();
      if (restaurantMap.has(data.restaurantId)) {
        const restaurant = restaurantMap.get(data.restaurantId);
        restaurant.pairingCount++;
      }
    });

    // Convert to array and sort by lastVisit descending
    const visitedRestaurants = Array.from(restaurantMap.values())
      .sort((a, b) => b.lastVisit - a.lastVisit);

    // Fetch restaurant details from restaurants collection
    const enrichedRestaurants = await Promise.all(
      visitedRestaurants.map(async (rest) => {
        try {
          const restaurantDoc = await db.collection('restaurants').doc(rest.restaurantId).get();
          if (restaurantDoc.exists) {
            return {
              ...rest,
              city: restaurantDoc.data().city || '',
              wineCount: restaurantDoc.data().wineCount || 0
            };
          }
          return rest;
        } catch (err) {
          return rest;
        }
      })
    );

    res.json({
      userId,
      visitedRestaurants: enrichedRestaurants,
      count: enrichedRestaurants.length
    });
  } catch (error) {
    console.error('Error getting visited restaurants:', error);
    res.status(500).json({ error: 'Failed to get visited restaurants' });
  }
});

module.exports = router;
