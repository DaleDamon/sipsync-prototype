const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk').default;
const { adminAuth } = require('../middleware/adminAuth');
const { db, bucket } = require('../firebase');
const { PDFDocument } = require('pdf-lib');

// Initialize Anthropic client
let anthropic;
try {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
} catch (error) {
  console.error('[AI] Failed to initialize Anthropic client:', error.message);
}

const APPROVED_FLAVORS = ['oak', 'cherry', 'citrus', 'berry', 'vanilla', 'spice', 'floral', 'chocolate', 'earthy', 'tropical', 'herbal', 'honey', 'pear', 'biscuit'];

// Attempts to recover a valid JSON array from a potentially truncated/malformed response
function repairJSONArray(text) {
  // Find the opening bracket
  const startIdx = text.indexOf('[');
  if (startIdx === -1) return null;

  // Try parsing as-is first
  try {
    return JSON.parse(text.slice(startIdx));
  } catch (e) {
    // Continue to repair
  }

  // Extract from opening bracket to end
  let json = text.slice(startIdx);

  // Try to find the last complete object by looking for },{ or }] patterns
  // Walk backwards to find the last valid closing brace of a complete object
  let lastValidEnd = -1;
  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 1; i < json.length; i++) {
    const ch = json[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') braceDepth++;
    if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        lastValidEnd = i;
      }
    }
  }

  if (lastValidEnd > 0) {
    // Truncate to last complete object and close the array
    const repaired = json.slice(0, lastValidEnd + 1) + ']';
    try {
      const result = JSON.parse(repaired);
      console.log(`[AI] JSON repair: recovered ${result.length} complete wine objects from malformed response`);
      return result;
    } catch (e) {
      console.error('[AI] JSON repair attempt failed:', e.message);
    }
  }

  return null;
}

const SENSORY_PROMPT = `You are an expert sommelier. For each wine provided, estimate its sensory profile based on your knowledge of the varietal, region, producer, and winemaking traditions.

Return a JSON array where each wine object has these fields:
- year: string (keep as provided, or empty string)
- producer: string (keep as provided)
- varietal: string (keep as provided)
- region: string (keep as provided)
- type: string (keep as provided: red, white, rose, sparkling, or dessert)
- price: number (keep as provided)
- acidity: "low", "medium", or "high"
- tannins: "low", "medium", or "high"
- bodyWeight: "light", "medium", or "full"
- sweetnessLevel: "dry", "medium", or "sweet"
- flavorProfile: array of strings from ONLY these approved flavors: ${APPROVED_FLAVORS.join(', ')}
- lowConfidence: array of field names (from: acidity, tannins, bodyWeight, sweetnessLevel, flavorProfile) where your confidence is LOW. Flag a field if:
  - You don't recognize the producer and are guessing based on varietal alone
  - The varietal is unusual or could vary widely (e.g., blends, obscure grapes)
  - The region alone doesn't narrow down the style enough
  - If you are highly confident in ALL fields, return an empty array []

Important guidelines for accuracy:
- Consider the specific producer and region, not just the varietal
- California Chardonnay and Italian house whites often have perceived sweetness ("medium" not "dry")
- Primitivo/Zinfandel from warm regions tend to have low acidity
- Use menu section hints if provided (e.g., "Light Whites" means bodyWeight should be "light")
- Sparkling wines typically have "medium" body weight, not "light"
- Select 2-5 flavor notes that best characterize each wine
- When in doubt about sweetness, lean toward "medium" for fruit-forward whites and value reds

Return ONLY the JSON array, no other text.`;

