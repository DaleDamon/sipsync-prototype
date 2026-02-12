# SipSync Restaurant Wine Menu Upload Format

## Overview
Restaurants need to provide their wine menu in a standardized format. The system supports both **JSON** and **CSV** formats for easy integration. As of the latest update, wines are now split into component fields (year, producer, varietal, region) for better organization and search.

---

## Required Fields

Every wine must include:

| Field | Type | Required | Values | Example |
|-------|------|----------|--------|---------|
| **year** | String | ❌ Optional | 4-digit year or blank | "2019" or "" |
| **producer** | String | ✅ Yes | Wine producer/brand name | "Caymus" |
| **varietal** | String | ✅ Yes | Grape varietal name | "Cabernet Sauvignon" |
| **region** | String | ✅ Yes | Geographic region/origin | "Napa Valley - CA" |
| **type** | String | ✅ Yes | `red`, `white`, `rosé`, `sparkling`, `dessert` | "red" |
| **price** | Number | ✅ Yes | Non-negative number (USD) | 65 |
| **acidity** | String | ❌ Optional | `low`, `medium`, `high` | "medium" |
| **tannins** | String | ❌ Optional | `low`, `medium`, `high` | "high" |
| **bodyWeight** | String | ❌ Optional | `light`, `medium`, `full` | "full" |
| **sweetnessLevel** | String | ❌ Optional | `dry`, `medium`, `sweet` | "dry" |
| **flavorProfile** | Array | ❌ Optional | See flavor list below | ["oak", "cherry", "spice"] |

### Valid Flavor Notes
```
oak, cherry, citrus, berry, vanilla, spice, floral, chocolate,
earthy, tropical, herbal, honey
```

---

## Display Format

The system automatically concatenates the wine fields for display:

- **With year**: "2019 Caymus Cabernet Sauvignon"
- **Without year (non-vintage)**: "Veuve Clicquot Champagne Brut"
- **Region badge**: Shown as a subtle location indicator below the wine name

---

## Format 1: JSON (for API)

### Single Wine JSON
```json
{
  "year": "2019",
  "producer": "Caymus",
  "varietal": "Cabernet Sauvignon",
  "region": "Napa Valley - CA",
  "type": "red",
  "price": 65,
  "acidity": "medium",
  "tannins": "high",
  "bodyWeight": "full",
  "sweetnessLevel": "dry",
  "flavorProfile": ["oak", "cherry", "spice"]
}
```

### Bulk Upload JSON (Array)
```json
[
  {
    "year": "2019",
    "producer": "Caymus",
    "varietal": "Cabernet Sauvignon",
    "region": "Napa Valley - CA",
    "type": "red",
    "price": 65,
    "acidity": "medium",
    "tannins": "high",
    "bodyWeight": "full",
    "sweetnessLevel": "dry",
    "flavorProfile": ["oak", "cherry", "spice"]
  },
  {
    "year": "2020",
    "producer": "Cakebread",
    "varietal": "Chardonnay",
    "region": "Napa Valley - CA",
    "type": "white",
    "price": 45,
    "acidity": "high",
    "tannins": "low",
    "bodyWeight": "full",
    "sweetnessLevel": "dry",
    "flavorProfile": ["citrus", "vanilla", "oak"]
  },
  {
    "year": "",
    "producer": "Veuve Clicquot",
    "varietal": "Champagne Brut",
    "region": "Reims - France",
    "type": "sparkling",
    "price": 65,
    "acidity": "high",
    "tannins": "low",
    "bodyWeight": "medium",
    "sweetnessLevel": "dry",
    "flavorProfile": ["citrus", "floral"]
  }
]
```

---

## Format 2: CSV (Easiest for Excel/Google Sheets)

### CSV Header Row
```csv
year,producer,varietal,region,type,price,acidity,tannins,bodyWeight,sweetnessLevel,flavorProfile
```

### Complete CSV Example
```csv
year,producer,varietal,region,type,price,acidity,tannins,bodyWeight,sweetnessLevel,flavorProfile
2019,Caymus,Cabernet Sauvignon,Napa Valley - CA,red,65,medium,high,full,dry,"oak, cherry, spice"
2020,Cakebread,Chardonnay,Napa Valley - CA,white,45,high,low,full,dry,"citrus, vanilla, oak"
,Veuve Clicquot,Champagne Brut,Reims - France,sparkling,65,high,low,medium,dry,"citrus, floral"
2021,Moscato,Moscato d'Asti,Piedmont - Italy,sparkling,28,medium,low,light,sweet,"citrus, honey"
2020,Domaine Willamette,Pinot Noir,Willamette Valley - OR,red,58,medium,medium,medium,dry,"cherry, berry, earthy"
```

