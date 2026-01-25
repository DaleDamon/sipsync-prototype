// Script to add latitude/longitude coordinates to restaurants
require('dotenv').config();
const { db } = require('../firebase');

async function addCoordinates() {
  try {
    // Get all restaurants
    const restaurantsSnapshot = await db.collection('restaurants').get();

    console.log(`Found ${restaurantsSnapshot.size} restaurants`);

    let updated = 0;

    // Update each restaurant with coordinates if missing
    for (const doc of restaurantsSnapshot.docs) {
      const restaurant = doc.data();

      // Skip if already has coordinates
      if (restaurant.latitude && restaurant.longitude) {
        console.log(`${restaurant.name} already has coordinates`);
        continue;
      }

      // Define coordinates for Chicago (can be customized per restaurant)
      // For now, use general Chicago coordinates with slight variations
      const chicagoLat = 41.8781;
      const chicagoLng = -87.6298;

      // Add small random offset for demo purposes
      const lat = chicagoLat + (Math.random() * 0.05 - 0.025);
      const lng = chicagoLng + (Math.random() * 0.05 - 0.025);

      await db.collection('restaurants').doc(doc.id).update({
        latitude: lat,
        longitude: lng,
      });

      console.log(`✓ Updated ${restaurant.name}: (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      updated++;
    }

    console.log(`\nSuccessfully updated ${updated} restaurants`);
  } catch (error) {
    console.error('Error adding coordinates:', error);
  }
}

addCoordinates();
