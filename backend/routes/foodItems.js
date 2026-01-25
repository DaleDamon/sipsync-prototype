const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// POST /api/food-items/restaurant/:restaurantId/add
// Add a food item to a restaurant's menu
router.post('/restaurant/:restaurantId/add', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, description, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Food item name is required' });
    }

    const foodItem = {
      name,
      description: description || '',
      category: category || 'main',
      createdAt: new Date(),
    };

    const foodRef = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('foodItems')
      .add(foodItem);

    res.json({
      message: 'Food item added successfully',
      foodItemId: foodRef.id,
      foodItem,
    });
  } catch (error) {
    console.error('Error adding food item:', error);
    res.status(500).json({ error: 'Failed to add food item' });
  }
});

// GET /api/food-items/restaurant/:restaurantId
// Get all food items for a restaurant
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const foodSnapshot = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('foodItems')
      .get();

    const foodItems = [];
    foodSnapshot.forEach((doc) => {
      foodItems.push({
        foodItemId: doc.id,
        ...doc.data(),
      });
    });

    res.json({
      restaurantId,
      foodItems,
      count: foodItems.length,
    });
  } catch (error) {
    console.error('Error getting food items:', error);
    res.status(500).json({ error: 'Failed to get food items' });
  }
});

// GET /api/food-items/restaurant/:restaurantId/item/:foodItemId
// Get a specific food item
router.get('/restaurant/:restaurantId/item/:foodItemId', async (req, res) => {
  try {
    const { restaurantId, foodItemId } = req.params;

    const foodDoc = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('foodItems')
      .doc(foodItemId)
      .get();

    if (!foodDoc.exists) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    res.json({
      foodItemId,
      ...foodDoc.data(),
    });
  } catch (error) {
    console.error('Error getting food item:', error);
    res.status(500).json({ error: 'Failed to get food item' });
  }
});

module.exports = router;
