const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { adminAuth, superAdminAuth } = require('../middleware/adminAuth');

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Look up admin in Firestore
    const adminDoc = await db.collection('admins').doc(email).get();

    if (!adminDoc.exists) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const adminData = adminDoc.data();

    // Compare password
    const passwordMatch = await bcrypt.compare(password, adminData.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        adminId: email,
        email: email,
        role: adminData.role,
        restaurantId: adminData.restaurantId || null
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Admin logged in successfully',
      token,
      adminId: email,
      email,
      role: adminData.role,
      restaurantId: adminData.restaurantId || null
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// POST /api/admin/register (super admin only)
router.post('/register', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const { email, password, role, restaurantId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "superadmin"' });
    }

    // Check if admin already exists
    const existingAdmin = await db.collection('admins').doc(email).get();
    if (existingAdmin.exists) {
      return res.status(409).json({ error: 'Admin with this email already exists' });
    }

    // If role is admin, restaurantId is required
    if (role === 'admin' && !restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required for admin role' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin document
    await db.collection('admins').doc(email).set({
      email,
      passwordHash,
      role,
      restaurantId: restaurantId || null,
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Admin created successfully',
      email,
      role,
      restaurantId: restaurantId || null
    });
  } catch (error) {
    console.error('Error registering admin:', error);
    res.status(500).json({ error: 'Failed to register admin' });
  }
});

// GET /api/admin/profile (any admin)
router.get('/profile', adminAuth, async (req, res) => {
  try {
    const adminDoc = await db.collection('admins').doc(req.admin.email).get();

    if (!adminDoc.exists) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const adminData = adminDoc.data();
    const result = {
      email: adminData.email,
      role: adminData.role,
      restaurantId: adminData.restaurantId,
      createdAt: adminData.createdAt
    };

    // If admin has a restaurant, fetch its details
    if (adminData.restaurantId) {
      const restaurantDoc = await db.collection('restaurants').doc(adminData.restaurantId).get();
      if (restaurantDoc.exists) {
        result.restaurant = {
          id: restaurantDoc.id,
          ...restaurantDoc.data()
        };
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error getting admin profile:', error);
    res.status(500).json({ error: 'Failed to get admin profile' });
  }
});

// GET /api/admin/restaurants (super admin only)
router.get('/restaurants', adminAuth, superAdminAuth, async (req, res) => {
  try {
    const snapshot = await db.collection('restaurants').get();
    const restaurants = [];

    snapshot.forEach(doc => {
      restaurants.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ restaurants });
  } catch (error) {
    console.error('Error getting restaurants:', error);
    res.status(500).json({ error: 'Failed to get restaurants' });
  }
});

// POST /api/admin/upload-history
router.post('/upload-history', adminAuth, async (req, res) => {
  try {
    const { restaurantId, uploadType, wineCount, summary } = req.body;

    if (!restaurantId || !uploadType) {
      return res.status(400).json({ error: 'Restaurant ID and upload type are required' });
    }

    const historyRef = await db.collection('restaurants').doc(restaurantId)
      .collection('uploadHistory').add({
        uploadType,
        wineCount: wineCount || 0,
        summary: summary || '',
        uploadedBy: req.admin.email,
        createdAt: new Date()
      });

    res.status(201).json({
      message: 'Upload history recorded',
      historyId: historyRef.id
    });
  } catch (error) {
    console.error('Error recording upload history:', error);
    res.status(500).json({ error: 'Failed to record upload history' });
  }
});

// GET /api/admin/upload-history/:restaurantId
router.get('/upload-history/:restaurantId', adminAuth, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const snapshot = await db.collection('restaurants').doc(restaurantId)
      .collection('uploadHistory')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const history = [];
    snapshot.forEach(doc => {
      history.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      });
    });

    res.json({ history });
  } catch (error) {
    console.error('Error getting upload history:', error);
    res.status(500).json({ error: 'Failed to get upload history' });
  }
});

module.exports = router;
