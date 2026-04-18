const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// GET /api/analytics/popular-wines
// Get the most selected wines based on user pairing history
router.get('/popular-wines', async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const wineSelectionCount = {};

    // Iterate through all users and count their wine selections
    for (const userDoc of usersSnapshot.docs) {
      const pairingHistorySnapshot = await db
        .collection('users')
        .doc(userDoc.id)
        .collection('pairing_history')
        .get();

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
    }

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
    const restaurantsSnapshot = await db.collection('restaurants').get();
    const stats = {
      totalRestaurants: 0,
      totalWines: 0,
      totalFoodItems: 0,
      cities: new Set(),
      winesByType: { red: 0, white: 0, rosé: 0, sparkling: 0, other: 0 },
    };

    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurant = restaurantDoc.data();
      stats.totalRestaurants += 1;

      if (restaurant.city) {
        stats.cities.add(restaurant.city);
      }

      // Count wines
      const winesSnapshot = await db
        .collection('restaurants')
        .doc(restaurantDoc.id)
        .collection('wines')
        .get();

      winesSnapshot.forEach((wineDoc) => {
        stats.totalWines += 1;
        const wineType = wineDoc.data().type || 'other';
        if (wineType in stats.winesByType) {
          stats.winesByType[wineType] += 1;
        } else {
          stats.winesByType['other'] += 1;
        }
      });

      // Count food items
      const foodSnapshot = await db
        .collection('restaurants')
        .doc(restaurantDoc.id)
        .collection('foodItems')
        .get();

      stats.totalFoodItems += foodSnapshot.size;
    }

    res.json({
      totalRestaurants: stats.totalRestaurants,
      totalWines: stats.totalWines,
      totalFoodItems: stats.totalFoodItems,
      totalCities: stats.cities.size,
      cities: Array.from(stats.cities),
      winesByType: stats.winesByType,
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
    const usersSnapshot = await db.collection('users').get();
    const trends = {
      acidity: { low: 0, medium: 0, high: 0 },
      tannins: { low: 0, medium: 0, high: 0 },
      bodyWeight: { light: 0, medium: 0, full: 0 },
      sweetnessLevel: { dry: 0, medium: 0, sweet: 0 },
      wineTypes: {},
    };
    let totalSelections = 0;

    // Iterate through all users' pairing history (confirmed selections)
    for (const userDoc of usersSnapshot.docs) {
      const pairingHistorySnapshot = await db
        .collection('users')
        .doc(userDoc.id)
        .collection('pairing_history')
        .get();

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
    }

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
    if (markupWines.length > 0) {
      const ratios = markupWines.map(w => (parseFloat(w.glassPrice) * 5) / parseFloat(w.price));
      btgMarkupRatio = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) / 100;
    }

    // Varietal Distribution — top 10
    const varietalCounts = {};
    wines.forEach(w => {
      const v = (w.varietal || 'Unknown').trim();
      varietalCounts[v] = (varietalCounts[v] || 0) + 1;
    });
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

    // Compute fresh
    const restSnap = await db.collection('restaurants').get();
    const totals = { btgCoverage: 0, medianBottlePrice: 0 };
    let included = 0;

    for (const restDoc of restSnap.docs) {
      const winesSnap = await db
        .collection('restaurants')
        .doc(restDoc.id)
        .collection('wines')
        .get();
      const wines = winesSnap.docs.map(d => d.data());
      if (wines.length === 0) continue;

      const btg = Math.round((wines.filter(w => parseFloat(w.glassPrice) > 0).length / wines.length) * 100);
      const prices = wines.filter(w => parseFloat(w.price) > 0).map(w => parseFloat(w.price)).filter(p => !isNaN(p));
      const medPrice = median(prices);

      totals.btgCoverage += btg;
      totals.medianBottlePrice += medPrice;
      included++;
    }

    const result = included === 0
      ? { avgBtgCoverage: 0, avgMedianBottlePrice: 0 }
      : {
          avgBtgCoverage: Math.round(totals.btgCoverage / included),
          avgMedianBottlePrice: Math.round((totals.medianBottlePrice / included) * 100) / 100,
        };

    result.computedAt = new Date();
    result.restaurantCount = included;

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
      ? Math.round(pairings.reduce((sum, p) => sum + (p.matchScore || 0), 0) / totalPairings)
      : 0;

    // Match score over time (last 20, chronological)
    const matchScoreOverTime = pairings.slice(0, 20).reverse().map(p => ({
      date: (p.saved_at?.toDate ? p.saved_at.toDate() : new Date(p.saved_at)).toLocaleDateString(),
      score: p.matchScore || 0,
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

    res.json({
      totalPairings,
      avgMatchScore,
      matchScoreOverTime,
      topVarietals,
      totalSessions,
      restaurantsExplored,
      preferenceProfile: userData.savedPreferences || null,
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

    events.forEach(e => {
      const type = e.eventType;
      if (funnel[type] !== undefined) {
        funnel[type]++;
        if (e.userId) funnelUsers[type].add(e.userId);
      }
      if (e.userId) uniqueUsers.add(e.userId);

      // Daily breakdown
      const ts = e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp);
      const day = ts.toISOString().split('T')[0];
      if (!daily[day]) daily[day] = { restaurant_view: 0, filter_applied: 0, pairing_result_viewed: 0, wine_card_open: 0 };
      if (daily[day][type] !== undefined) daily[day][type]++;

      // Restaurant views
      if (type === 'restaurant_view' && e.restaurantId) {
        restaurantViews[e.restaurantId] = (restaurantViews[e.restaurantId] || 0) + 1;
      }
    });

    // Fetch restaurant names for top restaurants
    const topRestaurantIds = Object.entries(restaurantViews)
      .sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
    const restaurantNames = {};
    await Promise.all(topRestaurantIds.map(async id => {
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
    for (const userDoc of usersSnap.docs) {
      const histSnap = await db.collection('users').doc(userDoc.id)
        .collection('pairing_history')
        .where('saved_at', '>=', fromDate)
        .where('saved_at', '<=', toDate)
        .get();
      if (histSnap.size > 0) {
        totalSaves += histSnap.size;
        saveUsers.add(userDoc.id);
      }
    }

    // Daily array sorted chronologically
    const dailyArray = Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    res.json({
      totalEvents: events.length,
      uniqueUsers: uniqueUsers.size,
      funnel: [
        { step: 'Restaurant Viewed', count: funnel.restaurant_view, users: funnelUsers.restaurant_view.size },
        { step: 'Filters Applied', count: funnel.filter_applied, users: funnelUsers.filter_applied.size },
        { step: 'Results Viewed', count: funnel.pairing_result_viewed, users: funnelUsers.pairing_result_viewed.size },
        { step: 'Wine Saved', count: totalSaves, users: saveUsers.size },
      ],
      dailyActivity: dailyArray,
      topRestaurants,
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

module.exports = router;