const VISION_PROMPT = `You are an expert sommelier analyzing a restaurant wine menu image. Extract every wine from this menu and provide structured data for each.

Your primary goal is to extract EVERY wine entry visible on the menu, regardless of whether it has a glass price or only a bottle price. Do not skip wines just because they have a single price.

Only extract from clearly visible, current menu content. Do not extract from:
- Text covered by black bars, dark overlays, or visual masks
- Text that appears crossed out, grayed out, or visually obscured
- Background watermarks or text that overlaps with the main menu layout
- Cocktails, beers, spirits, or non-wine items
- Maps, diagrams, infographics, or region reference pages — if this page is a wine region map or educational graphic with no actual wine listings, return an empty array []

For each wine, extract:
- year: string (if visible, otherwise empty string)
- producer: string (the winery/producer name)
- varietal: string (the grape variety or wine name, e.g., "Cabernet Sauvignon", "Chianti (Sangiovese)")
- region: string (format as "Area, Country", e.g., "Tuscany, Italy", "Napa Valley, California")
- type: string (one of: red, white, rose, sparkling, dessert)
- price: number (the bottle price as a number, no dollar sign)
- glassPrice: number or null — read the pricing guidance below carefully before filling this field

PRICING GUIDANCE — how to detect glass prices:
Some menus use a column table with headers like "6oz", "Glass", "BTL", or "Bottle" at the top of a wine section. When you see these column headers, the left/first column is the glass price and the right/second column is the bottle price. Apply this column mapping consistently to ALL wines within that section — do not abandon it partway through. Within the same section, some wines may only appear in the bottle column (no glass price) — give those glassPrice: null based on visual alignment, not just by counting numbers.
Some menus use inline format instead: "13 • 52", "Glass $14 / Bottle $52", or "Btg $16". Extract glassPrice from that inline text.
If a wine has only one price and no glass indicator anywhere, set glassPrice: null.

Also estimate the sensory profile:
- acidity: "low", "medium", or "high"
- tannins: "low", "medium", or "high"
- bodyWeight: "light", "medium", or "full"
- sweetnessLevel: "dry", "medium", or "sweet"
- flavorProfile: array of 2-5 strings from ONLY: oak, cherry, citrus, berry, vanilla, spice, floral, chocolate, earthy, tropical, herbal, honey, pear, biscuit
- lowConfidence: array of field names (from: acidity, tannins, bodyWeight, sweetnessLevel, flavorProfile) where your confidence is LOW. Flag a field if you don't recognize the producer, the varietal is unusual/a blend that could vary widely, or the region doesn't narrow things down. If confident in all, return an empty array [].

Additional extraction rules:
- If the menu has section headers like "Light Whites", "Medium Reds", "Full Body" — use those as direct signals for bodyWeight and type
- For wines in "Cellar Selections" or similar premium sections, infer body from wine knowledge (most are full-bodied)
- When a wine lists an appellation instead of a grape (e.g., "Gavi", "Soave", "Bolgheri"), include the grape variety in parentheses if you know it
- Sparkling wines typically have "medium" body weight
- Watch for the region/producer delimiter — don't confuse wine line names with regions
- Normalize Italian region names: TOSCANA → Tuscany, PIEMONTE → Piedmont, SICILIA → Sicily, etc.
- For perceived sweetness: fruit-forward whites and value Italian reds often warrant "medium" rather than "dry"

Return ONLY a JSON array of wine objects, no other text.`;

// Split a base64 PDF into individual single-page PDFs (preserves text layer for Claude native processing)
async function splitPdfToPages(base64Pdf) {
  const srcBuffer = Buffer.from(base64Pdf, 'base64');
  const srcDoc = await PDFDocument.load(srcBuffer);
  const pageCount = srcDoc.getPageCount();

  const pageDocs = await Promise.all(
    Array.from({ length: pageCount }, async (_, i) => {
      const pageDoc = await PDFDocument.create();
      const [copiedPage] = await pageDoc.copyPages(srcDoc, [i]);
      pageDoc.addPage(copiedPage);
      const pageBytes = await pageDoc.save();
      return 'data:application/pdf;base64,' + Buffer.from(pageBytes).toString('base64');
    })
  );

  console.log(`[AI] PDF split into ${pageDocs.length} single-page PDF(s)`);
  return pageDocs;
}

// Detect pricing structure from the first image using Haiku (cheap, fast)
async function detectPricingStructure(image) {
  try {
    let mediaType = 'image/jpeg';
    let imageData = image;
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) { mediaType = match[1]; imageData = match[2]; }
    }

    const contentBlock = mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageData } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } };

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'Look at the wine list pricing in this menu. In 2 sentences max: Does it use a column table with headers like "6oz", "glass", "BTL", or "bottle"? If yes, describe which column is glass and which is bottle. If no table, say so.' }
        ]
      }]
    });

    const structure = msg.content[0].text;
    console.log(`[AI] Pricing structure detected: ${structure}`);
    return `Pricing format note for this menu: ${structure}`;
  } catch (err) {
    console.warn('[AI] Structure pre-pass failed (non-fatal):', err.message);
    return '';
  }
}

