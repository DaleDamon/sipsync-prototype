import React, { useState, useEffect } from 'react';
import '../styles/UserProfile.css';
import PolarGraph from './PolarGraph';
import WineOriginMap from './WineOriginMap';
import { API_URL } from '../config';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

const QUIZ_PROFILES = [
  { id: 'full-bodied-red-enthusiast',      name: 'Full-Bodied Red Enthusiast',      preferences: { wineType: 'red',      acidity: 'medium', tannins: 'high',   bodyWeight: 'full',   flavorNotes: ['oak', 'cherry'],          sweetness: 'dry',    priceRange: { min: 0, max: 1000 } } },
  { id: 'medium-bodied-red-aficionado',    name: 'Medium-Bodied Red Aficionado',    preferences: { wineType: 'red',      acidity: 'medium', tannins: 'medium', bodyWeight: 'medium', flavorNotes: ['cherry', 'berry', 'vanilla'], sweetness: 'dry', priceRange: { min: 0, max: 1000 } } },
  { id: 'spiced-red-connoisseur',          name: 'Spiced Red Connoisseur',          preferences: { wineType: 'red',      acidity: 'medium', tannins: 'medium', bodyWeight: 'full',   flavorNotes: ['spice', 'cherry'],         sweetness: 'dry',    priceRange: { min: 0, max: 1000 } } },
  { id: 'light-bodied-red-devotee',        name: 'Light-Bodied Red Devotee',        preferences: { wineType: 'red',      acidity: 'medium', tannins: 'low',    bodyWeight: 'light',  flavorNotes: ['berry', 'earthy'],         sweetness: 'dry',    priceRange: { min: 0, max: 1000 } } },
  { id: 'crisp-acidic-white-enthusiast',   name: 'Crisp & Acidic White Enthusiast', preferences: { wineType: 'white',    acidity: 'high',   tannins: 'low',    bodyWeight: 'light',  flavorNotes: ['citrus', 'floral'],        sweetness: 'dry',    priceRange: { min: 0, max: 1000 } } },
  { id: 'full-bodied-white-aficionado',    name: 'Full-Bodied White Aficionado',    preferences: { wineType: 'white',    acidity: 'medium', tannins: 'low',    bodyWeight: 'full',   flavorNotes: ['oak', 'vanilla', 'butter'], sweetness: 'dry',  priceRange: { min: 0, max: 1000 } } },
  { id: 'aromatic-white-connoisseur',      name: 'Aromatic White Connoisseur',      preferences: { wineType: 'white',    acidity: 'medium', tannins: 'low',    bodyWeight: 'medium', flavorNotes: ['floral', 'citrus'],        sweetness: 'dry',    priceRange: { min: 0, max: 1000 } } },
  { id: 'fruit-forward-white-devotee',     name: 'Fruit-Forward White Devotee',     preferences: { wineType: 'white',    acidity: 'medium', tannins: 'low',    bodyWeight: 'medium', flavorNotes: ['citrus'],                  sweetness: 'dry',    priceRange: { min: 0, max: 1000 } } },
  { id: 'sparkling-wine-enthusiast',       name: 'Sparkling Wine Enthusiast',       preferences: { wineType: 'sparkling', acidity: 'high',  tannins: 'low',    bodyWeight: 'light',  flavorNotes: ['citrus', 'floral'],        sweetness: 'dry',    priceRange: { min: 0, max: 1000 } } },
  { id: 'dessert-wine-aficionado',         name: 'Dessert Wine Aficionado',         preferences: { wineType: 'dessert',  acidity: 'low',    tannins: 'low',    bodyWeight: 'medium', flavorNotes: ['berry', 'vanilla'],        sweetness: 'sweet',  priceRange: { min: 0, max: 1000 } } },
];

