const { db } = require('../firebase');

/**
 * Migration script to ensure all wines have required fields.
 * Adds missing 'type' field to wines and validates other fields.
 */

async function migrateWineFields() {
  console.log('Starting wine field migration...\n');

  try {
    // Get all restaurants
    const restaurantsSnapshot = await db.collection('restaurants').get();
    let totalWinesUpdated = 0;
    let totalWinesChecked = 0;

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      const restaurantName = restaurantDoc.data().name || 'Unknown';

      console.log(`\nProcessing restaurant: ${restaurantName} (${restaurantId})`);

      // Get all wines for this restaurant
      const winesSnapshot = await db
        .collection('restaurants')
        .doc(restaurantId)
        .collection('wines')
        .get();

      console.log(`  Found ${winesSnapshot.size} wines`);

      for (const wineDoc of winesSnapshot.docs) {
        const wineId = wineDoc.id;
        const wineData = wineDoc.data();
        const wineName = wineData.name || 'Unknown';
        let needsUpdate = false;
        const updates = {};

        totalWinesChecked++;

        // Check for missing or invalid fields
        const requiredFields = ['name', 'acidity', 'tannins', 'bodyWeight', 'sweetnessLevel', 'price'];

        // Infer type from wine data if missing
        if (!wineData.type) {
          // Try to infer type from name or other characteristics
          let inferredType = inferWineType(wineData, wineName);
          updates.type = inferredType;
          needsUpdate = true;
          console.log(`    ⚠️  Wine: "${wineName}" - Missing type field, inferred as: ${inferredType}`);
        }

        // Check for flavorProfile array
        if (!wineData.flavorProfile || !Array.isArray(wineData.flavorProfile)) {
          updates.flavorProfile = wineData.flavorProfile || [];
          needsUpdate = true;
          console.log(`    ⚠️  Wine: "${wineName}" - Invalid flavorProfile`);
        }

        // Ensure all required string fields are present
        for (const field of requiredFields) {
          if (!wineData[field]) {
            console.log(`    ⚠️  Wine: "${wineName}" - Missing ${field}`);
          }
        }

        // Update the wine document if needed
        if (needsUpdate) {
          await db
            .collection('restaurants')
            .doc(restaurantId)
            .collection('wines')
            .doc(wineId)
            .update(updates);

          totalWinesUpdated++;
          console.log(`    ✓ Updated: ${wineName}`);
        } else {
          console.log(`    ✓ Valid: ${wineName}`);
        }
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Migration complete!`);
    console.log(`Total wines checked: ${totalWinesChecked}`);
    console.log(`Total wines updated: ${totalWinesUpdated}`);
    console.log(`${'='.repeat(50)}\n`);

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Infer wine type from name and characteristics
 */
function inferWineType(wineData, wineName) {
  const name = wineName.toLowerCase();

  // Check name for type indicators
  if (name.includes('red') || name.includes('cabernet') || name.includes('merlot') ||
      name.includes('pinot noir') || name.includes('shiraz') || name.includes('syrah') ||
      name.includes('zinfandel') || name.includes('sangiovese') || name.includes('nebbiolo')) {
    return 'red';
  }

  if (name.includes('white') || name.includes('chardonnay') || name.includes('sauvignon') ||
      name.includes('riesling') || name.includes('pinot grigio') || name.includes('chenin') ||
      name.includes('albariño') || name.includes('gewurztraminer')) {
    return 'white';
  }

  if (name.includes('rosé') || name.includes('rose')) {
    return 'rosé';
  }

  if (name.includes('sparkling') || name.includes('champagne') || name.includes('prosecco') ||
      name.includes('cava') || name.includes('moscato')) {
    return 'sparkling';
  }

  if (name.includes('dessert') || name.includes('port') || name.includes('ice wine')) {
    return 'dessert';
  }

  // Check tannins - high tannins usually indicate red wine
  if (wineData.tannins === 'high' || wineData.tannins === 'medium-high') {
    return 'red';
  }

  // Check body weight - full body often red, light often white
  if (wineData.bodyWeight === 'full' && !name.includes('white')) {
    return 'red';
  }

  if (wineData.bodyWeight === 'light') {
    return 'white';
  }

  // Default to red if uncertain
  console.log(`      Note: Could not determine type for "${wineName}", defaulting to red`);
  return 'red';
}

// Run the migration
migrateWineFields();
