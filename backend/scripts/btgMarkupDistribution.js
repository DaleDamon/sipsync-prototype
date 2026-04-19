require('dotenv').config();
const { db } = require('../firebase');

async function run() {
  const restaurantsSnap = await db.collection('restaurants').get();
  const results = [];

  for (const rDoc of restaurantsSnap.docs) {
    const winesSnap = await db.collection('restaurants').doc(rDoc.id).collection('wines').get();
    const wines = winesSnap.docs.map(d => d.data());

    const btgWines = wines.filter(w =>
      w.glassPrice > 0 && w.price > 0
    );

    if (btgWines.length === 0) continue;

    const ratios = btgWines.map(w => (w.glassPrice * 5) / w.price);
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;

    results.push({
      name: rDoc.data().name || rDoc.id,
      btgCount: btgWines.length,
      avgRatio: Math.round(avg * 100) / 100,
      minRatio: Math.round(Math.min(...ratios) * 100) / 100,
      maxRatio: Math.round(Math.max(...ratios) * 100) / 100,
    });
  }

  results.sort((a, b) => a.avgRatio - b.avgRatio);

  console.log('\n=== BTG Markup Ratio Distribution ===\n');
  console.log(`Restaurants with BTG data: ${results.length}`);

  const ratios = results.map(r => r.avgRatio);
  const overall = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const sorted = [...ratios].sort((a, b) => a - b);
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];

  console.log(`\nOverall average ratio: ${Math.round(overall * 100) / 100}×`);
  console.log(`P25: ${p25}×  |  Median: ${p50}×  |  P75: ${p75}×`);
  console.log(`Range: ${sorted[0]}× – ${sorted[sorted.length - 1]}×`);

  // Bucket distribution
  const buckets = { 'Under 0.5': 0, '0.5–1.0': 0, '1.0–1.5': 0, '1.5–2.0': 0, '2.0–2.5': 0, 'Over 2.5': 0 };
  ratios.forEach(r => {
    if (r < 0.5)       buckets['Under 0.5']++;
    else if (r < 1.0)  buckets['0.5–1.0']++;
    else if (r < 1.5)  buckets['1.0–1.5']++;
    else if (r < 2.0)  buckets['1.5–2.0']++;
    else if (r < 2.5)  buckets['2.0–2.5']++;
    else               buckets['Over 2.5']++;
  });

  console.log('\nBucket distribution:');
  Object.entries(buckets).forEach(([label, count]) => {
    const pct = Math.round((count / results.length) * 100);
    const bar = '█'.repeat(Math.round(pct / 3));
    console.log(`  ${label.padEnd(12)} ${String(count).padStart(3)} restaurants (${String(pct).padStart(3)}%)  ${bar}`);
  });

  console.log('\nPer-restaurant breakdown (sorted by avg ratio):');
  console.log('  Restaurant                            BTG Wines  Avg     Min     Max');
  console.log('  ' + '─'.repeat(72));
  results.forEach(r => {
    console.log(
      `  ${r.name.substring(0, 36).padEnd(36)}  ${String(r.btgCount).padStart(9)}  ${String(r.avgRatio + '×').padStart(6)}  ${String(r.minRatio + '×').padStart(6)}  ${String(r.maxRatio + '×').padStart(6)}`
    );
  });
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
