require('dotenv').config();
const { db } = require('../firebase');

async function checkSpike() {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  console.log(`\nScanning activity since: ${cutoff.toLocaleString()}\n`);

  // Top-level events collection (all users, all event types)
  const eventsSnap = await db.collection('events')
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'asc')
    .get();

  if (eventsSnap.empty) {
    console.log('No events found in top-level events collection.');
  } else {
    // Group by hour
    const byHour = {};
    const byType = {};
    const byUser = {};

    eventsSnap.forEach(doc => {
      const d = doc.data();
      const ts = d.timestamp?.toDate?.() || new Date(0);
      const hour = ts.toISOString().slice(0, 13) + ':00';
      byHour[hour] = (byHour[hour] || 0) + 1;
      byType[d.eventType || 'unknown'] = (byType[d.eventType || 'unknown'] || 0) + 1;
      byUser[d.userId || 'anon'] = (byUser[d.userId || 'anon'] || 0) + 1;
    });

    console.log(`=== Total Events: ${eventsSnap.size} ===\n`);

    console.log('-- Events by Hour --');
    Object.entries(byHour)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([h, n]) => {
        const bar = '█'.repeat(Math.min(n, 60));
        console.log(`  ${h}  ${String(n).padStart(4)}  ${bar}`);
      });

    console.log('\n-- Events by Type --');
    Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([t, n]) => console.log(`  ${String(n).padStart(5)}  ${t}`));

    console.log('\n-- Events by User --');
    Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([u, n]) => console.log(`  ${String(n).padStart(5)}  ${u}`));
  }

  // Also check sessions for login spikes
  const sessionsSnap = await db.collectionGroup('sessions')
    .select('startedAt', 'platform')
    .get();

  const recentSessions = [];
  sessionsSnap.forEach(doc => {
    const startedAt = doc.data().startedAt?.toDate?.() || null;
    if (startedAt && startedAt >= cutoff) {
      recentSessions.push({
        userId: doc.ref.parent.parent.id,
        startedAt,
        platform: doc.data().platform || '?',
      });
    }
  });

  console.log(`\n=== Sessions (last 2 days): ${recentSessions.length} ===`);
  if (recentSessions.length > 0) {
    const byHour = {};
    recentSessions.forEach(s => {
      const hour = s.startedAt.toISOString().slice(0, 13) + ':00';
      byHour[hour] = (byHour[hour] || 0) + 1;
    });
    Object.entries(byHour)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([h, n]) => console.log(`  ${h}  ${n} session(s)`));
  }

  // Check pairing_history saves in last 2 days
  const historySnap = await db.collectionGroup('pairing_history')
    .select('saved_at', 'wineName')
    .get();

  const recentSaves = [];
  historySnap.forEach(doc => {
    const savedAt = doc.data().saved_at?.toDate?.() || null;
    if (savedAt && savedAt >= cutoff) {
      recentSaves.push({ userId: doc.ref.parent.parent.id, savedAt, wine: doc.data().wineName });
    }
  });

  console.log(`\n=== Pairing Saves (last 2 days): ${recentSaves.length} ===`);
  if (recentSaves.length > 0) {
    recentSaves.sort((a, b) => a.savedAt - b.savedAt).forEach(s => {
      console.log(`  ${s.savedAt.toLocaleString()}  ${s.userId}  "${s.wine}"`);
    });
  }

  console.log('\nDone.\n');
  process.exit(0);
}

checkSpike().catch(err => { console.error(err); process.exit(1); });
