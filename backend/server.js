const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const winesRoutes = require('./routes/wines');
const restaurantsRoutes = require('./routes/restaurants');
const pairingsRoutes = require('./routes/pairings');
const foodItemsRoutes = require('./routes/foodItems');
const analyticsRoutes = require('./routes/analytics');

// Authentication routes
app.use('/api/auth', authRoutes);

// Wine routes
app.use('/api/wines', winesRoutes);

// Restaurant routes
app.use('/api/restaurants', restaurantsRoutes);

// Pairing routes
app.use('/api/pairings', pairingsRoutes);

// Food items routes
app.use('/api/food-items', foodItemsRoutes);

// Analytics routes
app.use('/api/analytics', analyticsRoutes);

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
