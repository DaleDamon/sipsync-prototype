/**
 * Script to update known restaurants with real addresses
 *
 * Usage: node scripts/updateKnownRestaurants.js
 */

const geocoding = require('../services/geocoding');
require('dotenv').config();

// Use existing Firebase initialization
const { db } = require('../firebase');

// Known restaurant addresses
const knownRestaurants = {
  'Quartino': {
    address: {
      street: '626 N State St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60654',
      country: 'USA',
      neighborhood: 'River North'
    },
    contact: {
      phone: '+1 (312) 698-5000',
      website: 'https://www.quartinochicago.com'
    }
  },
  'Siena Tavern': {
    address: {
      street: '51 W Kinzie St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60654',
      country: 'USA',
      neighborhood: 'River North'
    },
    contact: {
      phone: '+1 (312) 595-1322',
      website: 'https://www.sienatavern.com'
    }
  },
  'Monteverde': {
    address: {
      street: '1020 W Madison St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60607',
      country: 'USA',
      neighborhood: 'West Loop'
    },
    contact: {
      phone: '+1 (312) 888-3041',
      website: 'https://monteverdechicago.com'
    }
  },
  'Ema': {
    address: {
      street: '74 W Illinois St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60654',
      country: 'USA',
      neighborhood: 'River North'
    },
    contact: {
      phone: '+1 (312) 527-5586',
      website: 'https://emarestaurants.com'
    }
  },
  'The Dearborn': {
    address: {
      street: '145 N Dearborn St',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60602',
      country: 'USA',
      neighborhood: 'The Loop'
    },
    contact: {
      phone: '+1 (312) 384-1242',
      website: 'https://www.thedearborntavern.com'
    }
  }
};

async function updateRestaurants() {
  console.log('\n========================================');
  console.log('Known Restaurants Update Tool');
  console.log('========================================\n');

  try {
    const snapshot = await db.collection('restaurants').get();

    if (snapshot.empty) {
      console.log('No restaurants found in the database.');
      return;
    }

    console.log(`Found ${snapshot.size} restaurant(s) in database\n`);

    let updated = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const restaurant = doc.data();
      const restaurantId = doc.id;

      console.log(`\n========================================`);
      console.log(`Restaurant: ${restaurant.name}`);
      console.log(`ID: ${restaurantId}`);

      // Check if we have data for this restaurant
      const knownData = knownRestaurants[restaurant.name];

      if (!knownData) {
        console.log('⚠ No address data available, skipping');
        skipped++;
        continue;
      }

      // Check if restaurant already has proper address
      if (restaurant.address && restaurant.address.street) {
        console.log('✓ Already has complete address, skipping');
        console.log(`  Address: ${restaurant.address.street}, ${restaurant.address.city}, ${restaurant.address.state} ${restaurant.address.zipCode}`);
        skipped++;
        continue;
      }

      console.log('→ Updating with known address...');
      console.log(`  Address: ${knownData.address.street}, ${knownData.address.city}, ${knownData.address.state} ${knownData.address.zipCode}`);

      try {
        // Geocode address
        console.log('→ Geocoding address...');
        const coords = await geocoding.geocodeAddress(knownData.address);

        console.log(`✓ Geocoded successfully:`);
        console.log(`  Coordinates: lat=${coords.latitude}, lng=${coords.longitude}`);
        console.log(`  Accuracy: ${coords.accuracy}`);
        console.log(`  Formatted: ${coords.formattedAddress}`);

        // Update restaurant document
        const updateData = {
          address: knownData.address,
          coordinates: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            source: process.env.GEOCODING_PROVIDER || 'google',
            lastUpdated: new Date().toISOString()
          },
          contact: knownData.contact,
          city: knownData.address.city,
          // Backward compatibility - keep old fields populated
          latitude: coords.latitude,
          longitude: coords.longitude
        };

        await doc.ref.update(updateData);

        console.log('✓ Restaurant updated successfully');
        updated++;
      } catch (err) {
        console.error(`✗ Error processing ${restaurant.name}:`, err.message);
        skipped++;
      }
    }

    console.log('\n========================================');
    console.log('Update Complete!');
    console.log(`Updated: ${updated}, Skipped: ${skipped}`);
    console.log('========================================\n');
  } catch (error) {
    console.error('Fatal error during update:', error);
  }

  process.exit(0);
}

// Run update
console.log('Starting known restaurants update...\\n');
updateRestaurants().catch(error => {
  console.error('Update failed:', error);
  process.exit(1);
});
