import React, { useState, useEffect, useRef } from 'react';
import '../styles/UserProfile.css';
import PolarGraph from './PolarGraph';
import WineOriginMap from './WineOriginMap';
import { API_URL } from '../config';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

function UserProfile({ user, onRetakeQuiz, onUnratedCount, focusUnrated, onFocusHandled }) {
  const [pairingHistory, setPairingHistory] = useState([]);
  const [visitedRestaurants, setVisitedRestaurants] = useState([]);
  const [quizProfile, setQuizProfile] = useState(null);
  const [savedPreferences, setSavedPreferences] = useState(null);
  const [customProfiles, setCustomProfiles] = useState([]);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [userAnalytics, setUserAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState(null);
  const [showAllPairings, setShowAllPairings] = useState(false);
  const [showAllRestaurants, setShowAllRestaurants] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const firstUnratedRef = useRef(null);

  useEffect(() => {
    if (user && user.userId) {
      fetchUserData();
      fetchRecommendations();
    }
  }, [user?.userId]);

  useEffect(() => {
    if (focusUnrated && !loading && firstUnratedRef.current) {
      firstUnratedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (onFocusHandled) onFocusHandled();
    }
  }, [focusUnrated, loading]);

  const submitRating = async (rating) => {
    if (!ratingModal) return;
    const { historyId } = ratingModal;
    setRatingModal(null);
    try {
      await fetch(`${API_URL}/pairings/rating`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sipsyncToken')}`,
        },
        body: JSON.stringify({ userId: user.userId, pairingHistoryId: historyId, rating }),
      });
      setPairingHistory(prev => {
        const updated = prev.map(p => p.historyId === historyId ? { ...p, rating } : p);
        if (onUnratedCount) onUnratedCount(updated.filter(p => !p.rating).length);
        return updated;
      });
    } catch (_) {}
  };

  const fetchRecommendations = async () => {
    try {
      const res = await fetch(`${API_URL}/analytics/user/${user.userId}/recommendations`);
      setRecommendations(res.ok ? await res.json() : []);
    } catch (_) {
      setRecommendations([]);
    } finally {
      setRecsLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      setLoading(true);
      setError('');

      const [userResponse, historyResponse, restaurantsResponse] = await Promise.all([
        fetch(`${API_URL}/auth/user/${user.userId}`),
        fetch(`${API_URL}/auth/user/${user.userId}/pairing-history?limit=50`),
        fetch(`${API_URL}/auth/user/${user.userId}/visited-restaurants`),
      ]);

      const [userData, historyData, restaurantsData] = await Promise.all([
        userResponse.json(),
        historyResponse.json(),
        restaurantsResponse.json(),
      ]);

      if (userResponse.ok) {
        if (userData.quizProfile) setQuizProfile(userData.quizProfile);
        if (userData.savedPreferences?.length > 0) setSavedPreferences(userData.savedPreferences[0]);
        if (userData.customProfiles) setCustomProfiles(userData.customProfiles);
      }

      if (historyResponse.ok) {
        const history = historyData.pairingHistory || [];
        setPairingHistory(history);
        if (onUnratedCount) onUnratedCount(history.filter(p => !p.rating).length);
      }

      if (restaurantsResponse.ok) {
        setVisitedRestaurants(restaurantsData.visitedRestaurants || []);
      }

      // Analytics is non-critical — fire and forget after main data loads
      fetch(`${API_URL}/analytics/user/${user.userId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setUserAnalytics(data); })
        .catch(() => {});

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
          <p className="user-name">{user?.name || 'You'}</p>
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
          <div className="section-header-row">
            <h3>Recent Pairings</h3>
            {pairingHistory.length > 5 && (
              <button className="see-all-btn" onClick={() => setShowAllPairings(v => !v)}>
                {showAllPairings ? 'Show less' : `See all (${pairingHistory.length})`}
              </button>
            )}
          </div>
          {pairingHistory.length > 0 ? (
            <div className="pairings-list">
              {(showAllPairings ? pairingHistory : pairingHistory.slice(0, 5)).map((pairing, idx) => {
                const isFirstUnrated = !pairing.rating && idx === pairingHistory.findIndex(p => !p.rating);
                return (
                  <div
                    key={pairing.historyId}
                    ref={isFirstUnrated ? firstUnratedRef : null}
                    className={`pairing-card${!pairing.rating ? ' pairing-card--unrated' : ''}`}
                  >
                    <div className="pairing-header">
                      <div className="pairing-info">
                        <h4>{pairing.wineName}</h4>
                        <p className="restaurant-name">{pairing.restaurantName}</p>
                      </div>
                      <div className="pairing-header-right">
                        {pairing.rating ? (
                          <span className={`pairing-rating pairing-rating--${pairing.rating}`}>
                            {pairing.rating === 'pass' ? 'Pass' : pairing.rating === 'pour' ? 'Pour' : 'Cellar'}
                          </span>
                        ) : (
                          <button
                            className="rate-it-btn"
                            onClick={() => setRatingModal({ historyId: pairing.historyId, wineName: pairing.wineName })}
                          >
                            Rate it
                          </button>
                        )}
                        <span className="match-score">
                          {(pairing.matchScore * 100).toFixed(0)}% match
                        </span>
                      </div>
                    </div>
                    <p className="saved-date">Saved {formatDate(pairing.saved_at)}</p>
                    {pairing.notes && <p className="pairing-notes">{pairing.notes}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">
              No saved pairings yet. Find some wines and save your favorites!
            </p>
          )}
        </div>

        {/* Visited Restaurants Section */}
        <div className="section">
          <div className="section-header-row">
            <h3>Visited Restaurants</h3>
            {visitedRestaurants.length > 5 && (
              <button className="see-all-btn" onClick={() => setShowAllRestaurants(v => !v)}>
                {showAllRestaurants ? 'Show less' : `See all (${visitedRestaurants.length})`}
              </button>
            )}
          </div>
          {visitedRestaurants.length > 0 ? (
            <div className="restaurants-list">
              {(showAllRestaurants ? visitedRestaurants : visitedRestaurants.slice(0, 5)).map((restaurant) => (
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
          const palateRealityCheck = userAnalytics?.palateRealityCheck ?? null;
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


              {/* Next wine recommendations — 3 cards */}
              <div className="user-analytics-chart">
                <h4>Your Next Wines</h4>
                {recsLoading ? (
                  <p className="ua-palate-check-sub">Finding wines for you…</p>
                ) : recommendations.length === 0 ? (
                  <p className="ua-palate-check-sub">Save more wines to unlock personalized recommendations.</p>
                ) : (
                  <div className="ua-recs-row">
                    {recommendations.map((rec, i) => (
                      <div key={rec.wineId || i} className="ua-rec-card">
                        <div className="ua-rec-rank">#{i + 1}</div>
                        <div className="ua-rec-name">{rec.wineName}</div>
                        <div className="ua-rec-meta">
                          {rec.wineType && <span className="ua-next-type">{rec.wineType.charAt(0).toUpperCase() + rec.wineType.slice(1)}</span>}
                          {rec.region   && <span className="ua-next-region">{rec.region}</span>}
                          {rec.price > 0 && <span className="ua-next-price">${rec.price}</span>}
                        </div>
                        <div className="ua-rec-scores">
                          <span>Quiz: {rec.quizMatchPct}%</span>
                          <span>Taste: {rec.savedMatchPct}%</span>
                        </div>
                        {rec.restaurantName && (
                          <div className="ua-next-wine-rest">At {rec.restaurantName}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>


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

      {ratingModal && (
        <div className="rating-sheet-overlay" onClick={() => setRatingModal(null)}>
          <div className="rating-sheet" onClick={e => e.stopPropagation()}>
            <p className="rating-sheet-wine">{ratingModal.wineName}</p>
            <p className="rating-sheet-prompt">How was it?</p>
            <div className="rating-sheet-buttons">
              <button className="rating-btn rating-pass" onClick={() => submitRating('pass')}>
                <span className="rating-btn-label">Pass</span>
                <span className="rating-btn-desc">Not for me</span>
              </button>
              <button className="rating-btn rating-pour" onClick={() => submitRating('pour')}>
                <span className="rating-btn-label">Pour</span>
                <span className="rating-btn-desc">Would order again</span>
              </button>
              <button className="rating-btn rating-cellar" onClick={() => submitRating('cellar')}>
                <span className="rating-btn-label">Cellar</span>
                <span className="rating-btn-desc">Absolutely loved it</span>
              </button>
            </div>
            <button className="rating-skip" onClick={() => setRatingModal(null)}>cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfile;
