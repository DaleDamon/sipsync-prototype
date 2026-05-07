function getWineDisplayName(wine) {
  const parts = [];
  if (wine.year && wine.year.trim()) parts.push(wine.year);
  if (wine.producer && wine.producer.trim()) parts.push(wine.producer);
  if (wine.varietal && wine.varietal.trim()) parts.push(wine.varietal);
  return parts.join(' ') || wine.name || 'Unnamed Wine';
}

function calculateMatchScore(userPreferences, wine) {
  let totalScore = 0;
  let categoryCount = 0;

  if (userPreferences.acidity) {
    totalScore += userPreferences.acidity === wine.acidity ? 1 : 0.5;
    categoryCount++;
  }

  if (userPreferences.tannins) {
    totalScore += userPreferences.tannins === wine.tannins ? 1 : 0.5;
    categoryCount++;
  }

  if (userPreferences.bodyWeight) {
    totalScore += userPreferences.bodyWeight === wine.bodyWeight ? 1 : 0.5;
    categoryCount++;
  }

  if (userPreferences.flavorNotes && userPreferences.flavorNotes.length > 0) {
    const flavorProfile = wine.flavorProfile || [];
    const matchedFlavors = userPreferences.flavorNotes.filter(f => flavorProfile.includes(f));
    totalScore += matchedFlavors.length / userPreferences.flavorNotes.length;
    categoryCount++;
  }

  if (userPreferences.sweetness) {
    totalScore += userPreferences.sweetness === wine.sweetnessLevel ? 1 : 0.5;
    categoryCount++;
  }

  if (userPreferences.priceRange) {
    const { min, max } = userPreferences.priceRange;
    const priceToCheck = userPreferences.btgOnly && wine.glassPrice ? wine.glassPrice : wine.price;
    totalScore += priceToCheck >= min && priceToCheck <= max ? 1 : 0.5;
    categoryCount++;
  }

  if (userPreferences.wineType && userPreferences.wineType !== 'any') {
    totalScore += userPreferences.wineType === wine.type ? 1 : 0;
    categoryCount++;
  }

  return categoryCount > 0 ? totalScore / categoryCount : 0;
}

module.exports = { getWineDisplayName, calculateMatchScore };