// Parse a batch of images/documents through Claude Vision
async function parseImageBatch(imageGroup, label, structureContext = '') {
  const content = [];

  imageGroup.forEach((img, i) => {
    let mediaType = 'image/jpeg';
    let imageData = img;

    if (img.startsWith('data:')) {
      const match = img.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mediaType = match[1];
        imageData = match[2];
      }
    }

    if (mediaType === 'application/pdf') {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: imageData,
        }
      });
    } else {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: imageData,
        }
      });
    }

    if (imageGroup.length > 1) {
      content.push({
        type: 'text',
        text: `(Page ${i + 1} of ${imageGroup.length})`
      });
    }
  });

  content.push({
    type: 'text',
    text: structureContext ? `${structureContext}\n\n${VISION_PROMPT}` : VISION_PROMPT
  });

  let responseText = '';
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 32000,
    messages: [{ role: 'user', content }]
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      responseText += event.delta.text;
    }
  }

  console.log(`[AI] ${label}: received ${responseText.length} chars`);

  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    const repaired = repairJSONArray(responseText);
    if (repaired) return repaired;
    console.warn(`[AI] ${label}: no parseable JSON in response (${responseText.length} chars) — returning empty array`);
    return [];
  }
}

// Sanitize and normalize parsed wine objects
function sanitizeWines(wines) {
  const CONFIDENCE_FIELDS = ['acidity', 'tannins', 'bodyWeight', 'sweetnessLevel', 'flavorProfile'];
  // Filter out priceless entries — these are typically from map/infographic pages
  const priced = wines.filter(w => parseFloat(w.price) > 0);
  if (priced.length < wines.length) {
    console.log(`[AI] Filtered out ${wines.length - priced.length} priceless entries (likely from non-menu pages)`);
  }
  return priced.map(wine => ({
    year: wine.year || '',
    producer: wine.producer || '',
    varietal: wine.varietal || '',
    region: wine.region || '',
    type: ['red', 'white', 'rosé', 'rose', 'sparkling', 'dessert'].includes(wine.type) ? (wine.type === 'rose' ? 'rosé' : wine.type) : 'red',
    price: parseFloat(wine.price) || 0,
    glassPrice: wine.glassPrice ? (parseFloat(wine.glassPrice) || null) : null,
    acidity: ['low', 'medium', 'high'].includes(wine.acidity) ? wine.acidity : 'medium',
    tannins: ['low', 'medium', 'high'].includes(wine.tannins) ? wine.tannins : 'low',
    bodyWeight: ['light', 'medium', 'full'].includes(wine.bodyWeight) ? wine.bodyWeight : 'medium',
    sweetnessLevel: ['dry', 'medium', 'sweet'].includes(wine.sweetnessLevel) ? wine.sweetnessLevel : 'dry',
    flavorProfile: Array.isArray(wine.flavorProfile)
      ? wine.flavorProfile.filter(f => APPROVED_FLAVORS.includes(f))
      : [],
    lowConfidence: Array.isArray(wine.lowConfidence)
      ? wine.lowConfidence.filter(f => CONFIDENCE_FIELDS.includes(f))
      : []
  }));
}

// Save base64 images to Firebase Storage; returns array of GCS paths
async function saveImagesToStorage(images, restaurantId) {
  const uploadId = Date.now();
  const paths = new Array(images.length);

  await Promise.all(images.map(async (img, i) => {
    let mediaType = 'image/jpeg';
    let imageData = img;

    if (img.startsWith('data:')) {
      const match = img.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mediaType = match[1];
        imageData = match[2];
      }
    }

    const ext = mediaType === 'application/pdf' ? 'pdf'
      : mediaType === 'image/png' ? 'png'
      : mediaType === 'image/webp' ? 'webp'
      : 'jpg';

    const filePath = `restaurants/${restaurantId}/menus/${uploadId}/page-${i + 1}.${ext}`;
    const buffer = Buffer.from(imageData, 'base64');

    const file = bucket.file(filePath);
    await file.save(buffer, { contentType: mediaType });

    paths[i] = filePath;
  }));

  console.log(`[AI] Saved ${paths.length} image(s) to Firebase Storage`);
  return paths;
}