### CSV Rules
- **Year**: Leave blank for non-vintage wines (just leave the cell empty)
- **Producer**: Required, must not be empty
- **Varietal**: Required, must not be empty
- **Region**: Required, can be specific (e.g., "Napa Valley - CA") or general (e.g., "California")
- **Flavor Profile**: Use comma-separated values in quotes if multiple flavors
  - Multiple: `"oak, cherry, spice"`
  - Single: `oak` (no quotes needed)
  - Empty: Leave blank or omit
- **All prices**: Must be numbers without currency symbol
- **All text fields**: Case-insensitive (Red = red = RED)

---

## API Endpoint

### POST Single Wine
```
POST /api/wines/restaurant/{restaurantId}/add
Content-Type: application/json

{
  "year": "2019",
  "producer": "Caymus",
  "varietal": "Cabernet Sauvignon",
  "region": "Napa Valley - CA",
  "type": "red",
  "price": 65,
  "acidity": "medium",
  "tannins": "high",
  "bodyWeight": "full",
  "sweetnessLevel": "dry",
  "flavorProfile": ["oak", "cherry", "spice"]
}
```

### Response (Success)
```json
{
  "message": "Wine added successfully",
  "wineId": "abc123xyz789",
  "wine": {
    "year": "2019",
    "producer": "Caymus",
    "varietal": "Cabernet Sauvignon",
    "region": "Napa Valley - CA",
    "type": "red",
    "price": 65,
    "acidity": "medium",
    "tannins": "high",
    "bodyWeight": "full",
    "sweetnessLevel": "dry",
    "flavorProfile": ["oak", "cherry", "spice"],
    "inventoryStatus": "normal",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### Response (Error)
```json
{
  "error": "Producer is required"
}
```

---

## Real-World Examples

### Example 1: Premium French Bordeaux (with year)
```json
{
  "year": "2015",
  "producer": "Château Margaux",
  "varietal": "Cabernet Sauvignon",
  "region": "Bordeaux - France",
  "type": "red",
  "price": 350,
  "acidity": "medium",
  "tannins": "high",
  "bodyWeight": "full",
  "sweetnessLevel": "dry",
  "flavorProfile": ["oak", "cherry", "tobacco", "earthy"]
}
```

### Example 2: Italian Casual Restaurant
```json
{
  "year": "2019",
  "producer": "Antinori",
  "varietal": "Chianti Classico",
  "region": "Tuscany - Italy",
  "type": "red",
  "price": 42,
  "acidity": "medium",
  "tannins": "medium",
  "bodyWeight": "medium",
  "sweetnessLevel": "dry",
  "flavorProfile": ["cherry", "spice", "earthy"]
}
```

### Example 3: Non-Vintage Champagne (no year)
```json
{
  "year": "",
  "producer": "Veuve Clicquot",
  "varietal": "Champagne Brut",
  "region": "Reims - France",
  "type": "sparkling",
  "price": 65,
  "acidity": "high",
  "tannins": "low",
  "bodyWeight": "medium",
  "sweetnessLevel": "dry",
  "flavorProfile": ["citrus", "floral"]
}
```

### Example 4: New World Sauvignon Blanc
```json
{
  "year": "2021",
  "producer": "Cloudy Bay",
  "varietal": "Sauvignon Blanc",
  "region": "Marlborough - New Zealand",
  "type": "white",
  "price": 38,
  "acidity": "high",
  "tannins": "low",
  "bodyWeight": "light",
  "sweetnessLevel": "dry",
  "flavorProfile": ["citrus", "herbaceous", "floral"]
}
```

### Example 5: Dessert Wine
```json
{
  "year": "2010",
  "producer": "Taylor Fladgate",
  "varietal": "Port",
  "region": "Douro - Portugal",
  "type": "dessert",
  "price": 48,
  "acidity": "low",
  "tannins": "low",
  "bodyWeight": "medium",
  "sweetnessLevel": "sweet",
  "flavorProfile": ["chocolate", "berry", "vanilla"]
}
```

### Example 6: House Wine (minimal entry)
```json
{
  "year": "2023",
  "producer": "House Brand",
  "varietal": "Red Blend",
  "region": "Local",
  "type": "red",
  "price": 18
}
```

**Note**: When optional fields are omitted, defaults are used:
- `acidity`: "medium"
- `tannins`: "medium"
- `bodyWeight`: "medium"
- `sweetnessLevel`: "dry"
- `flavorProfile`: `[]` (empty)

---

## Step-by-Step: CSV Upload Process

### Step 1: Download Template
Get `RESTAURANT_WINE_MENU_TEMPLATE.csv` which has the correct headers

### Step 2: Create Spreadsheet
Use Excel, Google Sheets, or any CSV editor and import the template

### Step 3: Fill in Wine Data
| year | producer | varietal | region | type | price | acidity | tannins | bodyWeight | sweetnessLevel | flavorProfile |
|------|----------|----------|--------|------|-------|---------|---------|------------|----------------|---------------|
| 2019 | Caymus | Cabernet Sauvignon | Napa Valley - CA | red | 65 | medium | high | full | dry | oak, cherry, spice |
| 2020 | Cakebread | Chardonnay | Napa Valley - CA | white | 45 | high | low | full | dry | citrus, vanilla, oak |
| | Veuve Clicquot | Champagne Brut | Reims - France | sparkling | 65 | high | low | medium | dry | citrus, floral |

### Step 4: Export as CSV
- **Excel**: File → Save As → CSV UTF-8 (.csv)
- **Google Sheets**: File → Download → Comma Separated Values (.csv)

### Step 5: Validate Data
Check that:
- ✅ All wines have `producer`, `varietal`, `region`, `type`, and `price`
- ✅ `year` is either blank or a 4-digit number
- ✅ `type` is one of: red, white, rosé, sparkling, dessert
- ✅ `acidity`, `tannins`, `bodyWeight` are: low, medium, high
- ✅ `sweetnessLevel` is: dry, medium, sweet
- ✅ `flavorProfile` uses valid flavor names
- ✅ `price` is a number (no $ or commas)
- ✅ `region` is not empty

### Step 6: Upload via API
```bash
curl -X POST http://api.sipsync.com/api/wines/restaurant/{restaurantId}/add \
  -H "Content-Type: application/json" \
  -d @wine.json
