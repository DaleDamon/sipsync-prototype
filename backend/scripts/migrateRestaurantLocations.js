/**
 * Migration script to update existing restaurants with proper addresses and geocoded coordinates
 *
 * Usage: node scripts/migrateRestaurantLocations.js
 *
 * This script will:
 * 1. Fetch all restaurants from Firestore
 * 2. Prompt for address details for each restaurant missing address data
 * 3. Geocode the addresses using the configured geocoding service
 * 4. Update the restaurant documents with proper address and coordinate fields
 */

const readline = require('readline');
const geocoding = require('../services/geocoding');
require('dotenv').config();

// Use existing Firebase initialization
const { db } = require('../firebase');

async function migrateRestaurants() {
  console.log('\n========================================');
  console.log('Restaurant Location Migration Tool');
  console.log('========================================\n');

  try {
    const snapshot = await db.collection('restaurants').get();

    if (snapshot.empty) {
      console.log('No restaurants found in the database.');
      return;
    }

    console.log(`Found ${snapshot.size} restaurant(s) to check\n`);

    for (const doc of snapshot.docs) {
      const restaurant = doc.data();
      const restaurantId = doc.id;

      console.log(`\n========================================`);
      console.log(`Restaurant: ${restaurant.name}`);
      console.log(`ID: ${restaurantId}`);
      console.log(`Current coordinates: lat=${restaurant.latitude || 'N/A'}, lng=${restaurant.longitude || 'N/A'}`);

      // Check if restaurant already has proper address
      if (restaurant.address && restaurant.address.street) {
        console.log('✓ Already has complete address, skipping');
        console.log(`  Address: ${restaurant.address.street}, ${restaurant.address.city}, ${restaurant.address.state} ${restaurant.address.zipCode}`);
        continue;
      }

      console.log('⚠ Missing address information');

      // Prompt for address
      const address = await promptForAddress(restaurant.name);

      if (address.skip) {
        console.log('→ Skipped');
        continue;
      }

      try {
        // Geocode address
        console.log('→ Geocoding address...');
        const coords = await geocoding.geocodeAddress(address);

        console.log(`✓ Geocoded successfully:`);
        console.log(`  Coordinates: lat=${coords.latitude}, lng=${coords.longitude}`);
        console.log(`  Accuracy: ${coords.accuracy}`);
        console.log(`  Formatted: ${coords.formattedAddress}`);

        // Update restaurant document
        const updateData = {
          address: {
            street: address.street,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country || 'USA',
            neighborhood: address.neighborhood || ''
          },
          coordinates: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            source: process.env.GEOCODING_PROVIDER || 'google',
            lastUpdated: new Date().toISOString()
          },
          city: address.city,
          // Backward compatibility - keep old fields populated
          latitude: coords.latitude,
          longitude: coords.longitude
        };

        await doc.ref.update(updateData);

        console.log('✓ Restaurant updated successfully');
      } catch (err) {
        console.error(`✗ Error processing ${restaurant.name}:`, err.message);
        console.log('  Skipping this restaurant, you can run the script again later to retry');
      }
    }

    console.log('\n========================================');
    console.log('Migration Complete!');
    console.log('========================================\n');
  } catch (error) {
    console.error('Fatal error during migration:', error);
  }

  process.exit(0);
}

async function promptForAddress(restaurantName) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question) => new Promise(resolve => {
    rl.question(question, resolve);
  });

  console.log(`\nEnter address for "${restaurantName}" (or type 'skip' to skip this restaurant):`);

  try {
    const street = await ask('  Street Address: ');
    if (street.toLowerCase().trim() === 'skip') {
      rl.close();
      return { skip: true };
    }

    if (!street.trim()) {
      console.log('Street address is required. Skipping...');
      rl.close();
      return { skip: true };
    }

    const city = await ask('  City [Chicago]: ');
    const state = await ask('  State [IL]: ');
    const zipCode = await ask('  Zip Code: ');
    const neighborhood = await ask('  Neighborhood (optional): ');

    rl.close();

    return {
      street: street.trim(),
      city: city.trim() || 'Chicago',
      state: state.trim() || 'IL',
      zipCode: zipCode.trim(),
      country: 'USA',
      neighborhood: neighborhood.trim()
    };
  } catch (error) {
    rl.close();
    throw error;
  }
}

// Run migration
console.log('Starting restaurant location migration...\n');
migrateRestaurants().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
