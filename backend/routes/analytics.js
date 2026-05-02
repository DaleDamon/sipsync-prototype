const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// GET /api/analytics/popular-wines
// Get the most selected wines based on user pairing history
router.get('/popular-wines', async (req, res) => {
  try {
    const wineSelectionCount = {};

    // Single collectionGroup query across all users' pairing_history
    const pairingHistorySnapshot = await db.collectionGroup('pairing_history').get();

    pairingHistorySnapshot.forEach((pairingDoc) => {
      const pairing = pairingDoc.data();
      const { wineName, restaurantName } = pairing;

      const displayName = wineName || 'Unnamed Wine';
      const key = displayName;

      if (!wineSelectionCount[key]) {
        wineSelectionCount[key] = {
          count: 0,
          displayName,
          wineName,
          restaurantName: restaurantName || '',
        };
      }
      wineSelectionCount[key].count += 1;
    });

    // Sort by selection count and return top 20
    const popularWines = Object.values(wineSelectionCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map((wine) => {
        return {
          wineName: wine.displayName,
          selectionCount: wine.count,
          restaurantName: wine.restaurantName,
        };
      });

    res.json({
      popularWines,
      totalCount: popularWines.length,
    });
  } catch (error) {
    console.error('Error getting popular wines:', error);
    res.status(500).json({ error: 'Failed to get popular wines' });
  }
});

// GET /api/analytics/top-pairings
// Get the highest-scoring food and wine pairings
router.get('/top-pairings', async (req, res) => {
  try {
    const restaurantsSnapshot = await db.collection('restaurants').get();
    const allPairings = [];

    // Iterate through all restaurants and collect pairings
    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const pairingsSnapshot = await db
        .collection('restaurants')
        .doc(restaurantDoc.id)
        .collection('pairings')
        .get();

      for (const pairingDoc of pairingsSnapshot.docs) {
        const pairing = pairingDoc.data();

        // Fetch wine details
        const wineDoc = await db
          .collection('restaurants')
          .doc(restaurantDoc.id)
          .collection('wines')
          .doc(pairing.wineId)
          .get();

        // Fetch food item details
        const foodDoc = await db
          .collection('restaurants')
          .doc(restaurantDoc.id)
          .collection('foodItems')
          .doc(pairing.foodItemId)
          .get();

        if (wineDoc.exists && foodDoc.exists) {
          allPairings.push({
            pairingId: pairingDoc.id,
            pairingScore: pairing.pairingScore || 0,
            pairingReason: pairing.pairingReason,
            wine: {
              name: wineDoc.data().name,
              type: wineDoc.data().type,
              price: wineDoc.data().price,
            },
            foodItem: {
              name: foodDoc.data().name,
              description: foodDoc.data().description,
            },
          });
        }
      }
    }

    // Sort by pairing score and return top 10
    const topPairings = allPairings
      .sort((a, b) => b.pairingScore - a.pairingScore)
      .slice(0, 10);

    res.json({
      topPairings,
      totalCount: topPairings.length,
    });
  } catch (error) {
    console.error('Error getting top pairings:', error);
    res.status(500).json({ error: 'Failed to get top pairings' });
  }
});

