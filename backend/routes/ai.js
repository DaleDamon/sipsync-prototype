const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk').default;
const { adminAuth } = require('../middleware/adminAuth');

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

For each wine, extract:
- year: string (if visible, otherwise empty string)
- producer: string (the winery/producer name)
- varietal: string (the grape variety or wine name, e.g., "Cabernet Sauvignon", "Chianti (Sangiovese)")
- region: string (format as "Area, Country", e.g., "Tuscany, Italy", "Napa Valley, California")
- type: string (one of: red, white, rose, sparkling, dessert)
- price: number (the bottle price as a number, no dollar sign)

Also estimate the sensory profile:
- acidity: "low", "medium", or "high"
- tannins: "low", "medium", or "high"
- bodyWeight: "light", "medium", or "full"
- sweetnessLevel: "dry", "medium", or "sweet"
- flavorProfile: array of 2-5 strings from ONLY: oak, cherry, citrus, berry, vanilla, spice, floral, chocolate, earthy, tropical, herbal, honey, pear, biscuit
- lowConfidence: array of field names (from: acidity, tannins, bodyWeight, sweetnessLevel, flavorProfile) where your confidence is LOW. Flag a field if you don't recognize the producer, the varietal is unusual/a blend that could vary widely, or the region doesn't narrow things down. If confident in all, return an empty array [].

Important:
- If the menu has section headers like "Light Whites", "Medium Reds", "Full Body" — use those as direct signals for bodyWeight and type
- For wines in "Cellar Selections" or similar premium sections, infer body from wine knowledge (most are full-bodied)
- When a wine lists an appellation instead of a grape (e.g., "Gavi", "Soave", "Bolgheri"), include the grape variety in parentheses if you know it
- Sparkling wines typically have "medium" body weight
- Watch for the region/producer delimiter — don't confuse wine line names (like "Velodoro") with regions
- Normalize Italian region names: TOSCANA → Tuscany, PIEMONTE → Piedmont, SICILIA → Sicily, etc.
- For perceived sweetness: fruit-forward whites and value Italian reds often warrant "medium" rather than "dry"

Return ONLY a JSON array of wine objects, no other text.`;

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
      model: 'claude-sonnet-4-20250514',
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
      model: 'claude-sonnet-4-20250514'
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

    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (images.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 images per request' });
    }

    console.log(`[AI] Processing ${images.length} menu image(s) with vision...`);

    // Helper: parse a single image/document and return wine array
    const parseImageBatch = async (imageGroup, label) => {
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
        text: VISION_PROMPT
      });

      let responseText = '';
      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
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
        // Try JSON repair
        const repaired = repairJSONArray(responseText);
        if (repaired) return repaired;
        throw new Error(`Failed to parse AI vision response as JSON for ${label}`);
      }
    };

    let parsedWines;

    if (images.length <= 2) {
      // Small request — single API call
      parsedWines = await parseImageBatch(images, 'all pages');
    } else {
      // Process each page individually in parallel for large menus
      console.log(`[AI] Processing ${images.length} pages in parallel...`);
      const results = await Promise.all(
        images.map((img, idx) => parseImageBatch([img], `page ${idx + 1}/${images.length}`))
      );
      parsedWines = results.flat();
    }

    console.log(`[AI] Total wines parsed: ${parsedWines.length}`);

    // Validate and sanitize
    const CONFIDENCE_FIELDS = ['acidity', 'tannins', 'bodyWeight', 'sweetnessLevel', 'flavorProfile'];
    parsedWines = parsedWines.map(wine => ({
      year: wine.year || '',
      producer: wine.producer || '',
      varietal: wine.varietal || '',
      region: wine.region || '',
      type: ['red', 'white', 'rose', 'sparkling', 'dessert'].includes(wine.type) ? wine.type : 'red',
      price: parseFloat(wine.price) || 0,
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

    console.log(`[AI] Successfully parsed ${parsedWines.length} wines from menu images`);

    res.json({
      wines: parsedWines,
      count: parsedWines.length,
      model: 'claude-sonnet-4-20250514',
      pagesProcessed: images.length
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

module.exports = router;
