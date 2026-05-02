import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/WineOriginMap.css';
import { API_URL } from '../config';

// Ordered most-specific to most-generic — first match wins
const REGION_LOOKUP = [
  // ── California: sub-appellations first ──
  { keywords: ['oakville', 'rutherford', 'st. helena', 'yountville', 'calistoga', 'stags leap', 'howell mountain', 'coombsville', 'diamond mountain', 'spring mountain', 'mount veeder', 'atlas peak'], lat: 38.5, lng: -122.4, label: 'Napa Valley' },
  { keywords: ['napa'], lat: 38.5, lng: -122.4, label: 'Napa Valley' },
  { keywords: ['russian river', 'alexander valley', 'dry creek', 'chalk hill', 'knights valley', 'sonoma coast', 'west sonoma', 'carneros', 'petaluma gap'], lat: 38.35, lng: -122.75, label: 'Sonoma' },
  { keywords: ['sonoma'], lat: 38.35, lng: -122.75, label: 'Sonoma' },
  { keywords: ['paso robles'], lat: 35.6, lng: -120.7, label: 'Paso Robles' },
  { keywords: ['santa rita hills', 'sta. rita', 'santa barbara', 'santa maria', 'santa ynez', 'ballard canyon', 'happy canyon'], lat: 34.7, lng: -119.7, label: 'Santa Barbara' },
  { keywords: ['santa lucia', 'arroyo seco', 'santa cruz mountains', 'livermore', 'chalone'], lat: 36.6, lng: -121.5, label: 'Central Coast' },
  { keywords: ['central coast'], lat: 36.3, lng: -121.0, label: 'Central Coast' },
  { keywords: ['anderson valley', 'mendocino'], lat: 39.3, lng: -123.4, label: 'Mendocino' },
  { keywords: ['lodi'], lat: 38.1, lng: -121.3, label: 'Lodi' },
  { keywords: ['north coast'], lat: 38.8, lng: -122.9, label: 'North Coast' },
  { keywords: ['california'], lat: 36.7, lng: -119.4, label: 'California' },

  // ── Pacific Northwest ──
  { keywords: ['willamette', 'dundee', 'eola', 'amity', 'chehalem', 'ribbon ridge', 'mcminnville'], lat: 45.3, lng: -123.1, label: 'Willamette Valley' },
  { keywords: ['oregon'], lat: 44.0, lng: -120.5, label: 'Oregon' },
  { keywords: ['columbia valley', 'walla walla', 'red mountain', 'yakima', 'horse heaven'], lat: 46.6, lng: -120.5, label: 'Washington State' },
  { keywords: ['washington'], lat: 47.4, lng: -120.5, label: 'Washington State' },

  // ── France: village/commune → major region ──
  { keywords: ['gevrey', 'chambertin', 'meursault', 'chassagne', 'puligny', 'montrachet', 'vosne', 'nuits-saint', 'chambolle', 'pommard', 'volnay', 'côte de beaune', 'cote de beaune', 'côte de nuits', 'cote de nuits', 'bourgogne', 'mâcon', 'macon', 'pouilly-fuissé', 'pouilly-fuisse', 'beaune'], lat: 47.05, lng: 4.85, label: 'Burgundy' },
  { keywords: ['burgundy', 'chablis'], lat: 47.05, lng: 4.85, label: 'Burgundy' },
  { keywords: ['pauillac', 'margaux', 'pomerol', 'saint-emilion', 'st. émilion', 'st. emilion', 'saint émilion', 'médoc', 'medoc', 'graves', 'sauternes', 'pessac', 'saint-estèphe', 'moulis', 'listrac'], lat: 44.84, lng: -0.58, label: 'Bordeaux' },
  { keywords: ['bordeaux'], lat: 44.84, lng: -0.58, label: 'Bordeaux' },
  { keywords: ['reims', 'epernay', 'épernay', 'hautvillers', 'aÿ', 'ay,'], lat: 49.0, lng: 4.0, label: 'Champagne' },
  { keywords: ['champagne'], lat: 49.0, lng: 4.0, label: 'Champagne' },
  { keywords: ['châteauneuf', 'chateauneuf', 'gigondas', 'vacqueyras', 'côtes du rhône', 'cotes du rhone', 'hermitage', 'crozes', 'condrieu', 'côte-rôtie', 'cote-rotie', 'saint-joseph', 'cairanne'], lat: 44.0, lng: 4.8, label: 'Rhone Valley' },
  { keywords: ['rhône', 'rhone'], lat: 44.0, lng: 4.8, label: 'Rhone Valley' },
  { keywords: ['sancerre', 'muscadet', 'vouvray', 'chinon', 'anjou', 'touraine', 'pouilly-fumé', 'pouilly-fume', 'bourgueil', 'samur', 'saumur'], lat: 47.7, lng: 1.0, label: 'Loire Valley' },
  { keywords: ['loire'], lat: 47.7, lng: 1.0, label: 'Loire Valley' },
  { keywords: ['alsace'], lat: 48.3, lng: 7.4, label: 'Alsace' },
  { keywords: ['bandol', 'côtes de provence', 'cotes de provence'], lat: 43.5, lng: 5.9, label: 'Provence' },
  { keywords: ['provence'], lat: 43.5, lng: 5.9, label: 'Provence' },
  { keywords: ['languedoc', 'roussillon', 'pic saint-loup', 'fitou', 'corbières', 'corbieres', 'minervois'], lat: 43.6, lng: 3.8, label: 'Languedoc' },
  { keywords: ['beaujolais', 'morgon', 'fleurie', 'moulin-à-vent', 'moulin-a-vent', 'brouilly', 'chiroubles', 'juliénas'], lat: 46.2, lng: 4.6, label: 'Beaujolais' },
  { keywords: ['jura', 'savoy', 'savoie'], lat: 46.6, lng: 5.8, label: 'Jura & Savoie' },
  { keywords: ['france'], lat: 46.6, lng: 2.4, label: 'France' },

  // ── Italy: DOCG/DOC zone → region ──
  { keywords: ['chianti', 'brunello', 'montalcino', 'bolgheri', 'maremma', 'super tuscan', 'morellino', 'vernaccia', 'vino nobile'], lat: 43.5, lng: 11.2, label: 'Tuscany' },
  { keywords: ['tuscany', 'toscana'], lat: 43.5, lng: 11.2, label: 'Tuscany' },
  { keywords: ['barolo', 'barbaresco', 'langhe', 'barbera', 'dolcetto', 'gavi', 'asti', 'moscato d\'asti', 'roero'], lat: 44.7, lng: 8.0, label: 'Piedmont' },
  { keywords: ['piedmont', 'piemonte'], lat: 44.7, lng: 8.0, label: 'Piedmont' },
  { keywords: ['amarone', 'valpolicella', 'soave', 'prosecco', 'bardolino', 'recioto', 'lugana', 'custoza', 'venice'], lat: 45.5, lng: 11.5, label: 'Veneto' },
  { keywords: ['veneto'], lat: 45.5, lng: 11.5, label: 'Veneto' },
  { keywords: ['etna', 'nero d\'avola', 'grillo', 'catarratto', 'marsala', 'cerasuolo di vittoria', 'nerello'], lat: 37.6, lng: 14.0, label: 'Sicily' },
  { keywords: ['sicily', 'sicilia'], lat: 37.6, lng: 14.0, label: 'Sicily' },
  { keywords: ['taurasi', 'fiano', 'greco di tufo', 'irpinia', 'campi flegrei', 'lacryma christi', 'aglianico'], lat: 40.8, lng: 14.8, label: 'Campania' },
  { keywords: ['campania'], lat: 40.8, lng: 14.8, label: 'Campania' },
  { keywords: ['franciacorta', 'valtellina', 'oltrepò', 'lugana'], lat: 45.5, lng: 9.5, label: 'Lombardy' },
  { keywords: ['lombardy', 'lombardia'], lat: 45.5, lng: 9.5, label: 'Lombardy' },
  { keywords: ['primitivo', 'salento', 'negroamaro', 'manduria', 'negro amaro'], lat: 41.0, lng: 16.5, label: 'Puglia' },
  { keywords: ['puglia', 'apulia'], lat: 41.0, lng: 16.5, label: 'Puglia' },
  { keywords: ['sagrantino', 'orvieto', 'montefalco', 'torgiano'], lat: 43.0, lng: 12.5, label: 'Umbria' },
  { keywords: ['umbria'], lat: 43.0, lng: 12.5, label: 'Umbria' },
  { keywords: ['collio', 'colli orientali', 'friuli', 'fruili'], lat: 46.0, lng: 13.5, label: 'Friuli' },
  { keywords: ['montepulciano d\'abruzzo', 'trebbiano d\'abruzzo'], lat: 42.1, lng: 13.9, label: 'Abruzzo' },
  { keywords: ['abruzzo'], lat: 42.1, lng: 13.9, label: 'Abruzzo' },
  { keywords: ['verdicchio', 'rosso conero', 'lacrima di morro'], lat: 43.3, lng: 13.0, label: 'Marche' },
  { keywords: ['marche'], lat: 43.3, lng: 13.0, label: 'Marche' },
  { keywords: ['cannonau', 'vermentino di sardegna', 'carignano del sulcis'], lat: 40.1, lng: 9.0, label: 'Sardinia' },
  { keywords: ['sardinia', 'sardegna'], lat: 40.1, lng: 9.0, label: 'Sardinia' },
  { keywords: ['alto adige', 'südtirol', 'sudtirol', 'trentino', 'lagrein', 'trentino-alto'], lat: 46.4, lng: 11.2, label: 'Trentino' },
  { keywords: ["valle d'aosta", "valle d'aosta"], lat: 45.7, lng: 7.3, label: 'Aosta Valley' },
  { keywords: ['lambrusco', 'sangiovese di romagna', 'emilia', 'romagna', 'pignoletto'], lat: 44.5, lng: 11.3, label: 'Emilia-Romagna' },
  { keywords: ['italy', 'italia'], lat: 42.5, lng: 12.5, label: 'Italy' },

  // ── Spain ──
  { keywords: ['rioja'], lat: 42.3, lng: -2.5, label: 'Rioja' },
  { keywords: ['ribera del duero', 'ribero del duero'], lat: 41.6, lng: -3.7, label: 'Ribera del Duero' },
  { keywords: ['priorat'], lat: 41.2, lng: 0.8, label: 'Priorat' },
  { keywords: ['rías baixas', 'rias baixas', 'albariño', 'albarino', 'galicia'], lat: 42.5, lng: -8.6, label: 'Rias Baixas' },
  { keywords: ['penedès', 'penedes', 'cava', 'catalonia', 'cataluña'], lat: 41.4, lng: 1.7, label: 'Penedes' },
  { keywords: ['binissalem', 'mallorca', 'balearic'], lat: 39.6, lng: 2.9, label: 'Mallorca' },
  { keywords: ['bierzo', 'mencía', 'mencia'], lat: 42.6, lng: -6.7, label: 'Bierzo' },
  { keywords: ['jerez', 'sherry', 'manzanilla', 'fino'], lat: 36.7, lng: -6.1, label: 'Jerez' },
  { keywords: ['spain', 'españa', 'espana'], lat: 40.4, lng: -3.7, label: 'Spain' },

  // ── Germany ──
  { keywords: ['mosel', 'moselle', 'saar,', 'ruwer'], lat: 50.0, lng: 7.0, label: 'Mosel' },
  { keywords: ['rheinhessen', 'rheingau', 'pfalz', 'nahe', 'württemberg', 'franken', 'rhein', 'rhine'], lat: 49.9, lng: 8.2, label: 'Rhine Valley' },
  { keywords: ['germany', 'deutschland'], lat: 51.2, lng: 10.5, label: 'Germany' },

  // ── Portugal ──
  { keywords: ['douro', 'porto,', 'tawny', 'vintage port'], lat: 41.2, lng: -7.9, label: 'Douro' },
  { keywords: ['madeira'], lat: 32.8, lng: -17.0, label: 'Madeira' },
  { keywords: ['vinho verde', 'alentejo', 'dão', 'dao,', 'bairrada', 'setúbal', 'setubal'], lat: 39.4, lng: -8.2, label: 'Portugal' },
  { keywords: ['portugal'], lat: 39.4, lng: -8.2, label: 'Portugal' },

  // ── South America ──
  { keywords: ['uco valley', 'lujan de cuyo', 'luján', 'mendoza'], lat: -32.9, lng: -68.8, label: 'Mendoza' },
  { keywords: ['argentina'], lat: -34.0, lng: -64.0, label: 'Argentina' },
  { keywords: ['maipo', 'colchagua', 'casablanca', 'itata', 'maule', 'aconcagua', 'leyda'], lat: -33.5, lng: -70.7, label: 'Chile' },
  { keywords: ['chile'], lat: -33.5, lng: -70.7, label: 'Chile' },

  // ── Australasia ──
  { keywords: ['marlborough', "hawke's bay", 'hawkes bay', 'central otago', 'martinborough', 'wairarapa', 'waipara'], lat: -41.5, lng: 173.9, label: 'New Zealand' },
  { keywords: ['new zealand'], lat: -41.5, lng: 173.9, label: 'New Zealand' },
  { keywords: ['barossa', 'clare valley', 'mclaren vale', 'eden valley', 'coonawarra', 'yarra valley', 'margaret river', 'hunter valley', 'adelaide hills'], lat: -34.5, lng: 139.0, label: 'Australia' },
  { keywords: ['australia'], lat: -34.5, lng: 139.0, label: 'Australia' },

  // ── Rest of World ──
  { keywords: ['santorini', 'assyrtiko', 'nemea', 'peloponnese', 'amyndeon', 'naoussa', 'drama', 'makedonia', 'crete'], lat: 38.0, lng: 23.7, label: 'Greece' },
  { keywords: ['greece', 'greek'], lat: 38.0, lng: 23.7, label: 'Greece' },
  { keywords: ['wachau', 'grüner', 'gruner', 'burgenland', 'kamptal', 'kremstal', 'neusiedlersee'], lat: 47.5, lng: 14.5, label: 'Austria' },
  { keywords: ['austria', 'österreich'], lat: 47.5, lng: 14.5, label: 'Austria' },
  { keywords: ['bekaa', 'beqaa', 'baalbek', 'zahle'], lat: 33.8, lng: 35.9, label: 'Bekaa Valley' },
  { keywords: ['lebanon', 'liban'], lat: 33.8, lng: 35.9, label: 'Lebanon' },
  { keywords: ['stellenbosch', 'constantia', 'swartland', 'franschhoek', 'paarl', 'robertson', 'elgin'], lat: -33.9, lng: 18.7, label: 'South Africa' },
  { keywords: ['south africa'], lat: -33.9, lng: 18.7, label: 'South Africa' },
  { keywords: ['guadalupe', 'baja california', 'valle de guadalupe', 'baja'], lat: 31.9, lng: -116.6, label: 'Guadalupe Valley' },
  { keywords: ['mexico', 'méxico'], lat: 23.6, lng: -102.5, label: 'Mexico' },
  { keywords: ['tokaj', 'tokaji', 'eger', 'villány', 'villany'], lat: 47.5, lng: 19.1, label: 'Hungary' },
  { keywords: ['hungary'], lat: 47.5, lng: 19.1, label: 'Hungary' },
  { keywords: ['israel', 'galilee', 'golan', 'judean'], lat: 31.5, lng: 34.9, label: 'Israel' },
  { keywords: ['kakheti', 'kartli', 'georgia'], lat: 41.7, lng: 44.8, label: 'Georgia' },
  { keywords: ['croatia', 'dalmatia', 'istria', 'slavonia'], lat: 45.1, lng: 15.2, label: 'Croatia' },
];

