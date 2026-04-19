/**
 * Wine Profile Diagnostic Report Generator
 *
 * Queries all restaurants and their wines from Firestore, scores every wine
 * against all 10 base quiz profiles, and outputs a printable HTML report.
 *
 * Usage: node scripts/generateProfileReport.js
 * Output: backend/profile-report.html
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db } = require('../firebase');

// ─── Wine display name (mirrors pairings.js) ────────────────────────────────

function getWineDisplayName(wine) {
  const parts = [];
  if (wine.year && wine.year.trim()) parts.push(wine.year);
  if (wine.producer && wine.producer.trim()) parts.push(wine.producer);
  if (wine.varietal && wine.varietal.trim()) parts.push(wine.varietal);
  return parts.join(' ') || wine.name || 'Unnamed Wine';
}

// ─── Scoring function (mirrors pairings.js but returns component breakdown) ──

function scoreWine(prefs, wine) {
  let totalScore = 0;
  let categoryCount = 0;
  const components = [];

  // Acidity
  if (prefs.acidity) {
    const match = prefs.acidity === wine.acidity ? 1 : 0.5;
    totalScore += match;
    categoryCount++;
    components.push({
      label: 'Acidity',
      profileValue: prefs.acidity,
      wineValue: wine.acidity || '—',
      points: match,
      status: match === 1 ? 'full' : 'partial',
    });
  }

  // Tannins
  if (prefs.tannins) {
    const match = prefs.tannins === wine.tannins ? 1 : 0.5;
    totalScore += match;
    categoryCount++;
    components.push({
      label: 'Tannins',
      profileValue: prefs.tannins,
      wineValue: wine.tannins || '—',
      points: match,
      status: match === 1 ? 'full' : 'partial',
    });
  }

  // Body Weight
  if (prefs.bodyWeight) {
    const match = prefs.bodyWeight === wine.bodyWeight ? 1 : 0.5;
    totalScore += match;
    categoryCount++;
    components.push({
      label: 'Body Weight',
      profileValue: prefs.bodyWeight,
      wineValue: wine.bodyWeight || '—',
      points: match,
      status: match === 1 ? 'full' : 'partial',
    });
  }

  // Flavor Notes
  if (prefs.flavorNotes && prefs.flavorNotes.length > 0) {
    const wineProfile = Array.isArray(wine.flavorProfile) ? wine.flavorProfile : [];
    const matched = prefs.flavorNotes.filter(f => wineProfile.includes(f));
    const match = matched.length / prefs.flavorNotes.length;
    totalScore += match;
    categoryCount++;
    components.push({
      label: 'Flavor Notes',
      profileValue: prefs.flavorNotes.join(', '),
      wineValue: wineProfile.length > 0 ? wineProfile.join(', ') : '—',
      points: match,
      status: match === 1 ? 'full' : match > 0 ? 'partial' : 'none',
      extra: `${matched.length}/${prefs.flavorNotes.length} matched`,
    });
  }

  // Sweetness
  if (prefs.sweetness) {
    const match = prefs.sweetness === wine.sweetnessLevel ? 1 : 0.5;
    totalScore += match;
    categoryCount++;
    components.push({
      label: 'Sweetness',
      profileValue: prefs.sweetness,
      wineValue: wine.sweetnessLevel || '—',
      points: match,
      status: match === 1 ? 'full' : 'partial',
    });
  }

  // Price Range
  if (prefs.priceRange) {
    const { min, max } = prefs.priceRange;
    const inRange = wine.price >= min && wine.price <= max;
    const match = inRange ? 1 : 0.5;
    totalScore += match;
    categoryCount++;
    components.push({
      label: 'Price',
      profileValue: `$${min}–$${max}`,
      wineValue: wine.price != null ? `$${wine.price}` : '—',
      points: match,
      status: match === 1 ? 'full' : 'partial',
    });
  }

  // Wine Type (binary: 1 or 0)
  if (prefs.wineType && prefs.wineType !== 'any') {
    const match = prefs.wineType === wine.type ? 1 : 0;
    totalScore += match;
    categoryCount++;
    components.push({
      label: 'Wine Type',
      profileValue: prefs.wineType,
      wineValue: wine.type || '—',
      points: match,
      status: match === 1 ? 'full' : 'none',
    });
  }

  const score = categoryCount > 0 ? totalScore / categoryCount : 0;
  return { score, components };
}

// ─── Base quiz profiles (mirrored from PairingDiscovery.js quizProfilesMap) ──

const PROFILES = [
  {
    id: 'full-bodied-red-enthusiast',
    label: 'Full-Bodied Red Enthusiast',
    prefs: {
      wineType: 'red', acidity: 'medium', tannins: 'high', bodyWeight: 'full',
      flavorNotes: ['oak', 'cherry'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'medium-bodied-red-aficionado',
    label: 'Medium-Bodied Red Aficionado',
    prefs: {
      wineType: 'red', acidity: 'medium', tannins: 'medium', bodyWeight: 'medium',
      flavorNotes: ['cherry', 'berry', 'vanilla'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'spiced-red-connoisseur',
    label: 'Spiced Red Connoisseur',
    prefs: {
      wineType: 'red', acidity: 'medium', tannins: 'medium', bodyWeight: 'full',
      flavorNotes: ['spice', 'cherry'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'light-bodied-red-devotee',
    label: 'Light-Bodied Red Devotee',
    prefs: {
      wineType: 'red', acidity: 'medium', tannins: 'low', bodyWeight: 'light',
      flavorNotes: ['berry', 'earthy'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'crisp-&-acidic-white-enthusiast',
    label: 'Crisp & Acidic White Enthusiast',
    prefs: {
      wineType: 'white', acidity: 'high', tannins: 'low', bodyWeight: 'light',
      flavorNotes: ['citrus', 'floral'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'full-bodied-white-aficionado',
    label: 'Full-Bodied White Aficionado',
    prefs: {
      wineType: 'white', acidity: 'medium', tannins: 'low', bodyWeight: 'full',
      flavorNotes: ['oak', 'vanilla', 'butter'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'aromatic-white-connoisseur',
    label: 'Aromatic White Connoisseur',
    prefs: {
      wineType: 'white', acidity: 'medium', tannins: 'low', bodyWeight: 'light',
      flavorNotes: ['floral', 'citrus'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'fruit-forward-white-devotee',
    label: 'Fruit-Forward White Devotee',
    prefs: {
      wineType: 'white', acidity: 'medium', tannins: 'low', bodyWeight: 'medium',
      flavorNotes: ['citrus'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'sparkling-wine-enthusiast',
    label: 'Sparkling Wine Enthusiast',
    prefs: {
      wineType: 'sparkling', acidity: 'high', tannins: 'low', bodyWeight: 'light',
      flavorNotes: ['citrus', 'floral'], sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
  },
  {
    id: 'dessert-wine-aficionado',
    label: 'Dessert Wine Aficionado',
    prefs: {
      wineType: 'dessert', acidity: 'low', tannins: 'low', bodyWeight: 'medium',
      flavorNotes: ['berry', 'vanilla'], sweetness: 'sweet',
      priceRange: { min: 0, max: 1000 },
    },
  },
];

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function profileSummary(prefs) {
  const parts = [];
  if (prefs.wineType && prefs.wineType !== 'any') parts.push(`type:${prefs.wineType}`);
  if (prefs.acidity) parts.push(`acid:${prefs.acidity}`);
  if (prefs.tannins) parts.push(`tan:${prefs.tannins}`);
  if (prefs.bodyWeight) parts.push(`body:${prefs.bodyWeight}`);
  if (prefs.sweetness) parts.push(`sweet:${prefs.sweetness}`);
  if (prefs.flavorNotes && prefs.flavorNotes.length) parts.push(`flavors:${prefs.flavorNotes.join(',')}`);
  return parts.join(' · ');
}

// Column header abbreviations
const COL_LABELS = {
  'Acidity': 'Acid', 'Tannins': 'Tan', 'Body Weight': 'Body',
  'Flavor Notes': 'Flavors', 'Sweetness': 'Sweet', 'Price': 'Price', 'Wine Type': 'Type',
};

function renderProfileSection(profile, wines) {
  const prefs = profile.prefs;
  const summary = profileSummary(prefs);

  if (wines.length === 0) {
    return `<div class="ps"><div class="ph">${escHtml(profile.label)} <span class="pm">${escHtml(summary)}</span></div><p class="empty">No wines in database.</p></div>`;
  }

  const scored = wines
    .filter(wine => {
      if (!prefs.wineType || prefs.wineType === 'any') return true;
      if (prefs.wineType === 'red') {
        return wine.type === 'red' || wine.type === 'rosé' || wine.type === 'rose';
      }
      return wine.type === prefs.wineType;
    })
    .map(wine => ({ wine, result: scoreWine(prefs, wine) }))
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, 5);

  const colHeaders = scored[0].result.components
    .map(c => `<th>${escHtml(COL_LABELS[c.label] || c.label)}</th>`)
    .join('');

  const rows = scored.map(({ wine, result }) => {
    const name = escHtml(getWineDisplayName(wine));
    const region = escHtml(wine.region || '—');
    const price = wine.price != null ? `$${wine.price}` : '—';
    const pct = Math.round(result.score * 100);
    const badgeCls = pct >= 80 ? 'bh' : pct >= 60 ? 'bm' : 'bl';

    const cells = result.components.map(c => {
      if (c.label === 'Flavor Notes') {
        return `<td class="c${c.status[0]}">${escHtml(c.extra)}</td>`;
      }
      const sym = c.status === 'full' ? '✓' : c.status === 'partial' ? '~' : '✗';
      return `<td class="c${c.status[0]}">${sym} ${escHtml(String(c.wineValue))}</td>`;
    }).join('');

    return `<tr><td><span class="sb ${badgeCls}">${pct}%</span></td><td class="wn">${name} <span class="wm">${region} · ${price}</span></td>${cells}</tr>`;
  }).join('');

  return `
<div class="ps">
  <div class="ph">${escHtml(profile.label)} <span class="pm">${escHtml(summary)}</span></div>
  <table class="wt">
    <thead><tr><th>Score</th><th>Wine · Region · Price</th>${colHeaders}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

function renderRestaurantSection(restaurant, wines, index, total) {
  const anchor = `r-${restaurant.id}`;
  const address = restaurant.address
    ? `${restaurant.address.neighborhood || restaurant.address.city || ''}, ${restaurant.address.state || ''}`.replace(/^,\s*|,\s*$/g, '')
    : restaurant.city || '';

  const profileSections = PROFILES.map(p => renderProfileSection(p, wines)).join('');

  return `
<section class="rs" id="${anchor}">
  <div class="rh">
    <span class="rn">${escHtml(restaurant.name)}</span>
    <span class="rm">${escHtml(address)} · ${wines.length} wines · ${index}/${total}</span>
  </div>
  ${profileSections}
</section>`;
}

function buildHTML(restaurants, generatedAt) {
  const tocItems = restaurants
    .map(r => `<li><a href="#r-${r.id}">${escHtml(r.name)}</a> <span class="tc">(${r.wineCount})</span></li>`)
    .join('\n    ');

  const sections = restaurants
    .map((r, i) => renderRestaurantSection(r, r.wines, i + 1, restaurants.length))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SipSync Wine Profile Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #222; background: #fff; line-height: 1.4; }
  a { color: #8b0000; text-decoration: none; }

  /* Cover */
  .cover { padding: 28px 32px; border-bottom: 2px solid #8b0000; margin-bottom: 0; }
  .cover h1 { font-size: 20px; color: #8b0000; margin-bottom: 4px; }
  .cover .meta { color: #666; font-size: 10px; margin-bottom: 16px; }
  .toc { columns: 3; column-gap: 20px; }
  .toc h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #8b0000; margin-bottom: 6px; column-span: all; }
  .toc ol { padding-left: 16px; }
  .toc li { margin-bottom: 2px; font-size: 10px; break-inside: avoid; }
  .tc { color: #999; }

  /* Restaurant */
  .rs { padding: 10px 16px 6px; border-top: 2px solid #8b0000; }
  .rh { margin-bottom: 8px; display: flex; align-items: baseline; gap: 10px; }
  .rn { font-size: 14px; font-weight: 700; color: #8b0000; }
  .rm { font-size: 10px; color: #888; }

  /* Profile section */
  .ps { margin-bottom: 8px; }
  .ph { font-size: 11px; font-weight: 600; color: #333; margin-bottom: 2px; }
  .pm { font-weight: 400; color: #888; font-size: 10px; margin-left: 6px; }
  .empty { color: #bbb; font-style: italic; font-size: 10px; padding: 2px 0; }

  /* Wine table */
  .wt { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 2px; }
  .wt th { background: #f4eded; color: #555; font-weight: 600; text-align: left; padding: 2px 5px; border-bottom: 1px solid #ddd; white-space: nowrap; }
  .wt td { padding: 2px 5px; border-bottom: 1px solid #f2f2f2; white-space: nowrap; }
  .wt tr:last-child td { border-bottom: none; }
  .wn { font-weight: 500; white-space: normal; max-width: 220px; }
  .wm { font-weight: 400; color: #999; font-size: 9px; }

  /* Score badges */
  .sb { font-weight: 700; padding: 1px 5px; border-radius: 8px; font-size: 10px; display: inline-block; }
  .bh { background: #d4edda; color: #155724; }
  .bm { background: #fff3cd; color: #856404; }
  .bl { background: #f8d7da; color: #721c24; }

  /* Component status */
  .cf { color: #155724; font-weight: 600; }
  .cp { color: #856404; }
  .cn { color: #721c24; }

  /* Print */
  @media print {
    @page { size: letter; margin: 10mm 10mm; }
    .cover { page-break-after: always; }
    .rs { page-break-before: always; }
    .ps { page-break-inside: avoid; }
    .bh { border: 1px solid #155724; background: none; }
    .bm { border: 1px solid #856404; background: none; }
    .bl { border: 1px solid #721c24; background: none; }
  }
</style>
</head>
<body>

<div class="cover">
  <h1>SipSync Wine Profile Diagnostic Report</h1>
  <p class="meta">Generated ${escHtml(generatedAt)} · ${restaurants.length} restaurants · 10 profiles · Top 5 wines per profile</p>
  <div class="toc">
    <h2>Restaurants</h2>
    <ol>
    ${tocItems}
    </ol>
  </div>
</div>

${sections}

</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n========================================');
  console.log('SipSync Wine Profile Diagnostic Report');
  console.log('========================================\n');

  // Fetch all restaurants
  console.log('→ Fetching restaurants...');
  const restSnapshot = await db.collection('restaurants').get();
  const allRestaurants = restSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  console.log(`  Found ${allRestaurants.length} restaurants\n`);

  const results = [];

  for (let i = 0; i < allRestaurants.length; i++) {
    const restaurant = allRestaurants[i];
    console.log(`→ Processing ${i + 1}/${allRestaurants.length}: ${restaurant.name}`);

    // Fetch wines for this restaurant
    const winesSnapshot = await db
      .collection('restaurants')
      .doc(restaurant.id)
      .collection('wines')
      .get();

    const wines = winesSnapshot.docs.map(doc => ({ wineId: doc.id, ...doc.data() }));
    console.log(`  ${wines.length} wine${wines.length !== 1 ? 's' : ''} found`);

    results.push({ ...restaurant, wines, wineCount: wines.length });
  }

  console.log('\n→ Building HTML report...');
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  const html = buildHTML(results, generatedAt);

  const outPath = path.join(__dirname, '..', 'profile-report.html');
  fs.writeFileSync(outPath, html, 'utf8');

  console.log(`✓ Report written to: ${outPath}`);
  console.log('\nOpen profile-report.html in Chrome, then:');
  console.log('  File → Print → Save as PDF\n');

  process.exit(0);
}

main().catch(err => {
  console.error('✗ Error generating report:', err.message);
  console.error(err);
  process.exit(1);
});