```

---

## Validation Rules

The system will validate:

```
✅ REQUIRED FIELDS
  - producer: Must not be empty
  - varietal: Must not be empty
  - region: Must not be empty
  - type: Must be exactly one of: red, white, rosé, sparkling, dessert
  - price: Must be a number ≥ 0

✅ OPTIONAL FIELDS
  - year: If provided, should be 4 digits or blank
  - acidity: If provided, must be: low, medium, high
  - tannins: If provided, must be: low, medium, high
  - bodyWeight: If provided, must be: light, medium, full
  - sweetnessLevel: If provided, must be: dry, medium, sweet
  - flavorProfile: Must be an array of valid flavor names

✅ DEFAULT VALUES (if omitted)
  - year: "" (empty string)
  - acidity: "medium"
  - tannins: "medium"
  - bodyWeight: "medium"
  - sweetnessLevel: "dry"
  - flavorProfile: []

❌ INVALID EXAMPLES
  - Missing producer: ❌ (example: "varietal: Cabernet" without producer)
  - Price: "$65" ❌ (remove $)
  - Acidity: "super-high" ❌ (use: low, medium, high)
  - Type: "Red Wine" ❌ (use: red)
  - Year: "20th" ❌ (use: "2019" or leave blank)
  - Region: "" ❌ (required, use: "Napa Valley - CA")
```

---

## Tips for Success

1. **Use CSV for easy editing**: Most restaurant staff know Excel better than JSON
2. **Region guidance**: Be specific when possible (e.g., "Napa Valley - CA" vs just "California")
3. **Keep flavor profiles focused**: 3-5 flavors per wine is ideal
4. **Non-vintage wines**: Just leave the year cell blank in CSV
5. **Start with basics**: Required fields only, then add descriptors
6. **Validate before upload**: Check one wine works via API, then batch upload
7. **Update seasonally**: Remove wines no longer in stock, add new selections

---

## Backward Compatibility

The system maintains backward compatibility with wines uploaded using the old single `name` field. These wines will display as originally entered and will not show the new component fields. New uploads should use the new component-based structure.

---

## Support Files

### Excel Template
Download template: `RESTAURANT_WINE_MENU_TEMPLATE.csv`

Contains:
- Pre-formatted columns with new schema
- Sample wines with proper formatting
- Examples of vintage and non-vintage wines

### Python Script for Batch Upload
```python
import csv
import requests

def upload_wine_menu(restaurant_id, csv_file):
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Convert flavorProfile string to array
            if row['flavorProfile']:
                row['flavorProfile'] = [f.strip() for f in row['flavorProfile'].split(',')]

            # Remove empty strings except for year (which is allowed to be blank)
            row = {k: v if k == 'year' else v for k, v in row.items() if v}

            response = requests.post(
                f'http://api.sipsync.com/api/wines/restaurant/{restaurant_id}/add',
                json=row
            )
            print(f"{row['producer']} {row['varietal']}: {response.status_code}")

# Usage
upload_wine_menu('9dad2eoemt2ONqQFmH8T', 'wines.csv')
```

---

## Questions?

Contact support or use the API documentation at: `http://api.sipsync.com/api/docs`