// GET /api/analytics/restaurant-stats
// Get overall restaurant and wine statistics
router.get('/restaurant-stats', async (req, res) => {
  try {
    const winesByType = { red: 0, white: 0, rosé: 0, sparkling: 0, other: 0 };

    // Run all three collection-level queries in parallel
    const [restaurantsSnapshot, winesSnapshot, foodSnapshot] = await Promise.all([
      db.collection('restaurants').get(),
      db.collectionGroup('wines').get(),
      db.collectionGroup('foodItems').get(),
    ]);

    const cities = new Set();
    restaurantsSnapshot.forEach(doc => {
      if (doc.data().city) cities.add(doc.data().city);
    });

    winesSnapshot.forEach(doc => {
      const wineType = doc.data().type || 'other';
      if (wineType in winesByType) winesByType[wineType] += 1;
      else winesByType['other'] += 1;
    });

    res.json({
      totalRestaurants: restaurantsSnapshot.size,
      totalWines: winesSnapshot.size,
      totalFoodItems: foodSnapshot.size,
      totalCities: cities.size,
      cities: Array.from(cities),
      winesByType,
    });
  } catch (error) {
    console.error('Error getting restaurant stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// GET /api/analytics/preference-trends
// Get preference trends based on actual wine selections (Confirm Selection clicks)
router.get('/preference-trends', async (req, res) => {
  try {
    const trends = {
      acidity: { low: 0, medium: 0, high: 0 },
      tannins: { low: 0, medium: 0, high: 0 },
      bodyWeight: { light: 0, medium: 0, full: 0 },
      sweetnessLevel: { dry: 0, medium: 0, sweet: 0 },
      wineTypes: {},
    };
    let totalSelections = 0;

    // Single collectionGroup query across all users' pairing_history
    const pairingHistorySnapshot = await db.collectionGroup('pairing_history').get();

    pairingHistorySnapshot.forEach((pairingDoc) => {
      const pairing = pairingDoc.data();
      totalSelections++;

      if (pairing.acidity && trends.acidity[pairing.acidity] !== undefined) {
        trends.acidity[pairing.acidity] += 1;
      }
      if (pairing.tannins && trends.tannins[pairing.tannins] !== undefined) {
        trends.tannins[pairing.tannins] += 1;
      }
      if (pairing.bodyWeight && trends.bodyWeight[pairing.bodyWeight] !== undefined) {
        trends.bodyWeight[pairing.bodyWeight] += 1;
      }
      if (pairing.sweetnessLevel && trends.sweetnessLevel[pairing.sweetnessLevel] !== undefined) {
        trends.sweetnessLevel[pairing.sweetnessLevel] += 1;
      }
      if (pairing.wineType) {
        trends.wineTypes[pairing.wineType] = (trends.wineTypes[pairing.wineType] || 0) + 1;
      }
    });

    res.json({
      trends,
      totalSelections,
      mostPopularAcidity: Object.entries(trends.acidity).sort((a, b) => b[1] - a[1])[0],
      mostPopularTannins: Object.entries(trends.tannins).sort((a, b) => b[1] - a[1])[0],
      mostPopularBodyWeight: Object.entries(trends.bodyWeight).sort((a, b) => b[1] - a[1])[0],
      mostPopularSweetness: Object.entries(trends.sweetnessLevel).sort((a, b) => b[1] - a[1])[0],
      mostPopularWineType: Object.entries(trends.wineTypes).sort((a, b) => b[1] - a[1])[0],
    });
  } catch (error) {
    console.error('Error getting preference trends:', error);
    res.status(500).json({ error: 'Failed to get preference trends' });
  }
});

// ─────────────────────────────────────────────────────────
// RESTAURANT ANALYTICS
// ─────────────────────────────────────────────────────────

const { adminAuth } = require('../middleware/adminAuth');
const { FieldValue } = require('firebase-admin/firestore');

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
    : Math.round(sorted[mid] * 100) / 100;
}

// GET /api/analytics/restaurant/:restaurantId?from=&to=
// Compute list-health metrics for a single restaurant
router.get('/restaurant/:restaurantId', adminAuth, async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { from, to } = req.query;

    // Enforce: non-superadmin can only see their own restaurant
    if (req.admin.role !== 'superadmin' && req.admin.restaurantId !== restaurantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch all wines
    const winesSnap = await db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('wines')
      .get();

    const wines = winesSnap.docs.map(d => d.data());
    const total = wines.length;

    if (total === 0) {
      return res.json({
        totalWines: 0, btgCoverage: 0,
        redPct: 0, whitePct: 0, sparklingPct: 0, rosePct: 0, otherPct: 0,
        priceRangeTiers: { entry: false, mid: false, premium: false },
        medianBottlePrice: 0, btgMarkupRatio: null,
        varietalDistribution: [], uploadHistory: []
      });
    }

    // BTG Coverage %
    const btgWines = wines.filter(w => parseFloat(w.glassPrice) > 0);
    const btgCoverage = Math.round((btgWines.length / total) * 100);

    // Wine type breakdown
    const typeCounts = {};
    wines.forEach(w => {
      const t = (w.type || 'unknown').toLowerCase().trim();
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const redPct = Math.round(((typeCounts['red'] || 0) / total) * 100);
    const whitePct = Math.round(((typeCounts['white'] || 0) / total) * 100);
    const sparklingPct = Math.round(((typeCounts['sparkling'] || 0) / total) * 100);
    const rosePct = Math.round(((typeCounts['rosé'] || typeCounts['rose'] || 0) / total) * 100);
    const otherPct = Math.max(0, 100 - redPct - whitePct - sparklingPct - rosePct);

    // Bottle price tiers (bottle price only, not glass price)
    const pricedWines = wines.filter(w => parseFloat(w.price) > 0);
    const bottlePrices = pricedWines.map(w => parseFloat(w.price)).filter(p => !isNaN(p));
    const priceRangeTiers = {
      entry:   bottlePrices.filter(p => p < 75).length,
      mid:     bottlePrices.filter(p => p >= 75 && p <= 150).length,
      premium: bottlePrices.filter(p => p > 150).length,
    };

    // Median Bottle Price
    const medianBottlePrice = median(bottlePrices);

    // BTG Markup Ratio (glassPrice * 5 / bottlePrice)
    const markupWines = wines.filter(w => parseFloat(w.glassPrice) > 0 && parseFloat(w.price) > 0);
    let btgMarkupRatio = null;
    let btgMarkupConsistency = null;
    if (markupWines.length > 0) {
      const ratios = markupWines.map(w => (parseFloat(w.glassPrice) * 5) / parseFloat(w.price));
      const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      btgMarkupRatio = Math.round(mean * 100) / 100;
      if (ratios.length > 1) {
        const variance = ratios.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ratios.length;
        const stdDev = Math.sqrt(variance);
        btgMarkupConsistency = Math.round(Math.max(0, 1 - (stdDev / mean)) * 100) / 100;
      } else {
        btgMarkupConsistency = 1; // single BTG wine = perfectly consistent by definition
      }
    }

    // KPI 1: Glass Pour Profit Index = btgCoverage% × avgMarkupRatio
    const glassPourProfitIndex = btgMarkupRatio != null
      ? Math.round(btgCoverage * btgMarkupRatio * 100) / 100
      : null;

    // KPI 2: Tier Conversion Rate — % of BTG wines in each price tier
    const btgPricedWines = markupWines; // already has both glassPrice and price
    const btgBottlePrices = btgPricedWines.map(w => parseFloat(w.price));
    const tierConversion = {
      entry:   btgBottlePrices.length > 0 ? Math.round((btgBottlePrices.filter(p => p < 75).length   / Math.max(priceRangeTiers.entry, 1)) * 100) : 0,
      mid:     btgBottlePrices.length > 0 ? Math.round((btgBottlePrices.filter(p => p >= 75 && p <= 150).length / Math.max(priceRangeTiers.mid, 1)) * 100) : 0,
      premium: btgBottlePrices.length > 0 ? Math.round((btgBottlePrices.filter(p => p > 150).length  / Math.max(priceRangeTiers.premium, 1)) * 100) : 0,
    };

    // KPI 3: Varietal Concentration Risk (HHI) — lower = more diverse
    const varietalCounts = {};
    wines.forEach(w => {
      const v = (w.varietal || 'Unknown').trim();
      varietalCounts[v] = (varietalCounts[v] || 0) + 1;
    });
    const hhi = Object.values(varietalCounts)
      .reduce((sum, count) => sum + Math.pow(count / total, 2) * 10000, 0);
    const varietalHHI = Math.round(hhi);

    // KPI 4: Price Spread Index — p90 / p10
    let priceSpreadIndex = null;
    if (bottlePrices.length >= 10) {
      const sortedPrices = [...bottlePrices].sort((a, b) => a - b);
      const p10 = sortedPrices[Math.floor(sortedPrices.length * 0.10)];
      const p90 = sortedPrices[Math.floor(sortedPrices.length * 0.90)];
      priceSpreadIndex = p10 > 0 ? Math.round((p90 / p10) * 100) / 100 : null;
    }

    // Varietal Distribution — top 10
    const varietalDistribution = Object.entries(varietalCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Upload history (filtered by date range)
    let historyQuery = db
      .collection('restaurants')
      .doc(restaurantId)
      .collection('uploadHistory')
      .orderBy('createdAt', 'desc')
      .limit(50);

    const historySnap = await historyQuery.get();
    let uploadHistory = historySnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (from || to) {
      const fromDate = from ? new Date(from) : new Date(0);
      const toDate = to ? new Date(to) : new Date();
      toDate.setHours(23, 59, 59, 999);
      uploadHistory = uploadHistory.filter(h => {
        const created = h.createdAt?.toDate ? h.createdAt.toDate() : new Date(h.createdAt);
        return created >= fromDate && created <= toDate;
      });
    }

    res.json({
      totalWines: total,
      btgCoverage,
      redPct, whitePct, sparklingPct, rosePct, otherPct,
      priceRangeTiers,
      medianBottlePrice,
      btgMarkupRatio,
      varietalDistribution,
      uploadHistory,
      // 5 KPIs
      glassPourProfitIndex,
      tierConversion,
      varietalHHI,
      priceSpreadIndex,
      btgMarkupConsistency,
    });
  } catch (err) {
    console.error('[Analytics] restaurant metrics error:', err);
    res.status(500).json({ error: 'Failed to compute restaurant analytics' });
  }
});

// GET /api/analytics/system-benchmarks
// Returns system-wide averages (cached for 24 h in analytics_cache/system)
router.get('/system-benchmarks', adminAuth, async (req, res) => {
  try {
    // Check cache
    const cacheRef = db.collection('analytics_cache').doc('system');
    const cacheDoc = await cacheRef.get();
    if (cacheDoc.exists) {
      const cached = cacheDoc.data();
      const age = Date.now() - cached.computedAt.toMillis();
      if (age < 24 * 60 * 60 * 1000) {
        return res.json(cached);
      }
    }

    // Compute fresh — collect per-restaurant values then take median (not mean) to avoid skew
    const restSnap = await db.collection('restaurants').get();
    const vals = { btgCoverage: [], medianBottlePrice: [], glassPourProfitIndex: [], varietalHHI: [], priceSpreadIndex: [], btgMarkupConsistency: [], tierConversionMid: [] };

    for (const restDoc of restSnap.docs) {
      const winesSnap = await db
        .collection('restaurants')
        .doc(restDoc.id)
        .collection('wines')
        .get();
      const wines = winesSnap.docs.map(d => d.data());
      if (wines.length === 0) continue;

      const total = wines.length;
      const btg = Math.round((wines.filter(w => parseFloat(w.glassPrice) > 0).length / total) * 100);
      const prices = wines.filter(w => parseFloat(w.price) > 0).map(w => parseFloat(w.price)).filter(p => !isNaN(p));
      const medPrice = median(prices);

      vals.btgCoverage.push(btg);
      vals.medianBottlePrice.push(medPrice);

      // Glass Pour Profit Index + Consistency + Tier Conversion Mid
      const markupW = wines.filter(w => parseFloat(w.glassPrice) > 0 && parseFloat(w.price) > 0);
      if (markupW.length > 0) {
        const ratios = markupW.map(w => (parseFloat(w.glassPrice) * 5) / parseFloat(w.price));
        const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        vals.glassPourProfitIndex.push(btg * mean);
        // Consistency
        if (ratios.length > 1) {
          const variance = ratios.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ratios.length;
          const consistency = Math.max(0, 1 - (Math.sqrt(variance) / mean));
          vals.btgMarkupConsistency.push(consistency);
        }
        // Mid-tier BTG conversion
        const btgPrices = markupW.map(w => parseFloat(w.price));
        const midBtg = btgPrices.filter(p => p >= 75 && p <= 150).length;
        const midTotal = prices.filter(p => p >= 75 && p <= 150).length;
        if (midTotal > 0) {
          vals.tierConversionMid.push(Math.round((midBtg / midTotal) * 100));
        }
      }

      // HHI
      const vCounts = {};
      wines.forEach(w => { const v = (w.varietal || 'Unknown').trim(); vCounts[v] = (vCounts[v] || 0) + 1; });
      const hhi = Object.values(vCounts).reduce((s, c) => s + Math.pow(c / total, 2) * 10000, 0);
      vals.varietalHHI.push(hhi);

      // Price Spread Index
      if (prices.length >= 10) {
        const sp = [...prices].sort((a, b) => a - b);
        const p10 = sp[Math.floor(sp.length * 0.10)];
        const p90 = sp[Math.floor(sp.length * 0.90)];
        if (p10 > 0) { vals.priceSpreadIndex.push(p90 / p10); }
      }
    }

    const med = (key, decimals = 2) => {
      const arr = vals[key];
      if (!arr || arr.length === 0) return 0;
      const m = median(arr);
      return Math.round(m * Math.pow(10, decimals)) / Math.pow(10, decimals);
    };

    const result = {
      avgBtgCoverage:          med('btgCoverage', 0),
      avgMedianBottlePrice:    med('medianBottlePrice', 2),
      avgGlassPourProfitIndex: med('glassPourProfitIndex', 2),
      avgVarietalHHI:          med('varietalHHI', 0),
      avgPriceSpreadIndex:     med('priceSpreadIndex', 2),
      avgBtgMarkupConsistency: med('btgMarkupConsistency', 2),
      avgTierConversionMid:    med('tierConversionMid', 0),
    };

    result.computedAt = new Date();
    result.restaurantCount = vals.btgCoverage.length;

    await cacheRef.set({ ...result, computedAt: FieldValue.serverTimestamp() });

    res.json(result);
  } catch (err) {
    console.error('[Analytics] system-benchmarks error:', err);
    res.status(500).json({ error: 'Failed to compute system benchmarks' });
  }
});

// GET /api/analytics/restaurant/:restaurantId/export.csv
// Download restaurant analytics as CSV
router.get('/restaurant/:restaurantId/export.csv', adminAuth, async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (req.admin.role !== 'superadmin' && req.admin.restaurantId !== restaurantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const winesSnap = await db
      .collection('restaurants').doc(restaurantId).collection('wines').get();
    const wines = winesSnap.docs.map(d => d.data());
    const total = wines.length;

    if (total === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${restaurantId}.csv"`);
      return res.send('Metric,Value\nTotal Wines,0\n');
    }

    const btgCoverage = Math.round((wines.filter(w => parseFloat(w.glassPrice) > 0).length / total) * 100);
    const priced = wines.filter(w => parseFloat(w.price) > 0);
    const hasPricesPct = Math.round((priced.length / total) * 100);
    const listHealthScore = Math.round(btgCoverage * 0.5 + hasPricesPct * 0.5);
    const prices = priced.map(w => parseFloat(w.price)).filter(p => !isNaN(p));
    const medianBottlePrice = median(prices).toFixed(2);

    const varietalCounts = {};
    wines.forEach(w => {
      const v = (w.varietal || 'Unknown').trim();
      varietalCounts[v] = (varietalCounts[v] || 0) + 1;
    });
    const topVarietals = Object.entries(varietalCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    let csv = 'Metric,Value\n';
    csv += `Total Wines,${total}\n`;
    csv += `BTG Coverage %,${btgCoverage}%\n`;
    csv += `List Health Score,${listHealthScore}/100\n`;
    csv += `Median Bottle Price,$${medianBottlePrice}\n`;
    csv += '\nVarietal,Count\n';
    topVarietals.forEach(([name, count]) => { csv += `${name},${count}\n`; });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-${restaurantId}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[Analytics] CSV export error:', err);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// ─────────────────────────────────────────────────────────
// USER ANALYTICS
// ─────────────────────────────────────────────────────────

// GET /api/analytics/user/:userId?from=&to=
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    // Fetch user doc for preferences
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Fetch pairing history
    const histSnap = await db
      .collection('users').doc(userId).collection('pairing_history')
      .orderBy('saved_at', 'desc').limit(200).get();

    const allPairings = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter by date range
    const pairings = allPairings.filter(p => {
      const d = p.saved_at?.toDate ? p.saved_at.toDate() : new Date(p.saved_at);
      return d >= fromDate && d <= toDate;
    });

    const totalPairings = pairings.length;

    const avgMatchScore = totalPairings > 0
      ? Math.round((pairings.reduce((sum, p) => sum + (p.matchScore || 0), 0) / totalPairings) * 100)
      : 0;

    // Match score over time (last 20, chronological)
    const matchScoreOverTime = pairings.slice(0, 20).reverse().map(p => ({
      date: (p.saved_at?.toDate ? p.saved_at.toDate() : new Date(p.saved_at)).toLocaleDateString(),
      score: Math.round((p.matchScore || 0) * 100),
    }));

    // Top varietals from wineName (best effort — use wineType if varietal not stored)
    const varietalCounts = {};
    pairings.forEach(p => {
      const v = p.wineType || p.varietal || 'Unknown';
      varietalCounts[v] = (varietalCounts[v] || 0) + 1;
    });
    const topVarietals = Object.entries(varietalCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Session count
    const sessionsSnap = await db
      .collection('users').doc(userId).collection('sessions').get();
    const totalSessions = sessionsSnap.size;

    // Restaurants explored (from events subcollection)
    const eventsSnap = await db
      .collection('users').doc(userId).collection('events')
      .where('eventType', '==', 'restaurant_view').get();
    const restaurantIds = new Set(eventsSnap.docs.map(d => d.data().restaurantId).filter(Boolean));
    const restaurantsExplored = restaurantIds.size;

    // ── Wine type breakdown ──
    const wineTypeCounts = {};
    pairings.forEach(p => {
      const t = p.wineType || 'unknown';
      wineTypeCounts[t] = (wineTypeCounts[t] || 0) + 1;
    });
    const wineTypeBreakdown = Object.entries(wineTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, pct: totalPairings > 0 ? Math.round(count / totalPairings * 100) : 0 }));
    const dominantType = wineTypeBreakdown[0]?.type || null;

    // ── Comfort zone score ──
    const adventurousSaves = pairings.filter(p => (p.matchScore || 0) < 0.85).length;
    const adventurousPct = totalPairings > 0 ? Math.round(adventurousSaves / totalPairings * 100) : 0;
    const comfortZoneLabel = adventurousPct >= 40 ? 'Adventurous Sipper'
      : adventurousPct >= 20 ? 'Curious Explorer'
      : 'Profile Loyalist';

    // ── Favorite restaurant ──
    const restCounts = {};
    const restNames = {};
    pairings.forEach(p => {
      if (p.restaurantId) {
        restCounts[p.restaurantId] = (restCounts[p.restaurantId] || 0) + 1;
        restNames[p.restaurantId] = p.restaurantName || p.restaurantId;
      }
    });
    const favRestId = Object.entries(restCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const favoriteRestaurant = favRestId
      ? { id: favRestId, name: restNames[favRestId], count: restCounts[favRestId] }
      : null;

    // ── Price tendency ──
    const pricedPairings = pairings.filter(p => p.price && p.price > 0);
    const priceTendency = pricedPairings.length > 0 ? {
      avg: Math.round(pricedPairings.reduce((s, p) => s + p.price, 0) / pricedPairings.length),
      min: Math.round(Math.min(...pricedPairings.map(p => p.price))),
      max: Math.round(Math.max(...pricedPairings.map(p => p.price))),
      count: pricedPairings.length,
    } : null;

    // ── Regions explored ──
    const regionsSet = new Set();
    pairings.forEach(p => { if (p.region) regionsSet.add(p.region); });
    const regionsExploredList = [...regionsSet];

    // ── Palate reality check ──
    const quizPrefs = userData.savedPreferences?.[0] || null;
    let palateRealityCheck = null;
    if (quizPrefs && totalPairings >= 3) {
      const dimMap = [
        { dim: 'acidity',      quizKey: 'acidity',      pairingKey: 'acidity' },
        { dim: 'tannins',      quizKey: 'tannins',      pairingKey: 'tannins' },
        { dim: 'body',         quizKey: 'bodyWeight',   pairingKey: 'bodyWeight' },
        { dim: 'sweetness',    quizKey: 'sweetness',    pairingKey: 'sweetnessLevel' },
        { dim: 'wine type',    quizKey: 'wineType',     pairingKey: 'wineType' },
      ];
      const drifts = [];
      dimMap.forEach(({ dim, quizKey, pairingKey }) => {
        const quizVal = quizPrefs[quizKey];
        if (!quizVal) return;
        const counts = {};
        pairings.forEach(p => {
          const v = p[pairingKey];
          if (v) counts[v] = (counts[v] || 0) + 1;
        });
        const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
        if (mostCommon && mostCommon !== quizVal) {
          drifts.push({ dimension: dim, quiz: quizVal, actual: mostCommon });
        }
      });
      palateRealityCheck = { drifts, hasDrift: drifts.length > 0 };
    }

    // ── Next wine recommendation ──
    let nextWineRecommendation = null;
    if (quizPrefs && totalPairings > 0 && favRestId) {
      try {
        const savedWineIds = new Set(allPairings.map(p => p.wineId));
        const candidateRestIds = Object.entries(restCounts)
          .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);

        for (const rId of candidateRestIds) {
          const winesSnap = await db.collection('restaurants').doc(rId).collection('wines').get();
          let bestWine = null, bestScore = 0;
          winesSnap.forEach(doc => {
            const w = { wineId: doc.id, ...doc.data() };
            if (savedWineIds.has(w.wineId)) return;
            let score = 0, factors = 0;
            if (quizPrefs.wineType && w.type)           { score += w.type === quizPrefs.wineType ? 1 : 0; factors++; }
            if (quizPrefs.acidity && w.acidity)         { score += w.acidity === quizPrefs.acidity ? 1 : 0; factors++; }
            if (quizPrefs.tannins && w.tannins)         { score += w.tannins === quizPrefs.tannins ? 1 : 0; factors++; }
            if (quizPrefs.bodyWeight && w.bodyWeight)   { score += w.bodyWeight === quizPrefs.bodyWeight ? 1 : 0; factors++; }
            const matchPct = factors > 0 ? score / factors : 0;
            if (matchPct > bestScore) { bestScore = matchPct; bestWine = w; }
          });
          if (bestWine && bestScore >= 0.6) {
            nextWineRecommendation = {
              wineId: bestWine.wineId,
              wineName: [bestWine.year, bestWine.producer, bestWine.varietal].filter(Boolean).join(' '),
              wineType: bestWine.type,
              region: bestWine.region || '',
              price: bestWine.price || 0,
              matchPct: Math.round(bestScore * 100),
              restaurantId: rId,
              restaurantName: restNames[rId] || '',
            };
            break;
          }
        }
      } catch (_) { /* non-critical */ }
    }

    res.json({
      totalPairings,
      avgMatchScore,
      matchScoreOverTime,
      topVarietals,
      totalSessions,
      restaurantsExplored,
      preferenceProfile: userData.savedPreferences || null,
      wineTypeBreakdown,
      dominantType,
      comfortZone: { adventurousPct, label: comfortZoneLabel },
      favoriteRestaurant,
      priceTendency,
      regionsExplored: regionsExploredList,
      palateRealityCheck,
      nextWineRecommendation,
    });
  } catch (err) {
    console.error('[Analytics] user analytics error:', err);
    res.status(500).json({ error: 'Failed to compute user analytics' });
  }
});

// ─────────────────────────────────────────────────────────
// EVENT + SESSION TRACKING
// ─────────────────────────────────────────────────────────

// POST /api/analytics/event
router.post('/event', async (req, res) => {
  try {
    const { userId, eventType, restaurantId, wineId, filterState, sessionId } = req.body;
    if (!userId || !eventType) return res.status(400).json({ error: 'userId and eventType required' });

    const eventData = {
      userId,
      eventType,
      restaurantId: restaurantId || null,
      wineId: wineId || null,
      filterState: filterState || null,
      sessionId: sessionId || null,
      timestamp: FieldValue.serverTimestamp(),
    };

    // Write to both: per-user subcollection (for profile tab) and top-level (for aggregate queries)
    await Promise.all([
      db.collection('users').doc(userId).collection('events').add(eventData),
      db.collection('events').add(eventData),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[Analytics] event log error:', err);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// POST /api/analytics/session
router.post('/session', async (req, res) => {
  try {
    const { userId, sessionId, platform } = req.body;
    if (!userId || !sessionId) return res.status(400).json({ error: 'userId and sessionId required' });

    await db.collection('users').doc(userId).collection('sessions').doc(sessionId).set({
      sessionId,
      platform: platform || 'web',
      startedAt: FieldValue.serverTimestamp(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[Analytics] session log error:', err);
    res.status(500).json({ error: 'Failed to log session' });
  }
});

// ─────────────────────────────────────────────────────────
// ENGAGEMENT AGGREGATE (top-level events collection)
// ─────────────────────────────────────────────────────────

// GET /api/analytics/engagement?from=&to=
// Funnel + daily breakdown across all users
router.get('/engagement', adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    // Query top-level events collection by time range
    const snap = await db.collection('events')
      .where('timestamp', '>=', fromDate)
      .where('timestamp', '<=', toDate)
      .orderBy('timestamp', 'asc')
      .get();

    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Funnel counts
    const funnel = {
      restaurant_view: 0,
      filter_applied: 0,
      pairing_result_viewed: 0,
      wine_card_open: 0,
    };
    // Unique users per funnel step
    const funnelUsers = {
      restaurant_view: new Set(),
      filter_applied: new Set(),
      pairing_result_viewed: new Set(),
      wine_card_open: new Set(),
    };
    // Daily breakdown: { 'YYYY-MM-DD': { restaurant_view: n, ... } }
    const daily = {};
    // Top restaurants by view count
    const restaurantViews = {};
    // Unique user count
    const uniqueUsers = new Set();
    // Peak hours (0-23)
    const hourCounts = Array(24).fill(0);
    // Session depth
    const sessionEventCount = {};
    const userSessions = {};
    // Per-restaurant conversion
    const restaurantConversion = {};
    // Filter dimensions (separate breakdown per dimension)
    const filterDimensions = {
      wineType:    {},
      btgOnly:     { yes: 0, no: 0 },
      sweetness:   {},
      acidity:     {},
      tannins:     {},
      bodyWeight:  {},
      flavorNotes: {},
    };

    events.forEach(e => {
      const type = e.eventType;
      if (funnel[type] !== undefined) {
        funnel[type]++;
        if (e.userId) funnelUsers[type].add(e.userId);
      }
      if (e.userId) uniqueUsers.add(e.userId);

      // Timestamp (hoisted for reuse)
      const ts = e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp);

      // Daily breakdown
      const day = ts.toISOString().split('T')[0];
      if (!daily[day]) daily[day] = { restaurant_view: 0, filter_applied: 0, pairing_result_viewed: 0, wine_card_open: 0 };
      if (daily[day][type] !== undefined) daily[day][type]++;

      // Peak hours
      hourCounts[ts.getHours()]++;

      // Session depth
      if (e.sessionId) sessionEventCount[e.sessionId] = (sessionEventCount[e.sessionId] || 0) + 1;
      if (e.userId && e.sessionId) {
        if (!userSessions[e.userId]) userSessions[e.userId] = new Set();
        userSessions[e.userId].add(e.sessionId);
      }

      // Restaurant views
      if (type === 'restaurant_view' && e.restaurantId) {
        restaurantViews[e.restaurantId] = (restaurantViews[e.restaurantId] || 0) + 1;
      }

      // Per-restaurant conversion
      if (e.restaurantId) {
        if (!restaurantConversion[e.restaurantId]) {
          restaurantConversion[e.restaurantId] = { views: 0, results: 0, opens: 0, saves: 0 };
        }
        if (type === 'restaurant_view')       restaurantConversion[e.restaurantId].views++;
        if (type === 'pairing_result_viewed') restaurantConversion[e.restaurantId].results++;
        if (type === 'wine_card_open')        restaurantConversion[e.restaurantId].opens++;
      }

      // Filter dimensions
      if (type === 'filter_applied' && e.filterState) {
        const fs = e.filterState;
        const cap = s => s ? (s.charAt(0).toUpperCase() + s.slice(1)) : 'Any';
        // Wine type
        const wt = cap(fs.wineType === 'any' ? 'Any' : fs.wineType);
        filterDimensions.wineType[wt] = (filterDimensions.wineType[wt] || 0) + 1;
        // BTG
        filterDimensions.btgOnly[fs.btgOnly ? 'yes' : 'no']++;
        // Sweetness
        const sw = cap(fs.sweetness);
        filterDimensions.sweetness[sw] = (filterDimensions.sweetness[sw] || 0) + 1;
        // Acidity
        const ac = cap(fs.acidity);
        filterDimensions.acidity[ac] = (filterDimensions.acidity[ac] || 0) + 1;
        // Tannins
        const ta = cap(fs.tannins);
        filterDimensions.tannins[ta] = (filterDimensions.tannins[ta] || 0) + 1;
        // Body
        const bw = cap(fs.bodyWeight);
        filterDimensions.bodyWeight[bw] = (filterDimensions.bodyWeight[bw] || 0) + 1;
        // Flavor notes (each note independently)
        if (Array.isArray(fs.flavorNotes)) {
          fs.flavorNotes.forEach(note => {
            filterDimensions.flavorNotes[note] = (filterDimensions.flavorNotes[note] || 0) + 1;
          });
        }
      }
    });

    // Session depth metrics
    const sessionCounts = Object.values(sessionEventCount);
    const avgEventsPerSession = sessionCounts.length > 0
      ? Math.round((sessionCounts.reduce((a, b) => a + b, 0) / sessionCounts.length) * 10) / 10
      : 0;
    const returningUsers = Object.values(userSessions).filter(s => s.size > 1).length;
    const returningUsersPct = uniqueUsers.size > 0 ? Math.round((returningUsers / uniqueUsers.size) * 100) : 0;

    // Fetch restaurant names for top restaurants + conversion table (cap 30 unique)
    const topRestaurantIds = Object.entries(restaurantViews)
      .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
    const conversionRestaurantIds = Object.keys(restaurantConversion).slice(0, 30);
    const allNameIds = [...new Set([...topRestaurantIds, ...conversionRestaurantIds])];
    const restaurantNames = {};
    await Promise.all(allNameIds.map(async id => {
      const doc = await db.collection('restaurants').doc(id).get();
      restaurantNames[id] = doc.exists ? (doc.data().name || id) : id;
    }));

    const topRestaurants = topRestaurantIds.map(id => ({
      restaurantId: id,
      name: restaurantNames[id],
      views: restaurantViews[id],
    }));

    // Also count saves from pairing_history across users for funnel
    const usersSnap = await db.collection('users').get();
    let totalSaves = 0;
    const saveUsers = new Set();
    await Promise.all(usersSnap.docs.map(async (userDoc) => {
      const histSnap = await db.collection('users').doc(userDoc.id)
        .collection('pairing_history')
        .where('saved_at', '>=', fromDate)
        .where('saved_at', '<=', toDate)
        .get();
      if (histSnap.size > 0) {
        totalSaves += histSnap.size;
        saveUsers.add(userDoc.id);
        // Per-restaurant saves
        histSnap.docs.forEach(pDoc => {
          const rId = pDoc.data().restaurantId;
          if (rId && restaurantConversion[rId]) restaurantConversion[rId].saves++;
        });
      }
    }));

    // Daily array sorted chronologically
    const dailyArray = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    // Restaurant conversion table
    const restaurantConversionTable = Object.entries(restaurantConversion)
      .map(([id, c]) => ({
        restaurantId: id,
        name: restaurantNames[id] || id,
        views: c.views,
        results: c.results,
        opens: c.opens,
        saves: c.saves,
        conversionRate: c.views > 0 ? Math.round((c.saves / c.views) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.views - a.views);

    res.json({
      totalEvents: events.length,
      uniqueUsers: uniqueUsers.size,
      avgEventsPerSession,
      returningUsers,
      returningUsersPct,
      funnel: [
        { step: 'Restaurant Viewed', count: funnel.restaurant_view, users: funnelUsers.restaurant_view.size },
        { step: 'Filters Applied', count: funnel.filter_applied, users: funnelUsers.filter_applied.size },
        { step: 'Results Viewed', count: funnel.pairing_result_viewed, users: funnelUsers.pairing_result_viewed.size },
        { step: 'Wine Opened', count: funnel.wine_card_open, users: funnelUsers.wine_card_open.size },
        { step: 'Wine Saved', count: totalSaves, users: saveUsers.size },
      ],
      dailyActivity: dailyArray,
      topRestaurants,
      peakHours: hourCounts.map((count, hour) => ({ hour, count })),
      filterDimensions: (() => {
        const dimArray = obj => Object.entries(obj)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => ({ label, count }));
        return {
          wineType:    dimArray(filterDimensions.wineType),
          btgOnly: [
            { label: 'BTG Only',      count: filterDimensions.btgOnly.yes },
            { label: 'Show All Wines', count: filterDimensions.btgOnly.no },
          ],
          sweetness:   dimArray(filterDimensions.sweetness),
          acidity:     dimArray(filterDimensions.acidity),
          tannins:     dimArray(filterDimensions.tannins),
          bodyWeight:  dimArray(filterDimensions.bodyWeight),
          flavorNotes: dimArray(filterDimensions.flavorNotes),
          totalFilterEvents: filterDimensions.btgOnly.yes + filterDimensions.btgOnly.no,
        };
      })(),
      restaurantConversionTable,
    });
  } catch (err) {
    console.error('[Analytics] engagement error:', err);
    res.status(500).json({ error: 'Failed to compute engagement analytics' });
  }
});

// GET /api/analytics/events/export.csv?from=&to=
router.get('/events/export.csv', adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const snap = await db.collection('events')
      .where('timestamp', '>=', fromDate)
      .where('timestamp', '<=', toDate)
      .orderBy('timestamp', 'desc')
      .get();

    let csv = 'Timestamp,EventType,UserId,RestaurantId,WineId,SessionId\n';
    snap.docs.forEach(d => {
      const e = d.data();
      const ts = e.timestamp?.toDate ? e.timestamp.toDate().toISOString() : '';
      csv += `${ts},${e.eventType || ''},${e.userId || ''},${e.restaurantId || ''},${e.wineId || ''},${e.sessionId || ''}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="events-${from || 'all'}-to-${to || 'now'}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[Analytics] events export error:', err);
    res.status(500).json({ error: 'Failed to export events' });
  }
});

// POST /api/analytics/feedback
router.post('/feedback', async (req, res) => {
  try {
    const { userId, rating, text, currentScreen, sessionId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    await db.collection('feedback').add({
      userId,
      rating: rating || null,
      text: (text || '').trim(),
      currentScreen: currentScreen || null,
      sessionId: sessionId || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[Analytics] feedback error:', err);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// GET /api/analytics/feedback (admin only)
router.get('/feedback', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('feedback')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const items = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null,
    }));

    res.json({ feedback: items, count: items.length });
  } catch (err) {
    console.error('[Analytics] feedback fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// POST /api/analytics/session-end
router.post('/session-end', async (req, res) => {
  try {
    const { userId, sessionId, durationMs } = req.body;
    if (!userId || !sessionId) return res.status(400).json({ error: 'userId and sessionId required' });

    await db.collection('users').doc(userId).collection('sessions').doc(sessionId).update({
      durationMs: durationMs || null,
      endedAt: FieldValue.serverTimestamp(),
    });

    res.json({ ok: true });
  } catch (err) {
    // Session doc may not exist yet — not fatal
    res.json({ ok: true });
  }
});

module.exports = router;