function UserProfile({ user, onRetakeQuiz }) {
  const [pairingHistory, setPairingHistory] = useState([]);
  const [visitedRestaurants, setVisitedRestaurants] = useState([]);
  const [quizProfile, setQuizProfile] = useState(null);
  const [savedPreferences, setSavedPreferences] = useState(null);
  const [customProfiles, setCustomProfiles] = useState([]);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.userId) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch user data to get quiz profile and preferences
      const userResponse = await fetch(
        `${API_URL}/auth/user/${user.userId}`
      );
      const userData = await userResponse.json();
      if (userResponse.ok) {
        if (userData.quizProfile) {
          setQuizProfile(userData.quizProfile);
        }
        if (userData.savedPreferences && userData.savedPreferences.length > 0) {
          setSavedPreferences(userData.savedPreferences[0]);
        }
        if (userData.customProfiles) setCustomProfiles(userData.customProfiles);
      }

      // Fetch pairing history
      const historyResponse = await fetch(
        `${API_URL}/auth/user/${user.userId}/pairing-history?limit=50`
      );
      const historyData = await historyResponse.json();
      if (historyResponse.ok) {
        setPairingHistory(historyData.pairingHistory || []);
      }

      // Fetch visited restaurants
      const restaurantsResponse = await fetch(
        `${API_URL}/auth/user/${user.userId}/visited-restaurants`
      );
      const restaurantsData = await restaurantsResponse.json();
      if (restaurantsResponse.ok) {
        setVisitedRestaurants(restaurantsData.visitedRestaurants || []);
      }

      // Fetch analytics (non-blocking — don't fail if this endpoint errors)
      try {
        const analyticsRes = await fetch(`${API_URL}/analytics/user/${user.userId}`);
        if (analyticsRes.ok) {
          setUserAnalytics(await analyticsRes.json());
        }
      } catch (_) { /* analytics is non-critical */ }
    } catch (err) {
      setError('Failed to load profile data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomProfile = async (profileId) => {
    const updated = customProfiles.filter(p => p.id !== profileId);
    try {
      const response = await fetch(`${API_URL}/auth/user/${user.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customProfiles: updated }),
      });
      if (!response.ok) throw new Error('Failed to delete');
      setCustomProfiles(updated);
    } catch (err) {
      setError('Failed to delete profile: ' + err.message);
    }
  };

  const renameCustomProfile = async (profileId) => {
    if (!editingProfileName.trim()) return;
    const updated = customProfiles.map(p =>
      p.id === profileId ? { ...p, name: editingProfileName.trim() } : p
    );
    try {
      const response = await fetch(`${API_URL}/auth/user/${user.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customProfiles: updated }),
      });
      if (!response.ok) throw new Error('Failed to rename');
      setCustomProfiles(updated);
      setEditingProfileId(null);
      setEditingProfileName('');
    } catch (err) {
      setError('Failed to rename profile: ' + err.message);
    }
  };

  const handleProfileChange = async (value) => {
    let newName, newPreferences;
    if (value.startsWith('custom-')) {
      const customId = value.replace('custom-', '');
      const profile = customProfiles.find(p => p.id === customId);
      if (!profile) return;
      newName = profile.name;
      newPreferences = profile.preferences;
    } else {
      const profile = QUIZ_PROFILES.find(p => p.id === value);
      if (!profile) return;
      newName = profile.name;
      newPreferences = profile.preferences;
    }
    setProfileSaving(true);
    try {
      const response = await fetch(`${API_URL}/auth/user/${user.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizProfile: newName,
          savedPreferences: [newPreferences],
        }),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      setQuizProfile(newName);
      setSavedPreferences(newPreferences);
    } catch (err) {
      setError('Failed to update profile: ' + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  if (loading) {
    return (
      <div className="profile-container">
        <p className="loading">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2>Your Profile</h2>
        <div className="user-info">
          <p className="user-name">{user?.userId || 'User'}</p>
          <div className="user-profile-selector">
            <label className="user-profile-selector-label">🍷 Wine Profile</label>
            <select
              className="user-profile-selector-select"
              value={
                (() => {
                  if (!quizProfile) return '';
                  const quiz = QUIZ_PROFILES.find(p => p.name === quizProfile);
                  if (quiz) return quiz.id;
                  const custom = customProfiles.find(p => p.name === quizProfile);
                  return custom ? `custom-${custom.id}` : '';
                })()
              }
              onChange={e => e.target.value && handleProfileChange(e.target.value)}
              disabled={profileSaving}
            >
              {!quizProfile && <option value="">— Select a profile —</option>}
              <optgroup label="Standard Profiles">
                {QUIZ_PROFILES.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </optgroup>
              {customProfiles.length > 0 && (
                <optgroup label="My Custom Profiles">
                  {customProfiles.map(p => (
                    <option key={p.id} value={`custom-${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {profileSaving && <span className="user-profile-saving">Saving…</span>}
          </div>
          <p className="user-stats">
            {pairingHistory.length} saved pairings • {visitedRestaurants.length} restaurants
          </p>
        </div>
        {onRetakeQuiz && (
          <button className="retake-quiz-btn" onClick={onRetakeQuiz}>
            Retake Wine Quiz
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {quizProfile && savedPreferences && (
        <PolarGraph preferences={savedPreferences} profileName={quizProfile} />
      )}

      <WineOriginMap userId={user?.userId} />

      {customProfiles.length > 0 && (
        <div className="section">
          <h3>My Wine Profiles</h3>
          <div className="custom-profile-list">
            {customProfiles.map(p => (
              <div key={p.id} className="custom-profile-item">
                {editingProfileId === p.id ? (
                  <>
                    <input
                      className="custom-profile-rename-input"
                      value={editingProfileName}
                      onChange={e => setEditingProfileName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && renameCustomProfile(p.id)}
                      autoFocus
                    />
                    <button className="custom-profile-icon-btn" onClick={() => renameCustomProfile(p.id)} title="Save">✓</button>
                    <button className="custom-profile-icon-btn" onClick={() => setEditingProfileId(null)} title="Cancel">✕</button>
                  </>
                ) : (
                  <>
                    <span className="custom-profile-name">{p.name}</span>
                    <button
                      className="custom-profile-icon-btn"
                      onClick={() => { setEditingProfileId(p.id); setEditingProfileName(p.name); }}
                      title="Rename"
                    >✏️</button>
                    <button
                      className="custom-profile-icon-btn"
                      onClick={() => deleteCustomProfile(p.id)}
                      title="Delete"
                    >🗑️</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="profile-content">
        {/* Recent Pairings Section */}
        <div className="section">
          <h3>Recent Pairings</h3>
          {pairingHistory.length > 0 ? (
            <div className="pairings-list">
              {pairingHistory.map((pairing) => (
                <div key={pairing.historyId} className="pairing-card">
                  <div className="pairing-header">
                    <div className="pairing-info">
                      <h4>{pairing.wineName}</h4>
                      <p className="restaurant-name">{pairing.restaurantName}</p>
                    </div>
                    <span className="match-score">
                      {(pairing.matchScore * 100).toFixed(0)}% match
                    </span>
                  </div>
                  <p className="saved-date">Saved {formatDate(pairing.saved_at)}</p>
                  {pairing.notes && <p className="pairing-notes">{pairing.notes}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              No saved pairings yet. Find some wines and save your favorites!
            </p>
          )}
        </div>

        {/* Visited Restaurants Section */}
        <div className="section">
          <h3>Visited Restaurants</h3>
          {visitedRestaurants.length > 0 ? (
            <div className="restaurants-list">
              {visitedRestaurants.map((restaurant) => (
                <div key={restaurant.restaurantId} className="restaurant-card">
                  <div className="restaurant-header">
                    <div className="restaurant-info">
                      <h4>{restaurant.restaurantName}</h4>
                      <p className="restaurant-city">{restaurant.city}</p>
                    </div>
                    <span className="pairing-count">{restaurant.pairingCount} pairings</span>
                  </div>
                  <p className="last-visit">Last visited {formatDate(restaurant.lastVisit)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">
              No visited restaurants yet. Start exploring!
            </p>
          )}
        </div>

        {/* My Analytics Section */}
        {(() => {
          const totalPairings = userAnalytics?.totalPairings ?? pairingHistory.length;
          const restaurantsExplored = userAnalytics?.restaurantsExplored ?? visitedRestaurants.length;
          const avgMatchScore = pairingHistory.length > 0
            ? Math.round(pairingHistory.reduce((s, p) => s + (p.matchScore || 0), 0) / pairingHistory.length * 100)
            : null;
          const totalSessions = userAnalytics?.totalSessions ?? null;

          const topVarietals = userAnalytics?.topVarietals ?? (() => {
            const counts = {};
            pairingHistory.forEach(p => { const v = p.wineType || 'Unknown'; counts[v] = (counts[v] || 0) + 1; });
            return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
          })();

          const matchScoreOverTime = userAnalytics?.matchScoreOverTime ?? pairingHistory.slice(0, 20).reverse().map(p => ({
            date: new Date(p.saved_at).toLocaleDateString(),
            score: Math.round((p.matchScore || 0) * 100),
          }));

          // Wine type breakdown — fallback to local pairing history
          const wineTypeBreakdown = userAnalytics?.wineTypeBreakdown ?? (() => {
            if (!pairingHistory.length) return null;
            const counts = {};
            pairingHistory.forEach(p => { const t = p.wineType || 'unknown'; counts[t] = (counts[t] || 0) + 1; });
            return Object.entries(counts).sort((a, b) => b[1] - a[1])
              .map(([type, count]) => ({ type, count, pct: Math.round(count / pairingHistory.length * 100) }));
          })();
          const dominantType = userAnalytics?.dominantType ?? (wineTypeBreakdown?.[0]?.type || null);

          // Comfort zone — fallback from local match scores
          const comfortZone = userAnalytics?.comfortZone ?? (() => {
            if (!pairingHistory.length) return null;
            const adventurous = pairingHistory.filter(p => (p.matchScore || 0) < 0.85).length;
            const pct = Math.round(adventurous / pairingHistory.length * 100);
            return { adventurousPct: pct, label: pct >= 40 ? 'Adventurous Sipper' : pct >= 20 ? 'Curious Explorer' : 'Profile Loyalist' };
          })();

          // Favorite restaurant — fallback from visitedRestaurants
          const favoriteRestaurant = userAnalytics?.favoriteRestaurant ?? (() => {
            if (!visitedRestaurants.length) return null;
            const top = [...visitedRestaurants].sort((a, b) => (b.pairingCount || 0) - (a.pairingCount || 0))[0];
            return top ? { id: top.restaurantId, name: top.restaurantName, count: top.pairingCount || 0 } : null;
          })();

          const priceTendency = userAnalytics?.priceTendency ?? null;
          const regionsExplored = userAnalytics?.regionsExplored ?? [];
          const palateRealityCheck = userAnalytics?.palateRealityCheck ?? null;
          const nextWine = userAnalytics?.nextWineRecommendation ?? null;

          const typeColors = { red: '#8b0000', white: '#c9a96e', rosé: '#d4829a', sparkling: '#6baed6', dessert: '#9e6b3c' };

          return (
            <div className="section user-analytics-section">
              <h3>My Analytics</h3>

              {/* Stat cards */}
              <div className="user-analytics-stats">
                <div className="user-analytics-stat">
                  <div className="user-analytics-stat-value">{totalPairings}</div>
                  <div className="user-analytics-stat-label">Saved Pairings</div>
                </div>
                <div className="user-analytics-stat">
                  <div className="user-analytics-stat-value">{restaurantsExplored}</div>
                  <div className="user-analytics-stat-label">Restaurants Explored</div>
                </div>
                <div className="user-analytics-stat">
                  <div className="user-analytics-stat-value">{avgMatchScore != null ? `${avgMatchScore}%` : '—'}</div>
                  <div className="user-analytics-stat-label">Avg Match Score</div>
                </div>
                <div className="user-analytics-stat">
                  <div className="user-analytics-stat-value">{totalSessions ?? '—'}</div>
                  <div className="user-analytics-stat-label">App Sessions</div>
                </div>
              </div>

              {/* Row: Comfort Zone + Favorite Restaurant + Price */}
              {(comfortZone || favoriteRestaurant || priceTendency) && (
                <div className="ua-insight-row">
                  {comfortZone && (
                    <div className="ua-insight-card">
                      <div className="ua-insight-label">Your Sipping Style</div>
                      <div className="ua-insight-value">{comfortZone.label}</div>
                      <div className="ua-insight-sub">
                        {comfortZone.adventurousPct}% of saves were outside your profile
                      </div>
                    </div>
                  )}
                  {favoriteRestaurant && (
                    <div className="ua-insight-card">
                      <div className="ua-insight-label">Favorite Spot</div>
                      <div className="ua-insight-value">{favoriteRestaurant.name}</div>
                      <div className="ua-insight-sub">{favoriteRestaurant.count} wines saved here</div>
                    </div>
                  )}
                  {priceTendency && (
                    <div className="ua-insight-card">
                      <div className="ua-insight-label">Your Price Range</div>
                      <div className="ua-insight-value">${priceTendency.min}–${priceTendency.max}</div>
                      <div className="ua-insight-sub">avg ${priceTendency.avg} per bottle</div>
                    </div>
                  )}
                </div>
              )}

              {/* Wine type breakdown */}
              {wineTypeBreakdown && wineTypeBreakdown.length > 0 && (
                <div className="user-analytics-chart">
                  <h4>
                    Your Wine Breakdown
                    {dominantType && <span className="ua-dominant-label"> — {dominantType.charAt(0).toUpperCase() + dominantType.slice(1)} dominant</span>}
                  </h4>
                  <div className="ua-type-bar-track">
                    {wineTypeBreakdown.map(({ type, pct }) => (
                      <div
                        key={type}
                        className="ua-type-bar-segment"
                        style={{ width: `${pct}%`, background: typeColors[type] || '#999' }}
                        title={`${type}: ${pct}%`}
                      />
                    ))}
                  </div>
                  <div className="ua-type-legend">
                    {wineTypeBreakdown.map(({ type, count, pct }) => (
                      <div key={type} className="ua-type-legend-item">
                        <span className="ua-type-dot" style={{ background: typeColors[type] || '#999' }} />
                        <span className="ua-type-name">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                        <span className="ua-type-pct">{pct}% ({count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Palate reality check */}
              {palateRealityCheck?.hasDrift && (
                <div className="ua-palate-check">
                  <div className="ua-palate-check-title">Palate Reality Check</div>
                  <p className="ua-palate-check-sub">Your recent saves differ from your quiz profile in {palateRealityCheck.drifts.length} dimension{palateRealityCheck.drifts.length > 1 ? 's' : ''} — your palate may be evolving.</p>
                  <div className="ua-palate-drifts">
                    {palateRealityCheck.drifts.map(({ dimension, quiz, actual }) => (
                      <div key={dimension} className="ua-palate-drift-row">
                        <span className="ua-drift-dim">{dimension.charAt(0).toUpperCase() + dimension.slice(1)}</span>
                        <span className="ua-drift-quiz">{quiz}</span>
                        <span className="ua-drift-arrow">→</span>
                        <span className="ua-drift-actual">{actual}</span>
                      </div>
                    ))}
                  </div>
                  <p className="ua-palate-retake">Tastes change. <button className="ua-retake-link" onClick={onRetakeQuiz}>Retake the quiz</button> to update your profile.</p>
                </div>
              )}

              {/* Regions explored */}
              {regionsExplored.length > 0 && (
                <div className="user-analytics-chart">
                  <h4>Regions Explored <span className="ua-region-count">({regionsExplored.length})</span></h4>
                  <div className="ua-region-tags">
                    {regionsExplored.map(r => (
                      <span key={r} className="ua-region-tag">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Next wine recommendation */}
              {nextWine && (
                <div className="ua-next-wine">
                  <div className="ua-next-wine-label">Your Next Wine</div>
                  <div className="ua-next-wine-name">{nextWine.wineName}</div>
                  <div className="ua-next-wine-meta">
                    {nextWine.wineType && <span className="ua-next-type">{nextWine.wineType.charAt(0).toUpperCase() + nextWine.wineType.slice(1)}</span>}
                    {nextWine.region && <span className="ua-next-region">{nextWine.region}</span>}
                    {nextWine.price > 0 && <span className="ua-next-price">${nextWine.price}</span>}
                  </div>
                  <div className="ua-next-wine-rest">Available at {nextWine.restaurantName} · {nextWine.matchPct}% match</div>
                </div>
              )}

              {/* Top Varietals */}
              {topVarietals.length > 0 && (
                <div className="user-analytics-chart">
                  <h4>Top Wine Types</h4>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={topVarietals} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => [`${v} selections`, 'Count']} />
                      <Bar dataKey="count" fill="#722F37" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Match Score over time */}
              {matchScoreOverTime.length > 1 && (
                <div className="user-analytics-chart">
                  <h4>Match Score History</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={matchScoreOverTime} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                      <Tooltip formatter={(v) => [`${v}%`, 'Match Score']} />
                      <Line type="monotone" dataKey="score" stroke="#722F37" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default UserProfile;
