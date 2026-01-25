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

module.exports = router;
