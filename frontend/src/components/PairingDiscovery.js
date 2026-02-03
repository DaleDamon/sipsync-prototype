import React, { useState, useEffect, useRef } from 'react';
import '../styles/PairingDiscovery.css';
import { API_URL } from '../config';

function PairingDiscovery({ user, preSelectedRestaurant }) {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const defaultPreferences = {
    wineType: 'any',
    acidity: 'medium',
    tannins: 'medium',
    bodyWeight: 'medium',
    flavorNotes: [],
    sweetness: 'dry',
    priceRange: { min: 20, max: 100 },
  };

  // Mapping from quiz profiles to wine preferences
  const quizProfilesMap = {
    'full-bodied-red-enthusiast': {
      wineType: 'red',
      acidity: 'medium',
      tannins: 'high',
      bodyWeight: 'full',
      flavorNotes: ['oak', 'spice', 'cherry'],
      sweetness: 'dry',
      priceRange: { min: 20, max: 150 },
    },
    'medium-bodied-red-aficionado': {
      wineType: 'red',
      acidity: 'medium',
      tannins: 'low',
      bodyWeight: 'medium',
      flavorNotes: ['cherry', 'berry', 'vanilla'],
      sweetness: 'medium',
      priceRange: { min: 20, max: 100 },
    },
    'spiced-red-connoisseur': {
      wineType: 'red',
      acidity: 'medium',
      tannins: 'medium',
      bodyWeight: 'full',
      flavorNotes: ['spice', 'cherry', 'oak'],
      sweetness: 'dry',
      priceRange: { min: 20, max: 120 },
    },
    'light-bodied-red-devotee': {
      wineType: 'red',
      acidity: 'high',
      tannins: 'low',
      bodyWeight: 'light',
      flavorNotes: ['berry', 'floral', 'citrus'],
      sweetness: 'dry',
      priceRange: { min: 15, max: 80 },
    },
    'crisp-acidic-white-enthusiast': {
      wineType: 'white',
      acidity: 'high',
      tannins: 'low',
      bodyWeight: 'light',
      flavorNotes: ['citrus', 'floral'],
      sweetness: 'dry',
      priceRange: { min: 15, max: 80 },
    },
    'full-bodied-white-aficionado': {
      wineType: 'white',
      acidity: 'low',
      tannins: 'low',
      bodyWeight: 'full',
      flavorNotes: ['oak', 'vanilla'],
      sweetness: 'dry',
      priceRange: { min: 25, max: 150 },
    },
    'aromatic-white-connoisseur': {
      wineType: 'white',
      acidity: 'medium',
      tannins: 'low',
      bodyWeight: 'medium',
      flavorNotes: ['floral', 'citrus', 'spice'],
      sweetness: 'medium',
      priceRange: { min: 20, max: 100 },
    },
    'fruit-forward-white-devotee': {
      wineType: 'white',
      acidity: 'medium',
      tannins: 'low',
      bodyWeight: 'medium',
      flavorNotes: ['citrus', 'berry'],
      sweetness: 'medium',
      priceRange: { min: 15, max: 90 },
    },
    'sparkling-wine-enthusiast': {
      wineType: 'sparkling',
      acidity: 'high',
      tannins: 'low',
      bodyWeight: 'light',
      flavorNotes: ['citrus', 'floral'],
      sweetness: 'dry',
      priceRange: { min: 15, max: 100 },
    },
    'dessert-wine-aficionado': {
      wineType: 'dessert',
      acidity: 'low',
      tannins: 'low',
      bodyWeight: 'medium',
      flavorNotes: ['berry', 'vanilla'],
      sweetness: 'sweet',
      priceRange: { min: 15, max: 120 },
    },
  };

  const [preferences, setPreferences] = useState(defaultPreferences);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', or ''
  const [quizProfile, setQuizProfile] = useState(null); // User's quiz profile name
  const [hasQuiz, setHasQuiz] = useState(false); // Whether user has taken quiz
  const [showQuizBanner, setShowQuizBanner] = useState(false); // Whether to show quiz prompt banner
  const [activeInfoModal, setActiveInfoModal] = useState(null); // 'acidity', 'tannins', 'body', 'sweetness', or null

  const debounceTimer = useRef(null);

  // Fetch restaurants on mount and load saved preferences
  useEffect(() => {
    fetchRestaurants();
    loadUserPreferences();
  }, [user]);

  // Update selected restaurant when pre-selected restaurant prop changes
  useEffect(() => {
    if (preSelectedRestaurant) {
      setSelectedRestaurant(preSelectedRestaurant);
    }
  }, [preSelectedRestaurant]);

  // Auto-search when preferences change (with debounce)
  useEffect(() => {
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Only search if restaurant is selected
    if (!selectedRestaurant) {
      setMatches([]);
      setError('');
      return;
    }

    // Set new timer - search after 500ms of inactivity
    debounceTimer.current = setTimeout(() => {
      handleFindMatches();
    }, 500);

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [preferences, selectedRestaurant]);

  const fetchRestaurants = async () => {
    try {
      const response = await fetch(`${API_URL}/restaurants`);
      const data = await response.json();
      setRestaurants(data.restaurants || []);
    } catch (err) {
      setError('Failed to fetch restaurants: ' + err.message);
    }
  };

  const sliderValues = { 1: 'low', 2: 'medium', 3: 'high' };
  const sweetnessValues = { 1: 'dry', 2: 'medium', 3: 'sweet' };
  const reverseSlider = { low: 1, medium: 2, high: 3 };
  const reverseSweetness = { dry: 1, medium: 2, sweet: 3 };

  const handleSliderChange = (key, value) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: sliderValues[value],
    }));
  };

  const handleSweetnessChange = (value) => {
    setPreferences((prev) => ({
      ...prev,
      sweetness: sweetnessValues[value],
    }));
  };

  const handleWineTypeToggle = (type) => {
    setPreferences((prev) => ({
      ...prev,
      wineType: prev.wineType === type ? 'any' : type,
    }));
  };

  const handleFlavorToggle = (flavor) => {
    setPreferences((prev) => {
      const flavors = prev.flavorNotes.includes(flavor)
        ? prev.flavorNotes.filter((f) => f !== flavor)
        : [...prev.flavorNotes, flavor];
      return { ...prev, flavorNotes: flavors };
    });
  };

  const handleReset = () => {
    setPreferences(defaultPreferences);
    setMatches([]);
    setError('');
  };

  const loadUserPreferences = async () => {
    if (!user || !user.userId) return;

    try {
      const response = await fetch(`${API_URL}/auth/user/${user.userId}`);
      if (!response.ok) return;

      const data = await response.json();

      // Check if user has taken the quiz and store quiz profile
      if (data.quizProfile) {
        setQuizProfile(data.quizProfile);
        setHasQuiz(true);
        // Show banner prompting to apply profile
        setShowQuizBanner(true);
      } else {
        setHasQuiz(false);
        setShowQuizBanner(true); // Show banner prompting to take quiz
      }

      // Load most recent saved preferences (manual adjustments from user)
      if (data.savedPreferences && data.savedPreferences.length > 0) {
        setPreferences(data.savedPreferences[0]);
      } else {
        // No saved preferences, use defaults (but user may have quiz profile to apply)
        setPreferences(defaultPreferences);
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  const applyQuizProfile = () => {
    if (!quizProfile) return;

    // Get the profile ID from the quiz profile name (convert to lowercase with hyphens)
    const profileId = quizProfile.toLowerCase().replace(/\s+/g, '-');
    const profilePreferences = quizProfilesMap[profileId];

    if (profilePreferences) {
      // Apply the quiz profile preferences
      setPreferences(profilePreferences);
      setShowQuizBanner(false);
    }
  };

  const toggleInfoModal = (modalName) => {
    setActiveInfoModal(activeInfoModal === modalName ? null : modalName);
  };

  const savePreferences = async () => {
    if (!user || !user.userId) {
      setError('Must be logged in to save preferences');
      return;
    }

    try {
      setSaveStatus('saving');
      const response = await fetch(`${API_URL}/auth/user/${user.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedPreferences: [preferences],
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000); // Clear status after 2 seconds
    } catch (err) {
      setError('Failed to save preferences: ' + err.message);
      setSaveStatus('');
    }
  };

  const handleFindMatches = async () => {
    if (!selectedRestaurant) {
      setError('Please select a restaurant');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/pairings/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: selectedRestaurant,
          userPreferences: preferences,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMatches(data.matches || []);
        if (data.matches.length === 0) {
          setError('No wines match your preferences at this restaurant');
        }
      } else {
        setError(data.error || 'Failed to find matches');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const savePairing = async (wine) => {
    if (!user || !user.userId) {
      setError('Must be logged in to save pairings');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/pairings/save-pairing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          restaurantId: selectedRestaurant,
          wineId: wine.wineId,
          matchScore: wine.matchScore,
          wineName: wine.name,
          restaurantName: restaurants.find(r => r.restaurantId === selectedRestaurant)?.name || ''
        }),
      });

      if (response.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(''), 2000);
      } else {
        setError('Failed to save pairing');
      }
    } catch (err) {
      setError('Network error saving pairing: ' + err.message);
    }
  };

  const wineTypes = ['red', 'white', 'rosé', 'sparkling', 'dessert'];
  const flavorOptions = ['oak', 'cherry', 'citrus', 'berry', 'vanilla', 'spice', 'floral', 'chocolate', 'earthy', 'tropical', 'herbal', 'honey'];

  return (
    <div className="discovery-container">
      <h2>Find Your Perfect Wine</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Quiz Profile Banner */}
      {showQuizBanner && (
        <div className="quiz-banner">
          {hasQuiz ? (
            <div className="banner-content">
              <div className="banner-text">
                <h3>✨ Your Wine Profile Ready</h3>
                <p>Apply your personalized taste profile from the wine quiz to instantly match wines tailored to you.</p>
              </div>
              <div className="banner-actions">
                <button className="apply-profile-btn" onClick={applyQuizProfile}>
                  Apply My Taste Profile
                </button>
                <button
                  className="banner-close-btn"
                  onClick={() => setShowQuizBanner(false)}
                  aria-label="Close banner"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div className="banner-content">
              <div className="banner-text">
                <h3>🎯 Discover Your Wine Profile</h3>
                <p>Take a quick 15-question quiz to get personalized wine recommendations based on your taste preferences.</p>
              </div>
              <div className="banner-actions">
                <button className="quiz-prompt-btn" onClick={() => window.location.href = '/'}>
                  Take the Quiz
                </button>
                <button
                  className="banner-close-btn"
                  onClick={() => setShowQuizBanner(false)}
                  aria-label="Close banner"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preferences Section at Top */}
      <div className="preferences-section">
        <div className="pref-row">
          <div className="pref-item">
            <label>Select Restaurant</label>
            <select
              value={selectedRestaurant || ''}
              onChange={(e) => setSelectedRestaurant(e.target.value)}
            >
              <option value="">Choose a restaurant...</option>
              {restaurants.map((rest) => (
                <option key={rest.restaurantId} value={rest.restaurantId}>
                  {rest.name} ({rest.city})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pref-row">
          <div className="pref-item">
            <label>Wine Type</label>
            <div className="wine-type-buttons">
              {wineTypes.map((type) => (
                <button
                  key={type}
                  className={`type-btn ${preferences.wineType === type ? 'selected' : ''}`}
                  onClick={() => handleWineTypeToggle(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pref-row sliders-row">
          <div className="pref-item slider-item">
            <label>
              Acidity
              <span
                className="info-icon"
                onClick={() => toggleInfoModal('acidity')}
                title="Learn about acidity"
              >
                ℹ️
              </span>
            </label>
            <div className="slider-container">
              <span className="slider-label">Low</span>
              <input
                type="range"
                min="1"
                max="3"
                value={reverseSlider[preferences.acidity]}
                onChange={(e) => handleSliderChange('acidity', e.target.value)}
                className="slider"
              />
              <span className="slider-label">High</span>
            </div>
            <p className="slider-value">{preferences.acidity}</p>
          </div>

          <div className="pref-item slider-item">
            <label>
              Tannins
              <span
                className="info-icon"
                onClick={() => toggleInfoModal('tannins')}
                title="Learn about tannins"
              >
                ℹ️
              </span>
            </label>
            <div className="slider-container">
              <span className="slider-label">Low</span>
              <input
                type="range"
                min="1"
                max="3"
                value={reverseSlider[preferences.tannins]}
                onChange={(e) => handleSliderChange('tannins', e.target.value)}
                className="slider"
              />
              <span className="slider-label">High</span>
            </div>
            <p className="slider-value">{preferences.tannins}</p>
          </div>

          <div className="pref-item slider-item">
            <label>
              Body Weight
              <span
                className="info-icon"
                onClick={() => toggleInfoModal('body')}
                title="Learn about body weight"
              >
                ℹ️
              </span>
            </label>
            <div className="slider-container">
              <span className="slider-label">Light</span>
              <input
                type="range"
                min="1"
                max="3"
                value={reverseSlider[preferences.bodyWeight]}
                onChange={(e) => handleSliderChange('bodyWeight', e.target.value)}
                className="slider"
              />
              <span className="slider-label">Full</span>
            </div>
            <p className="slider-value">{preferences.bodyWeight}</p>
          </div>

          <div className="pref-item slider-item">
            <label>
              Sweetness
              <span
                className="info-icon"
                onClick={() => toggleInfoModal('sweetness')}
                title="Learn about sweetness"
              >
                ℹ️
              </span>
            </label>
            <div className="slider-container">
              <span className="slider-label">Dry</span>
              <input
                type="range"
                min="1"
                max="3"
                value={reverseSweetness[preferences.sweetness]}
                onChange={(e) => handleSweetnessChange(e.target.value)}
                className="slider"
              />
              <span className="slider-label">Sweet</span>
            </div>
            <p className="slider-value">{preferences.sweetness}</p>
          </div>
        </div>

        <div className="pref-row">
          <div className="pref-item">
            <label>Flavor Notes</label>
            <div className="flavor-tags">
              {flavorOptions.map((flavor) => (
                <button
                  key={flavor}
                  className={`flavor-tag ${preferences.flavorNotes.includes(flavor) ? 'selected' : ''}`}
                  onClick={() => handleFlavorToggle(flavor)}
                >
                  {flavor}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pref-row">
          <div className="pref-item">
            <label>Price Range</label>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                value={preferences.priceRange.min}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    priceRange: {
                      ...prev.priceRange,
                      min: parseInt(e.target.value),
                    },
                  }))
                }
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Max"
                value={preferences.priceRange.max}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    priceRange: {
                      ...prev.priceRange,
                      max: parseInt(e.target.value),
                    },
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="pref-row">
          <button className="reset-btn" onClick={handleReset}>
            Reset All
          </button>

          <button className="save-btn" onClick={savePreferences} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Preferences'}
          </button>
        </div>

        {loading && <p className="loading-indicator">Searching...</p>}
        {saveStatus === 'saved' && <p className="save-indicator">Preferences saved!</p>}
      </div>

      {/* Results Section Below */}
      <div className="results-panel">
        <h3>Matching Wines</h3>
        {matches.length > 0 ? (
          <div className="wine-list">
            {matches.map((wine) => (
              <div key={wine.wineId} className="wine-card">
                <div className="wine-header">
                  <h4>{wine.name}</h4>
                  <span className="match-score">{(wine.matchScore * 100).toFixed(0)}% match</span>
                </div>
                <p className="wine-type">{wine.type}</p>
                <p className="wine-price">${wine.price}</p>
                <div className="wine-details">
                  <span className="detail">
                    <strong>Acidity:</strong> {wine.acidity}
                  </span>
                  <span className="detail">
                    <strong>Body:</strong> {wine.bodyWeight}
                  </span>
                </div>
                {wine.flavorProfile && wine.flavorProfile.length > 0 && (
                  <div className="flavor-list">
                    {wine.flavorProfile.map((flavor) => (
                      <span key={flavor} className="flavor-badge">
                        {flavor}
                      </span>
                    ))}
                  </div>
                )}
                {wine.foodPairings && wine.foodPairings.length > 0 && (
                  <div className="food-pairings">
                    <p className="pairings-title">Pairs with:</p>
                    {wine.foodPairings.map((pairing) => (
                      <div key={pairing.pairingId} className="food-pairing-item">
                        <p className="food-name">{pairing.foodItem.name}</p>
                        {pairing.foodItem.description && (
                          <p className="food-description">{pairing.foodItem.description}</p>
                        )}
                        {pairing.pairingReason && (
                          <p className="pairing-reason">{pairing.pairingReason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="save-pairing-btn"
                  onClick={() => savePairing(wine)}
                >
                  ♥ Save Pairing
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            {selectedRestaurant ? 'Adjust your preferences to find wines' : 'Select a restaurant to get started'}
          </p>
        )}
      </div>

      {/* Info Modals */}
      {activeInfoModal === 'acidity' && (
        <div className="modal-overlay" onClick={() => setActiveInfoModal(null)}>
          <div className="modal-dialog info-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setActiveInfoModal(null)}
              aria-label="Close modal"
            >
              ✕
            </button>
            <h2>Understanding Acidity</h2>
            <div className="characteristic-explanation">
              <div className="char-left">
                <h3>Soft</h3>
                <p>Low acidity wines feel round and smooth on your tongue, like drinking a ripe peach or honey. Think: full-bodied reds from warm climates. Won't make your mouth pucker.</p>
              </div>
              <div className="char-arrow">→</div>
              <div className="char-right">
                <h3>Acidic</h3>
                <p>High acidity wines make your mouth water—they taste bright and zippy like a fresh lemon or lime. Think: Sauvignon Blancs, Rieslings. They feel refreshing and crisp on your palate.</p>
              </div>
            </div>
            <button
              className="modal-btn primary"
              onClick={() => setActiveInfoModal(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {activeInfoModal === 'tannins' && (
        <div className="modal-overlay" onClick={() => setActiveInfoModal(null)}>
          <div className="modal-dialog info-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setActiveInfoModal(null)}
              aria-label="Close modal"
            >
              ✕
            </button>
            <h2>Understanding Tannins</h2>
            <div className="characteristic-explanation">
              <div className="char-left">
                <h3>Smooth</h3>
                <p>Low tannin wines feel soft and silky in your mouth—like drinking a pinot noir or a white wine. No drying sensation. Your mouth doesn't feel dry or cottony after sipping.</p>
              </div>
              <div className="char-arrow">→</div>
              <div className="char-right">
                <h3>Tannic</h3>
                <p>High tannin wines make your mouth feel dry and slightly puckered—like biting into grape skin. Think: Cabernet, Malbec. They're bold and gripping. Good with steak and meat.</p>
              </div>
            </div>
            <button
              className="modal-btn primary"
              onClick={() => setActiveInfoModal(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {activeInfoModal === 'body' && (
        <div className="modal-overlay" onClick={() => setActiveInfoModal(null)}>
          <div className="modal-dialog info-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setActiveInfoModal(null)}
              aria-label="Close modal"
            >
              ✕
            </button>
            <h2>Understanding Body Weight</h2>
            <div className="characteristic-explanation">
              <div className="char-left">
                <h3>Light</h3>
                <p>Light body wines feel thin and delicate on your tongue—like skim milk or sparkling water. Think: Pinot Grigio, Prosecco. Refreshing and easy to drink.</p>
              </div>
              <div className="char-arrow">→</div>
              <div className="char-right">
                <h3>Full</h3>
                <p>Full body wines feel rich and heavy on your tongue—like whole milk or cream. Think: Cabernet, Chardonnay. They coat your mouth with flavor and feel luxurious.</p>
              </div>
            </div>
            <button
              className="modal-btn primary"
              onClick={() => setActiveInfoModal(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {activeInfoModal === 'sweetness' && (
        <div className="modal-overlay" onClick={() => setActiveInfoModal(null)}>
          <div className="modal-dialog info-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setActiveInfoModal(null)}
              aria-label="Close modal"
            >
              ✕
            </button>
            <h2>Understanding Sweetness</h2>
            <div className="characteristic-explanation">
              <div className="char-left">
                <h3>Dry</h3>
                <p>Dry wines have little to no residual sugar—they taste savory or mineral, not sweet. Think: most reds, Sauvignon Blanc. If you don't like sugary drinks, you'll prefer this.</p>
              </div>
              <div className="char-arrow">→</div>
              <div className="char-right">
                <h3>Sweet</h3>
                <p>Sweet wines taste like dessert—they leave sugar on your palate. Think: Moscato, Riesling, Port. Great with dessert or on their own if you like sweetness.</p>
              </div>
            </div>
            <button
              className="modal-btn primary"
              onClick={() => setActiveInfoModal(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PairingDiscovery;