const TYPE_COLORS = {
  red: '#8b0000',
  white: '#c5a84f',
  'rosé': '#c97a94',
  rose: '#c97a94',
  sparkling: '#5a9fc0',
  dessert: '#9e6b3c',
};

function normalizeRegion(str) {
  if (!str) return null;
  const lower = str.toLowerCase();
  for (const entry of REGION_LOOKUP) {
    if (entry.keywords.some(kw => lower.includes(kw))) return entry;
  }
  return null;
}

function dominantColor(wines) {
  const counts = {};
  wines.forEach(w => { const t = (w.wineType || 'red').toLowerCase(); counts[t] = (counts[t] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'red';
  return TYPE_COLORS[top] || '#8b0000';
}

function bubbleRadius(count) {
  return Math.min(9 + Math.log(count + 1) * 7, 42);
}

function MapBoundsUpdater({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    const bounds = markers.map(m => [m.lat, m.lng]);
    if (bounds.length === 1) {
      map.setView(bounds[0], 5);
    } else {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 6 });
    }
  }, [map, markers.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function WineOriginMap({ userId }) {
  const [origins, setOrigins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_URL}/analytics/user/${userId}/wine-origins`)
      .then(r => {
        if (!r.ok) { setFetchFailed(true); return []; }
        return r.json();
      })
      .then(data => setOrigins(Array.isArray(data) ? data : []))
      .catch(() => setFetchFailed(true))
      .finally(() => setLoading(false));
  }, [userId]);

  // Group by canonical region
  const regionMap = {};
  origins.forEach(wine => {
    const resolved = normalizeRegion(wine.region);
    if (!resolved) return;
    const key = resolved.label;
    if (!regionMap[key]) regionMap[key] = { ...resolved, wines: [], count: 0 };
    regionMap[key].wines.push(wine);
    regionMap[key].count++;
  });
  const markers = Object.values(regionMap).sort((a, b) => b.count - a.count);

  const totalResolved = markers.reduce((s, m) => s + m.count, 0);

  if (loading) {
    return (
      <div className="wom-wrap">
        <div className="wom-loading">Loading your wine world…</div>
      </div>
    );
  }

  if (fetchFailed) {
    return (
      <div className="wom-wrap">
        <div className="wom-empty">
          <div className="wom-empty-icon">🌍</div>
          <p>Map is warming up — refresh in a moment.</p>
        </div>
      </div>
    );
  }

  if (markers.length === 0) {
    return (
      <div className="wom-wrap">
        <div className="wom-empty">
          <div className="wom-empty-icon">🌍</div>
          <p>Save wines to build your personal wine world map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wom-wrap">
      <div className="wom-header">
        <div>
          <h4 className="wom-title">Your Wine World</h4>
          <p className="wom-sub">
            {markers.length} region{markers.length !== 1 ? 's' : ''} · {totalResolved} wine{totalResolved !== 1 ? 's' : ''} mapped
          </p>
        </div>
        <div className="wom-legend">
          {Object.entries(TYPE_COLORS).filter(([t]) => !['rose'].includes(t)).map(([type, color]) => (
            <span key={type} className="wom-legend-item">
              <span className="wom-legend-dot" style={{ background: color }} />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          ))}
        </div>
      </div>

      <div className="wom-map-wrap">
        <MapContainer
          center={[30, 10]}
          zoom={2}
          className="wom-map"
          scrollWheelZoom={false}
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <MapBoundsUpdater markers={markers} />

          {markers.map(m => (
            <CircleMarker
              key={m.label}
              center={[m.lat, m.lng]}
              radius={bubbleRadius(m.count)}
              pathOptions={{
                fillColor: dominantColor(m.wines),
                fillOpacity: 0.82,
                color: '#fff',
                weight: 1.5,
              }}
            >
              <Tooltip
                permanent
                direction="top"
                offset={[0, -bubbleRadius(m.count) - 2]}
                className="wom-region-label"
              >
                {m.label}
              </Tooltip>
              <Popup className="wom-popup-wrap">
                <div className="wom-popup">
                  <div className="wom-popup-region">{m.label}</div>
                  <div className="wom-popup-count">{m.count} wine{m.count !== 1 ? 's' : ''} saved</div>
                  <ul className="wom-popup-list">
                    {m.wines.slice(0, 6).map((w, i) => (
                      <li key={i} className="wom-popup-wine">
                        <span
                          className="wom-popup-dot"
                          style={{ background: TYPE_COLORS[(w.wineType || 'red').toLowerCase()] || '#8b0000' }}
                        />
                        <span className="wom-popup-name">{w.wineName || 'Unknown wine'}</span>
                        {w.matchScore > 0 && (
                          <span className="wom-popup-score">{Math.round(w.matchScore * 100)}%</span>
                        )}
                      </li>
                    ))}
                    {m.wines.length > 6 && (
                      <li className="wom-popup-more">+{m.wines.length - 6} more</li>
                    )}
                  </ul>
                  <div className="wom-popup-rest">{m.wines[0]?.restaurantName}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default WineOriginMap;
