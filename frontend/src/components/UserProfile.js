import React, { useState, useEffect } from 'react';
import '../styles/UserProfile.css';
import PolarGraph from './PolarGraph';
import { API_URL } from '../config';

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
      </div>
    </div>
  );
}

export default UserProfile;
