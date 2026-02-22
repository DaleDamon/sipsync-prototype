const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import routes
console.log('[SERVER.JS] Starting to import routes');
const authRoutes = require('./routes/auth');
console.log('[SERVER.JS] Auth routes imported');
const winesRoutes = require('./routes/wines');
console.log('[SERVER.JS] Wines routes imported');
const restaurantsRoutes = require('./routes/restaurants');
console.log('[SERVER.JS] Restaurants routes imported');
const pairingsRoutes = require('./routes/pairings');
console.log('[SERVER.JS] Pairings routes imported');
const foodItemsRoutes = require('./routes/foodItems');
console.log('[SERVER.JS] Food items routes imported');
const analyticsRoutes = require('./routes/analytics');
console.log('[SERVER.JS] Analytics routes imported');
const adminRoutes = require('./routes/admin');
console.log('[SERVER.JS] Admin routes imported');
const aiRoutes = require('./routes/ai');
console.log('[SERVER.JS] AI routes imported');

// Authentication routes
console.log('[SERVER.JS] Registering auth routes at /api/auth');
app.use('/api/auth', authRoutes);

// Wine routes
console.log('[SERVER.JS] Registering wines routes at /api/wines');
app.use('/api/wines', winesRoutes);

// Restaurant routes
console.log('[SERVER.JS] Registering restaurants routes at /api/restaurants');
app.use('/api/restaurants', restaurantsRoutes);

// Pairing routes
console.log('[SERVER.JS] Registering pairings routes at /api/pairings');
app.use('/api/pairings', pairingsRoutes);

// Food items routes
console.log('[SERVER.JS] Registering food-items routes at /api/food-items');
app.use('/api/food-items', foodItemsRoutes);

// Analytics routes
console.log('[SERVER.JS] Registering analytics routes at /api/analytics');
app.use('/api/analytics', analyticsRoutes);

// Admin routes
console.log('[SERVER.JS] Registering admin routes at /api/admin');
app.use('/api/admin', adminRoutes);

// AI routes
console.log('[SERVER.JS] Registering AI routes at /api/ai');
app.use('/api/ai', aiRoutes);

// Test route after routers
app.get('/api/health', (req, res) => {
  res.json({ status: 'SipSync backend is running!' });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

// Start server
app.listen(PORT, () => {
  console.log(`SipSync backend running on port ${PORT}`);
});