// POST /api/ai/parse-csv
// Receives pre-parsed wine objects and returns them with AI-estimated sensory profiles
router.post('/parse-csv', adminAuth, async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(500).json({ error: 'AI service not configured. Please set ANTHROPIC_API_KEY.' });
    }

    const { wines } = req.body;

    if (!wines || !Array.isArray(wines) || wines.length === 0) {
      return res.status(400).json({ error: 'Wines array is required' });
    }

    if (wines.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 wines per request' });
    }

    console.log(`[AI] Processing ${wines.length} wines for sensory estimation...`);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `${SENSORY_PROMPT}\n\nHere are the wines to analyze:\n${JSON.stringify(wines, null, 2)}`
        }
      ]
    });

    // Extract JSON from response
    const responseText = message.content[0].text;
    let enrichedWines;

    try {
      enrichedWines = JSON.parse(responseText);
    } catch (parseError) {
      // Try repair/recovery
      enrichedWines = repairJSONArray(responseText);
      if (!enrichedWines) {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Validate and sanitize each wine
    const CONFIDENCE_FIELDS = ['acidity', 'tannins', 'bodyWeight', 'sweetnessLevel', 'flavorProfile'];
    enrichedWines = enrichedWines.map(wine => ({
      ...wine,
      acidity: ['low', 'medium', 'high'].includes(wine.acidity) ? wine.acidity : 'medium',
      tannins: ['low', 'medium', 'high'].includes(wine.tannins) ? wine.tannins : 'low',
      bodyWeight: ['light', 'medium', 'full'].includes(wine.bodyWeight) ? wine.bodyWeight : 'medium',
      sweetnessLevel: ['dry', 'medium', 'sweet'].includes(wine.sweetnessLevel) ? wine.sweetnessLevel : 'dry',
      flavorProfile: Array.isArray(wine.flavorProfile)
        ? wine.flavorProfile.filter(f => APPROVED_FLAVORS.includes(f))
        : [],
      lowConfidence: Array.isArray(wine.lowConfidence)
        ? wine.lowConfidence.filter(f => CONFIDENCE_FIELDS.includes(f))
        : []
    }));

    console.log(`[AI] Successfully enriched ${enrichedWines.length} wines`);

    res.json({
      wines: enrichedWines,
      count: enrichedWines.length,
      model: 'claude-sonnet-4-6'
    });
  } catch (error) {
    console.error('[AI] Error processing CSV:', error);

    if (error.status === 429) {
      return res.status(429).json({ error: 'AI service is busy. Please try again in a minute.' });
    }

    res.status(500).json({
      error: 'Failed to process wines with AI',
      details: error.message
    });
  }
});

// POST /api/ai/parse-menu
// Receives base64 images and returns parsed wines with sensory profiles
router.post('/parse-menu', adminAuth, async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(500).json({ error: 'AI service not configured. Please set ANTHROPIC_API_KEY.' });
    }

    const { images, restaurantId } = req.body;
    console.log(`[AI] parse-menu: restaurantId=${restaurantId || 'NOT PROVIDED'}, images=${images?.length}`);

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (images.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 images per request' });
    }

    console.log(`[AI] Processing ${images.length} menu image(s) with vision...`);

    // Split any PDF files into individual page images so each page gets its own API call
    let processedImages = [];
    for (const img of images) {
      if (img.startsWith('data:application/pdf;base64,')) {
        const base64 = img.replace('data:application/pdf;base64,', '');
        const pages = await splitPdfToPages(base64);
        processedImages.push(...pages);
      } else {
        processedImages.push(img);
      }
    }

    // Save original images (not split pages) to storage in parallel with Claude parsing
    const storagePromise = restaurantId
      ? saveImagesToStorage(images, restaurantId).catch(err => {
          console.error('[AI] Storage save failed (non-fatal):', err.message);
          return [];
        })
      : Promise.resolve([]);

    let parsedWines;
    if (processedImages.length === 1) {
      // Single page — send directly
      parsedWines = await parseImageBatch(processedImages, 'page 1/1');
    } else {
      // Multiple pages — run structure pre-pass then process in parallel
      console.log(`[AI] Processing ${processedImages.length} pages in parallel...`);
      const structureContext = await detectPricingStructure(processedImages[0]);
      const results = await Promise.all(
        processedImages.map((img, idx) => parseImageBatch([img], `page ${idx + 1}/${processedImages.length}`, structureContext))
      );
      parsedWines = results.flat();
    }

    const storedPaths = await storagePromise;

    console.log(`[AI] Total wines parsed: ${parsedWines.length}`);
    parsedWines = sanitizeWines(parsedWines);
    console.log(`[AI] Successfully parsed ${parsedWines.length} wines from menu images`);

    res.json({
      wines: parsedWines,
      count: parsedWines.length,
      model: 'claude-sonnet-4-6',
      pagesProcessed: images.length,
      storedPaths: storedPaths.length > 0 ? storedPaths : undefined
    });
  } catch (error) {
    console.error('[AI] Error processing menu images:', error);

    if (error.status === 429) {
      return res.status(429).json({ error: 'AI service is busy. Please try again in a minute.' });
    }

    res.status(500).json({
      error: 'Failed to parse menu with AI',
      details: error.message
    });
  }
});

