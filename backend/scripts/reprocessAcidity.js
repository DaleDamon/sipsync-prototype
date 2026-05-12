/**
 * Retroactively re-evaluates acidity (and lowConfidence) for all wines in the database
 * using the updated SENSORY_PROMPT. All other sensory fields are left untouched.
 *
 * Usage: node scripts/reprocessAcidity.js
 * Dry run (no writes): node scripts/reprocessAcidity.js --dry-run
 */

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk').default;
const { db } = require('../firebase');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 25;
const CONCURRENCY = 3;

const APPROVED_FLAVORS = ['oak', 'cherry', 'citrus', 'berry', 'vanilla', 'spice', 'floral', 'chocolate', 'earthy', 'tropical', 'herbal', 'honey', 'pear', 'biscuit'];
const CONFIDENCE_FIELDS = ['acidity', 'tannins', 'bodyWeight', 'sweetnessLevel', 'flavorProfile'];

const SENSORY_PROMPT = `You are an expert sommelier. For each wine provided, estimate its sensory profile based on your knowledge of the varietal, region, producer, and winemaking traditions.

Return a JSON array where each wine object has these fields:
- year: string (keep as provided, or empty string)
- producer: string (keep as provided)
- varietal: string (keep as provided)
- region: string (keep as provided)
- type: string (keep as provided: red, white, rose, sparkling, or dessert)
- acidity: "low", "medium", or "high"
- lowConfidence: array of field names (from: acidity) where your confidence is LOW. If confident, return [].

Acidity calibration — use these as probabilistic defaults, adjusted by producer and region signals:
- Default LOW: Malbec, Grenache/Garnacha, Zinfandel, Primitivo, Viognier, Marsanne, Roussanne, Gewürztraminer, Muscat, Mourvèdre/Monastrell. Override to medium if from a demonstrably cool-climate site (e.g., high-altitude Mendoza, coastal California).
- Default HIGH: Sangiovese, Nebbiolo, Barbera, Sauvignon Blanc, Riesling, Albariño, Grüner Veltliner, Pinot Grigio from northern Italy, most sparkling wines. Override to medium only if context clearly signals a riper, warmer style.
- Default MEDIUM: Cabernet Sauvignon, Merlot, Syrah/Shiraz, Pinot Noir, Chardonnay, Tempranillo — these genuinely vary and medium is correct absent strong signals.
- When genuinely uncertain about a specific producer's acidity level, assign the varietal default above and add "acidity" to lowConfidence rather than defaulting to medium.

Return ONLY the JSON array, no other text.`;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function repairJSON(text) {
  // Strip markdown code block wrappers if present
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const startIdx = stripped.indexOf('[');
  if (startIdx === -1) return null;
  try { return JSON.parse(stripped.slice(startIdx)); } catch (e) {}
  // Walk back from last } to recover partial arrays
  const json = stripped.slice(startIdx);
  let lastValidEnd = -1, braceDepth = 0, inString = false, escapeNext = false;
  for (let i = 1; i < json.length; i++) {
    const ch = json[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceDepth++;
    if (ch === '}') { braceDepth--; if (braceDepth === 0) lastValidEnd = i; }
  }
  if (lastValidEnd > 0) {
    try { return JSON.parse(json.slice(0, lastValidEnd + 1) + ']'); } catch (e) {}
  }
  return null;
}

async function classifyBatch(wines) {
  const input = wines.map(w => ({
    year: w.year || '',
    producer: w.producer || '',
    varietal: w.varietal || '',
    region: w.region || '',
    type: w.type || 'red',
  }));

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `${SENSORY_PROMPT}\n\nWines to evaluate:\n${JSON.stringify(input, null, 2)}`
    }]
  });

  const raw = msg.content[0].text;
  const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(text); } catch (e) { return repairJSON(text) || []; }
}

