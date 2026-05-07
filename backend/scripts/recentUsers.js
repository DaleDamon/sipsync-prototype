require('dotenv').config();
const { db } = require('../firebase');

async function recentUsers() {
  const cutoff = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  console.log(`\nLooking for activity since: ${cutoff.toLocaleString()}\n`);

  // 1. Scan all users for createdAt in last 4 days
  const usersSnap = await db.collection('users').get();
  const newUsers = [];
  const allUserIds = [];

  usersSnap.forEach(doc => {
    allUserIds.push(doc.id);
    const data = doc.data();
    const created = data.createdAt?.toDate?.() || null;
    if (created && created >= cutoff) {
      newUsers.push({ id: doc.id, name: data.name || '(no name)', created });
    }
  });

  console.log(`=== New Signups (last 4 days) ===`);
  if (newUsers.length === 0) {
    console.log('  None');
  } else {
    newUsers.sort((a, b) => b.created - a.created);
    newUsers.forEach(u => {
      console.log(`  ${u.name} | ${u.id} | signed up ${u.created.toLocaleString()}`);
    });
  }

  // 2. Check pairing_history saves in last 4 days (collectionGroup — filter in-memory, no index needed)
  const historySnap = await db.collectionGroup('pairing_history')
    .select('wineName', 'saved_at')
    .get();

  const activityByUser = {};
  historySnap.forEach(doc => {
    const data = doc.data();
    const savedAt = data.saved_at?.toDate?.() || null;
    if (!savedAt || savedAt < cutoff) return;
    const userId = doc.ref.parent.parent.id;
    if (!activityByUser[userId]) activityByUser[userId] = [];
    activityByUser[userId].push({
      wine: data.wineName || '(unknown)',
      at: savedAt,
    });
  });

  console.log(`\n=== Active Users — Wines Saved (last 4 days) ===`);
  const activeEntries = Object.entries(activityByUser);
  if (activeEntries.length === 0) {
    console.log('  None');
  } else {
    // Fetch names for active users
    const nameMap = {};
    usersSnap.forEach(doc => { nameMap[doc.id] = doc.data().name || '(no name)'; });

    activeEntries
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([uid, saves]) => {
        const name = nameMap[uid] || uid;
        const latest = saves.reduce((max, s) => s.at > max ? s.at : max, new Date(0));
        console.log(`  ${name} (${uid}) — ${saves.length} save(s), last at ${latest.toLocaleString()}`);
        saves.sort((a, b) => b.at - a.at).forEach(s => {
          console.log(`    • ${s.wine}  [${s.at?.toLocaleString() || '?'}]`);
        });
      });
  }

  // 3. Sessions started in last 4 days (filter in-memory)
  const sessionsSnap = await db.collectionGroup('sessions')
    .select('startedAt')
    .get();

  const sessionsByUser = {};
  sessionsSnap.forEach(doc => {
    const startedAt = doc.data().startedAt?.toDate?.() || null;
    if (!startedAt || startedAt < cutoff) return;
    const uid = doc.ref.parent.parent.id;
    sessionsByUser[uid] = (sessionsByUser[uid] || 0) + 1;
  });

  console.log(`\n=== Sessions (last 4 days) ===`);
  const sessionEntries = Object.entries(sessionsByUser);
  if (sessionEntries.length === 0) {
    console.log('  None');
  } else {
    const nameMap = {};
    usersSnap.forEach(doc => { nameMap[doc.id] = doc.data().name || '(no name)'; });
    sessionEntries
      .sort((a, b) => b[1] - a[1])
      .forEach(([uid, count]) => {
        console.log(`  ${nameMap[uid] || uid} — ${count} session(s)`);
      });
  }

  console.log('\nDone.\n');
  process.exit(0);
}

recentUsers().catch(err => { console.error(err); process.exit(1); });
