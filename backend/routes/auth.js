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
    // In test mode (no Twilio), use fixed code so testers can easily sign in
    const code = twilioClient
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '123456';

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
      console.log(`[TEST MODE] Verification code for ${phoneNumber}: ${code}`);
    }

    res.json({
      message: 'Verification code sent',
      phoneNumber,
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

// POST /api/auth/quiz/submit
// Submit quiz answers and calculate wine preference profile
router.post('/quiz/submit', async (req, res) => {
  try {
    const { userId, answers } = req.body;

    if (!userId || !answers || answers.length !== 15) {
      return res.status(400).json({ error: 'User ID and 15 quiz answers are required' });
    }

    // Define the 10 profiles with their metadata
    const profiles = [
      {
        id: 'full-bodied-red-enthusiast',
        name: 'Full-Bodied Red Enthusiast',
        wineType: 'red',
        dimensions: { acidity: 45, tannins: 90, body: 90, sweetness: 15, intensity: 75 },
        characteristics: {
          acidity: 'medium',
          tannins: 'high',
          bodyWeight: 'full',
          sweetness: 'dry',
          flavorNotes: ['oak', 'spice', 'cherry']
        }
      },
      {
        id: 'medium-bodied-red-aficionado',
        name: 'Medium-Bodied Red Aficionado',
        wineType: 'red',
        dimensions: { acidity: 60, tannins: 30, body: 45, sweetness: 30, intensity: 60 },
        characteristics: {
          acidity: 'medium',
          tannins: 'low',
          bodyWeight: 'medium',
          sweetness: 'medium',
          flavorNotes: ['cherry', 'berry', 'vanilla']
        }
      },
      {
        id: 'spiced-red-connoisseur',
        name: 'Spiced Red Connoisseur',
        wineType: 'red',
        dimensions: { acidity: 45, tannins: 75, body: 90, sweetness: 15, intensity: 75 },
        characteristics: {
          acidity: 'medium',
          tannins: 'medium',
          bodyWeight: 'full',
          sweetness: 'dry',
          flavorNotes: ['spice', 'cherry', 'oak']
        }
      },
      {
        id: 'light-bodied-red-devotee',
        name: 'Light-Bodied Red Devotee',
        wineType: 'red',
        dimensions: { acidity: 75, tannins: 30, body: 30, sweetness: 15, intensity: 45 },
        characteristics: {
          acidity: 'high',
          tannins: 'low',
          bodyWeight: 'light',
          sweetness: 'dry',
          flavorNotes: ['berry', 'floral', 'citrus']
        }
      },
      {
        id: 'crisp-acidic-white-enthusiast',
        name: 'Crisp & Acidic White Enthusiast',
        wineType: 'white',
        dimensions: { acidity: 90, tannins: 15, body: 30, sweetness: 15, intensity: 75 },
        characteristics: {
          acidity: 'high',
          tannins: 'low',
          bodyWeight: 'light',
          sweetness: 'dry',
          flavorNotes: ['citrus', 'floral']
        }
      },
      {
        id: 'full-bodied-white-aficionado',
        name: 'Full-Bodied White Aficionado',
        wineType: 'white',
        dimensions: { acidity: 45, tannins: 15, body: 90, sweetness: 15, intensity: 75 },
        characteristics: {
          acidity: 'low',
          tannins: 'low',
          bodyWeight: 'full',
          sweetness: 'dry',
          flavorNotes: ['oak', 'vanilla', 'butter']
        }
      },
      {
        id: 'aromatic-white-connoisseur',
        name: 'Aromatic White Connoisseur',
        wineType: 'white',
        dimensions: { acidity: 60, tannins: 15, body: 45, sweetness: 60, intensity: 60 },
        characteristics: {
          acidity: 'medium',
          tannins: 'low',
          bodyWeight: 'medium',
          sweetness: 'medium',
          flavorNotes: ['floral', 'citrus', 'spice']
        }
      },
      {
        id: 'fruit-forward-white-devotee',
        name: 'Fruit-Forward White Devotee',
        wineType: 'white',
        dimensions: { acidity: 45, tannins: 15, body: 45, sweetness: 60, intensity: 45 },
        characteristics: {
          acidity: 'medium',
          tannins: 'low',
          bodyWeight: 'medium',
          sweetness: 'medium',
          flavorNotes: ['citrus', 'berry']
        }
      },
      {
        id: 'sparkling-wine-enthusiast',
        name: 'Sparkling Wine Enthusiast',
        wineType: 'sparkling',
        dimensions: { acidity: 75, tannins: 15, body: 30, sweetness: 15, intensity: 45 },
        characteristics: {
          acidity: 'high',
          tannins: 'low',
          bodyWeight: 'light',
          sweetness: 'dry',
          flavorNotes: ['citrus', 'floral']
        }
      },
      {
        id: 'dessert-wine-aficionado',
        name: 'Dessert Wine Aficionado',
        wineType: 'dessert',
        dimensions: { acidity: 45, tannins: 45, body: 60, sweetness: 90, intensity: 75 },
        characteristics: {
          acidity: 'low',
          tannins: 'low',
          bodyWeight: 'medium',
          sweetness: 'sweet',
          flavorNotes: ['berry', 'vanilla']
        }
      }
    ];

    // Scoring matrix V5: Variable points (1/2/3) to reduce ties and create score differentiation
    // Strong correlations get 3 points, standard get 2, weak get 1
    // Core profiles: 13-14 max points | Rare profiles (SPK, DST): 10 max points
    // This increases score granularity from 7 values (0-12) to 25+ possible values
    const scoringMatrix = [
      // Q1: Coffee (Black/Strong → Sweet/Skip)
      { 0: [{ id: 'full-bodied-red-enthusiast', points: 3 }],
        1: [{ id: 'medium-bodied-red-aficionado', points: 2 }],
        2: [{ id: 'light-bodied-red-devotee', points: 2 }],
        3: [{ id: 'fruit-forward-white-devotee', points: 2 }] },
      // Q2: Chocolate (Dark → White)
      { 0: [{ id: 'spiced-red-connoisseur', points: 3 }],
        1: [{ id: 'full-bodied-white-aficionado', points: 2 }],
        2: [{ id: 'aromatic-white-connoisseur', points: 2 }],
        3: [{ id: 'dessert-wine-aficionado', points: 2 }] },
      // Q3: Tea (Strong → Skip)
      { 0: [{ id: 'full-bodied-red-enthusiast', points: 2 }],
        1: [{ id: 'light-bodied-red-devotee', points: 3 }],
        2: [{ id: 'fruit-forward-white-devotee', points: 2 }],
        3: [{ id: 'aromatic-white-connoisseur', points: 2 }] },
      // Q4: Acidity (Love → Prefer Mild)
      { 0: [{ id: 'crisp-acidic-white-enthusiast', points: 3 }],
        1: [{ id: 'fruit-forward-white-devotee', points: 2 }],
        2: [{ id: 'medium-bodied-red-aficionado', points: 2 }],
        3: [{ id: 'full-bodied-white-aficionado', points: 2 }] },
      // Q5: Salad Dressing (Vinaigrette → Rich Oil)
      { 0: [{ id: 'crisp-acidic-white-enthusiast', points: 2 }],
        1: [{ id: 'sparkling-wine-enthusiast', points: 2 }],
        2: [{ id: 'spiced-red-connoisseur', points: 2 }],
        3: [{ id: 'full-bodied-white-aficionado', points: 3 }] },
      // Q6: Morning Drink (Citrus → Hot Chocolate)
      { 0: [{ id: 'sparkling-wine-enthusiast', points: 2 }],
        1: [{ id: 'fruit-forward-white-devotee', points: 3 }],
        2: [{ id: 'aromatic-white-connoisseur', points: 3 }],
        3: [{ id: 'dessert-wine-aficionado', points: 2 }] },
      // Q7: Meal (Beef → Pasta Cream)
      { 0: [{ id: 'full-bodied-red-enthusiast', points: 3 }],
        1: [{ id: 'spiced-red-connoisseur', points: 2 }],
        2: [{ id: 'light-bodied-red-devotee', points: 2 }],
        3: [{ id: 'full-bodied-white-aficionado', points: 2 }] },
      // Q8: Soup (Creamy → Clear Broth)
      { 0: [{ id: 'crisp-acidic-white-enthusiast', points: 2 }],
        1: [{ id: 'medium-bodied-red-aficionado', points: 3 }],
        2: [{ id: 'light-bodied-red-devotee', points: 2 }],
        3: [{ id: 'aromatic-white-connoisseur', points: 2 }] },
      // Q9: Pasta Sauce (Meat → Light Oil)
      { 0: [{ id: 'full-bodied-red-enthusiast', points: 2 }],
        1: [{ id: 'medium-bodied-red-aficionado', points: 2 }],
        2: [{ id: 'spiced-red-connoisseur', points: 3 }],
        3: [{ id: 'crisp-acidic-white-enthusiast', points: 2 }] },
      // Q10: Dessert (Essential → Never)
      { 0: [{ id: 'dessert-wine-aficionado', points: 2 }],
        1: [{ id: 'aromatic-white-connoisseur', points: 2 }],
        2: [{ id: 'sparkling-wine-enthusiast', points: 1 }],
        3: [{ id: 'full-bodied-white-aficionado', points: 2 }] },
      // Q11: Drink Sweetness (Very Sweet → Dry)
      { 0: [{ id: 'dessert-wine-aficionado', points: 2 }],
        1: [{ id: 'fruit-forward-white-devotee', points: 2 }],
        2: [{ id: 'light-bodied-red-devotee', points: 2 }],
        3: [{ id: 'sparkling-wine-enthusiast', points: 2 }] },
      // Q12: Spice (Maximum → None)
      { 0: [{ id: 'spiced-red-connoisseur', points: 2 }],
        1: [{ id: 'medium-bodied-red-aficionado', points: 2 }],
        2: [{ id: 'crisp-acidic-white-enthusiast', points: 3 }],
        3: [{ id: 'full-bodied-red-enthusiast', points: 2 }] },
      // Q13: Flavor Profile (Herbaceous → Savory)
      { 0: [{ id: 'aromatic-white-connoisseur', points: 2 }],
        1: [{ id: 'sparkling-wine-enthusiast', points: 1 }],
        2: [{ id: 'fruit-forward-white-devotee', points: 2 }],
        3: [{ id: 'full-bodied-red-enthusiast', points: 2 }] },
      // Q14: Fruit Type (Dark Berries → Citrus)
      { 0: [{ id: 'spiced-red-connoisseur', points: 2 }],
        1: [{ id: 'dessert-wine-aficionado', points: 1 }],
        2: [{ id: 'light-bodied-red-devotee', points: 3 }],
        3: [{ id: 'crisp-acidic-white-enthusiast', points: 2 }] },
      // Q15: Dining Scenario (Celebration → Casual)
      { 0: [{ id: 'sparkling-wine-enthusiast', points: 2 }],
        1: [{ id: 'full-bodied-white-aficionado', points: 2 }],
        2: [{ id: 'medium-bodied-red-aficionado', points: 3 }],
        3: [{ id: 'dessert-wine-aficionado', points: 1 }] }
    ];

    // Calculate scores
    const profileScores = {};
    profiles.forEach(p => profileScores[p.id] = 0);

    answers.forEach((answerIndex, questionIndex) => {
      const scoringForQuestion = scoringMatrix[questionIndex];
      if (scoringForQuestion && scoringForQuestion[answerIndex]) {
        scoringForQuestion[answerIndex].forEach(({ id, points }) => {
          profileScores[id] += points;
        });
      }
    });

    // Find winning profile with random tie-breaking
    let maxScore = -1;
    let tiedProfiles = [];

    for (const [profileId, score] of Object.entries(profileScores)) {
      if (score > maxScore) {
        maxScore = score;
        tiedProfiles = [profileId];
      } else if (score === maxScore) {
        tiedProfiles.push(profileId);
      }
    }

    // Randomly select from tied profiles for fair distribution
    const winningProfileId = tiedProfiles[Math.floor(Math.random() * tiedProfiles.length)];

    // Get winning profile details
    const winningProfile = profiles.find(p => p.id === winningProfileId);

    // Save quiz result to user document
    const userRef = db.collection('users').doc(userId);
    const preferencesData = {
      wineType: winningProfile.wineType,
      acidity: winningProfile.characteristics.acidity,
      tannins: winningProfile.characteristics.tannins,
      bodyWeight: winningProfile.characteristics.bodyWeight,
      sweetness: winningProfile.characteristics.sweetness,
      flavorNotes: winningProfile.characteristics.flavorNotes,
      dimensions: winningProfile.dimensions,
      priceRange: { min: 20, max: 100 }
    };

    try {
      // Use set with merge to handle both new and existing users
      await userRef.set({
        quizProfile: winningProfile.name,
        quizCompletedAt: new Date(),
        savedPreferences: [preferencesData]
      }, { merge: true });

      console.log(`[QUIZ] Quiz submitted successfully for user: ${userId}, Profile: ${winningProfile.name}`);

      res.json({
        profile: winningProfile.name,
        profileId: winningProfile.id,
        wineType: winningProfile.wineType,
        characteristics: winningProfile.characteristics,
        preferences: preferencesData
      });
    } catch (updateError) {
      console.error(`[QUIZ] Error saving quiz to user ${userId}:`, updateError.message);
      throw updateError;
    }
  } catch (error) {
    console.error('Error submitting quiz:', error.message || error);
    res.status(500).json({
      error: 'Failed to submit quiz',
      details: error.message || 'Unknown error'
    });
  }
});

module.exports = router;