// POST /api/ai/reanalyze
// Re-runs AI parsing on previously stored menu images for a given upload history entry
router.post('/reanalyze', adminAuth, async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(500).json({ error: 'AI service not configured. Please set ANTHROPIC_API_KEY.' });
    }

    const { restaurantId, historyId } = req.body;

    if (!restaurantId || !historyId) {
      return res.status(400).json({ error: 'restaurantId and historyId are required' });
    }

    // Fetch stored image paths from upload history
    const historyDoc = await db.collection('restaurants').doc(restaurantId)
      .collection('uploadHistory').doc(historyId).get();

    if (!historyDoc.exists) {
      return res.status(404).json({ error: 'Upload history record not found' });
    }

    const { storedPaths } = historyDoc.data();

    if (!storedPaths || storedPaths.length === 0) {
      return res.status(400).json({ error: 'No stored images for this upload. Only image/PDF uploads support re-analysis.' });
    }

    console.log(`[AI] Re-analyzing ${storedPaths.length} stored image(s) for restaurant ${restaurantId}`);

    // Download images from Firebase Storage and convert to base64 data URLs
    const images = await Promise.all(storedPaths.map(async (storagePath) => {
      const file = bucket.file(storagePath);
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      const mediaType = metadata.contentType || 'image/jpeg';
      return `data:${mediaType};base64,${buffer.toString('base64')}`;
    }));

    console.log(`[AI] Downloaded ${images.length} image(s) from Storage`);

    // Split any PDFs into individual page images
    let processedImages = [];
    for (const img of images) {
      if (img.startsWith('data:application/pdf;base64,')) {
        const base64 = img.replace('data:application/pdf;base64,', '');
        const pages = await splitPdfToPages(base64);
        processedImages.push(...pages);
      } else {
        processedImages.push(img);
      }
    }

    // Parse through Claude Vision
    let parsedWines;
    if (processedImages.length === 1) {
      parsedWines = await parseImageBatch(processedImages, 'page 1/1');
    } else {
      const structureContext = await detectPricingStructure(processedImages[0]);
      const results = await Promise.all(
        processedImages.map((img, idx) => parseImageBatch([img], `page ${idx + 1}/${processedImages.length}`, structureContext))
      );
      parsedWines = results.flat();
    }

    parsedWines = sanitizeWines(parsedWines);
    console.log(`[AI] Re-analysis complete: ${parsedWines.length} wines parsed`);

    res.json({
      wines: parsedWines,
      count: parsedWines.length,
      model: 'claude-sonnet-4-6',
      storedPaths,
      reanalyzed: true
    });
  } catch (error) {
    console.error('[AI] Error re-analyzing menu:', error);

    if (error.status === 429) {
      return res.status(429).json({ error: 'AI service is busy. Please try again in a minute.' });
    }

    res.status(500).json({
      error: 'Failed to re-analyze menu',
      details: error.message
    });
  }
});

module.exports = router;