async function processWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function run() {
  console.log(`\n${'='.repeat(50)}`);
  console.log('Acidity Reprocessing' + (DRY_RUN ? ' [DRY RUN]' : ''));
  console.log('='.repeat(50));

  // Fetch all wines
  console.log('\n→ Fetching all wines from Firestore...');
  const snap = await db.collectionGroup('wines').get();
  console.log(`✓ Loaded ${snap.size} wines`);

  const wines = [];
  snap.forEach(doc => {
    wines.push({ ref: doc.ref, data: doc.data() });
  });

  // Split into batches
  const batches = [];
  for (let i = 0; i < wines.length; i += BATCH_SIZE) {
    batches.push(wines.slice(i, i + BATCH_SIZE));
  }
  console.log(`→ Processing ${batches.length} batches of up to ${BATCH_SIZE} (concurrency: ${CONCURRENCY})\n`);

  const stats = { changed: 0, unchanged: 0, failed: 0, lowToMedium: 0, mediumToLow: 0, highToLow: 0, highToMedium: 0, mediumToHigh: 0 };

  let batchNum = 0;
  const allUpdates = []; // { ref, acidity, lowConfidence }

  await processWithConcurrency(batches, CONCURRENCY, async (batch, idx) => {
    const batchLabel = `Batch ${idx + 1}/${batches.length}`;
    try {
      const results = await classifyBatch(batch.map(w => w.data));

      for (let i = 0; i < batch.length; i++) {
        const wine = batch[i];
        const result = results[i];
        if (!result) { stats.failed++; continue; }

        const newAcidity = ['low', 'medium', 'high'].includes(result.acidity) ? result.acidity : null;
        if (!newAcidity) { stats.failed++; continue; }

        const oldAcidity = wine.data.acidity;
        const newLowConfidence = Array.isArray(result.lowConfidence)
          ? result.lowConfidence.filter(f => f === 'acidity')
          : [];

        // Merge with existing lowConfidence (preserve non-acidity flags)
        const existingLC = Array.isArray(wine.data.lowConfidence) ? wine.data.lowConfidence : [];
        const mergedLC = [...new Set([
          ...existingLC.filter(f => f !== 'acidity'),
          ...newLowConfidence
        ])];

        if (newAcidity !== oldAcidity) {
          const key = `${oldAcidity}To${newAcidity.charAt(0).toUpperCase() + newAcidity.slice(1)}`;
          if (stats[key] !== undefined) stats[key]++;
          stats.changed++;
          allUpdates.push({ ref: wine.ref, acidity: newAcidity, lowConfidence: mergedLC, oldAcidity });
        } else {
          stats.unchanged++;
        }
      }

      if ((idx + 1) % 10 === 0 || idx + 1 === batches.length) {
        console.log(`  ${batchLabel} done — changed so far: ${stats.changed}`);
      }
    } catch (err) {
      console.error(`  ${batchLabel} FAILED:`, err.message);
      stats.failed += batch.length;
    }
  });

  console.log(`\n→ ${allUpdates.length} wines need acidity updates`);
  console.log('  Breakdown:');
  console.log(`    medium → low:  ${stats.mediumToLow}`);
  console.log(`    high   → low:  ${stats.highToLow}`);
  console.log(`    high   → med:  ${stats.highToMedium}`);
  console.log(`    medium → high: ${stats.mediumToHigh}`);
  console.log(`    unchanged:     ${stats.unchanged}`);
  console.log(`    failed:        ${stats.failed}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes made. Re-run without --dry-run to apply changes.');
    process.exit(0);
  }

  // Write updates in Firestore batches (max 500 per batch)
  console.log('\n→ Writing to Firestore...');
  const WRITE_BATCH_SIZE = 400;
  for (let i = 0; i < allUpdates.length; i += WRITE_BATCH_SIZE) {
    const chunk = allUpdates.slice(i, i + WRITE_BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(u => batch.update(u.ref, { acidity: u.acidity, lowConfidence: u.lowConfidence }));
    await batch.commit();
    console.log(`  Wrote ${i + chunk.length}/${allUpdates.length}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✓ Done — ${stats.changed} wines updated, ${stats.unchanged} unchanged, ${stats.failed} failed`);
  console.log('='.repeat(50) + '\n');
  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
