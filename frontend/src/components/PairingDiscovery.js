import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/PairingDiscovery.css';
import { API_URL } from '../config';
import SearchableSelect from './SearchableSelect';
import { useEventTracker } from '../hooks/useEventTracker';

function PairingDiscovery({ user, preSelectedRestaurant, onStartQuiz }) {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);

  const defaultPreferences = {
    wineType: 'any',
    acidity: 'medium',
    tannins: 'medium',
    bodyWeight: 'medium',
    flavorNotes: [],
    sweetness: 'dry',
    priceRange: { min: 0, max: 1000 },
    btgOnly: false,
  };

  // Mapping from quiz profiles to wine preferences
  const quizProfilesMap = {
    'full-bodied-red-enthusiast': {
      wineType: 'red',
      acidity: 'medium',
      tannins: 'high',
      bodyWeight: 'full',
      flavorNotes: ['oak', 'cherry'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'medium-bodied-red-aficionado': {
      wineType: 'red',
      acidity: 'medium',
      tannins: 'medium',
      bodyWeight: 'medium',
      flavorNotes: ['cherry', 'berry', 'vanilla'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'spiced-red-connoisseur': {
      wineType: 'red',
      acidity: 'medium',
      tannins: 'medium',
      bodyWeight: 'full',
      flavorNotes: ['spice', 'cherry'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'light-bodied-red-devotee': {
      wineType: 'red',
      acidity: 'medium',
      tannins: 'low',
      bodyWeight: 'light',
      flavorNotes: ['berry', 'earthy'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'crisp-&-acidic-white-enthusiast': {
      wineType: 'white',
      acidity: 'high',
      tannins: 'low',
      bodyWeight: 'light',
      flavorNotes: ['citrus', 'floral'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'full-bodied-white-aficionado': {
      wineType: 'white',
      acidity: 'medium',
      tannins: 'low',
      bodyWeight: 'full',
      flavorNotes: ['oak', 'vanilla', 'butter'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'aromatic-white-connoisseur': {
      wineType: 'white',
      acidity: 'medium',
      tannins: 'low',
      bodyWeight: 'light',
      flavorNotes: ['floral', 'citrus'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'fruit-forward-white-devotee': {
      wineType: 'white',
      acidity: 'medium',
      tannins: 'low',
      bodyWeight: 'medium',
      flavorNotes: ['citrus'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'sparkling-wine-enthusiast': {
      wineType: 'sparkling',
      acidity: 'high',
      tannins: 'low',
      bodyWeight: 'light',
      flavorNotes: ['citrus', 'floral'],
      sweetness: 'dry',
      priceRange: { min: 0, max: 1000 },
    },
    'dessert-wine-aficionado': {
      wineType: 'dessert',
      acidity: 'low',
      tannins: 'low',
      bodyWeight: 'medium',
      flavorNotes: ['berry', 'vanilla'],
      sweetness: 'sweet',
      priceRange: { min: 0, max: 1000 },
    },
  };

  const [preferences, setPreferences] = useState(defaultPreferences);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restaurantError, setRestaurantError] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving', 'saved', or ''
  const [quizProfile, setQuizProfile] = useState(null); // User's quiz profile name
  const [hasQuiz, setHasQuiz] = useState(false); // Whether user has taken quiz
  const [showQuizBanner, setShowQuizBanner] = useState(false); // Whether to show quiz prompt banner
  const [activeProfileName, setActiveProfileName] = useState(null); // Currently applied profile name
  const [customProfiles, setCustomProfiles] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [replaceTargetId, setReplaceTargetId] = useState('');
  const [activeInfoModal, setActiveInfoModal] = useState(null); // 'acidity', 'tannins', 'body', 'sweetness', or null
  const [confirmationModal, setConfirmationModal] = useState(null); // {wineName, show} for wine selection confirmation

  // Search mode state
  const [searchMode, setSearchMode] = useState('matching'); // 'matching' or 'search'
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Timestamp state
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingTimestamp, setLoadingTimestamp] = useState(false);

  const debounceTimer = useRef(null);
  const searchDebounceTimer = useRef(null);
  const { trackEvent } = useEventTracker(user?.userId);

  // Helper function to get display name for wines
  const getWineDisplayName = (wine) => {
    const parts = [];
    if (wine.year && wine.year.trim()) parts.push(wine.year);
    if (wine.producer && wine.producer.trim()) parts.push(wine.producer);
    if (wine.varietal && wine.varietal.trim()) parts.push(wine.varietal);
    return parts.join(' ') || wine.name || 'Unnamed Wine';
  };

  // Helper function to format timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp._seconds
      ? new Date(timestamp._seconds * 1000)
      : timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper function to get color based on match percentage
  const getMatchColor = (matchScore) => {
    const percentage = matchScore * 100;
    if (percentage > 87) return '#4CAF50'; // Green
    if (percentage >= 70) return '#FFC107'; // Yellow
    return '#FF6B6B'; // Red
  };

  // Circular progress indicator component
  const CircularProgress = ({ percentage }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const color = getMatchColor(percentage / 100);

    return (
      <svg width="70" height="70" viewBox="0 0 70 70" className="match-score-circle">
        {/* Background circle */}
        <circle cx="35" cy="35" r={radius} fill="none" stroke="#e0e0e0" strokeWidth="5" />
        {/* Progress circle */}
        <circle
          cx="35"
          cy="35"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
        {/* Text */}
        <text
          x="35"
          y="40"
          textAnchor="middle"
          fontSize="18"
          fontWeight="bold"
          fill={color}
          className="match-percentage-text"
        >
          {Math.round(percentage)}%
        </text>
      </svg>
    );
  };

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
      trackEvent('filter_applied', { restaurantId: selectedRestaurant, filterState: preferences });
    }, 500);

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, selectedRestaurant]);

  // Fetch wine list last updated timestamp when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant) {
      fetchLastUpdated(selectedRestaurant);
    } else {
      setLastUpdated(null);
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    setRestaurantError(false);
    try {
      const response = await fetch(`${API_URL}/restaurants`);
      const data = await response.json();
      const restaurantList = data.restaurants || [];
      setRestaurants(restaurantList);

      if (restaurantList.length > 0 && !preSelectedRestaurant && !selectedRestaurant) {
        if (restaurantList.length === 1) {
          setSelectedRestaurant(restaurantList[0].restaurantId);
        }
      }
    } catch (err) {
      setRestaurantError(true);
    }
  };

  const sliderValues = { 1: 'low', 2: 'medium', 3: 'high' };
  const sweetnessValues = { 1: 'dry', 2: 'medium', 3: 'sweet' };
  const bodyWeightValues = { 1: 'light', 2: 'medium', 3: 'full' };
  const reverseSlider = { low: 1, medium: 2, high: 3 };
  const reverseSweetness = { dry: 1, medium: 2, sweet: 3 };
  const reverseBodyWeight = { light: 1, medium: 2, full: 3 };

  const handleSliderChange = (key, value) => {
    setActiveProfileName(null);
    setPreferences((prev) => ({
      ...prev,
      [key]: key === 'bodyWeight' ? bodyWeightValues[value] : sliderValues[value],
    }));
  };

  const handleSweetnessChange = (value) => {
    setActiveProfileName(null);
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
    setActiveProfileName(null);
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
    setActiveProfileName(null);
    if (hasQuiz) setShowQuizBanner(true);
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

      // Load custom profiles
      if (data.customProfiles) setCustomProfiles(data.customProfiles);

      // Load most recent saved preferences (manual adjustments from user)
      if (data.savedPreferences && data.savedPreferences.length > 0) {
        const savedPrefs = data.savedPreferences[0];
        // Normalize price range to baseline $0-$1000
        if (savedPrefs.priceRange) {
          savedPrefs.priceRange.min = 0;
          savedPrefs.priceRange.max = 1000;
        }
        setPreferences(savedPrefs);
      } else {
        // No saved preferences, use defaults (but user may have quiz profile to apply)
        setPreferences(defaultPreferences);
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  const profileOptions = [
    { id: 'full-bodied-red-enthusiast',      label: 'Full-Bodied Red Enthusiast' },
    { id: 'medium-bodied-red-aficionado',    label: 'Medium-Bodied Red Aficionado' },
    { id: 'spiced-red-connoisseur',          label: 'Spiced Red Connoisseur' },
    { id: 'light-bodied-red-devotee',        label: 'Light-Bodied Red Devotee' },
    { id: 'crisp-&-acidic-white-enthusiast', label: 'Crisp & Acidic White Enthusiast' },
    { id: 'full-bodied-white-aficionado',    label: 'Full-Bodied White Aficionado' },
    { id: 'aromatic-white-connoisseur',      label: 'Aromatic White Connoisseur' },
    { id: 'fruit-forward-white-devotee',     label: 'Fruit-Forward White Devotee' },
    { id: 'sparkling-wine-enthusiast',       label: 'Sparkling Wine Enthusiast' },
    { id: 'dessert-wine-aficionado',         label: 'Dessert Wine Aficionado' },
  ];

  const applyProfileById = (profileId) => {
    if (profileId.startsWith('custom-')) {
      const customId = profileId.replace('custom-', '');
      const profile = customProfiles.find(p => p.id === customId);
      if (profile) {
        setPreferences(profile.preferences);
        setActiveProfileName(profile.name);
        setShowQuizBanner(false);
      }
      return;
    }
    const profilePreferences = quizProfilesMap[profileId];
    const option = profileOptions.find(p => p.id === profileId);
    if (profilePreferences && option) {
      setPreferences(profilePreferences);
      setActiveProfileName(option.label);
      setShowQuizBanner(false);
    }
  };

  const applyQuizProfile = () => {
    if (!quizProfile) return;
    const profileId = quizProfile.toLowerCase().replace(/\s+/g, '-');
    applyProfileById(profileId);
  };

  const toggleInfoModal = (modalName) => {
    setActiveInfoModal(activeInfoModal === modalName ? null : modalName);
  };

  const fetchLastUpdated = async (restaurantId) => {
    setLoadingTimestamp(true);
    try {
      const response = await fetch(`${API_URL}/restaurants/${restaurantId}/last-updated`);
      if (response.ok) {
        const data = await response.json();
        setLastUpdated(data.lastUpdated);
      }
    } catch (error) {
      console.error('Error fetching last updated:', error);
    } finally {
      setLoadingTimestamp(false);
    }
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

  const saveCustomProfile = async () => {
    if (!newProfileName.trim()) return;
    if (!user || !user.userId) return;

    const newProfile = {
      id: Date.now().toString(),
      name: newProfileName.trim(),
      preferences: { ...preferences },
    };

    let updatedProfiles;
    if (customProfiles.length < 3) {
      updatedProfiles = [...customProfiles, newProfile];
    } else {
      updatedProfiles = customProfiles.map(p =>
        p.id === replaceTargetId ? { ...newProfile, id: p.id } : p
      );
    }

    try {
      const response = await fetch(`${API_URL}/auth/user/${user.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customProfiles: updatedProfiles }),
      });
      if (!response.ok) throw new Error('Failed to save');
      setCustomProfiles(updatedProfiles);
      setShowSaveModal(false);
      setNewProfileName('');
      setReplaceTargetId('');
    } catch (err) {
      setError('Failed to save custom profile: ' + err.message);
    }
  };

  // Search mode functions
  const handleSearchKeywordChange = (keyword) => {
    setSearchKeyword(keyword);

    // Clear previous timer
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }

    // Don't search if less than 2 characters
    if (keyword.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Debounce for 300ms
    searchDebounceTimer.current = setTimeout(() => {
      performCrossRestaurantSearch(keyword);
    }, 300);
  };

  const performCrossRestaurantSearch = async (keyword) => {
    setSearchLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/wines/search?keyword=${encodeURIComponent(keyword)}`
      );
      const data = await response.json();

      if (response.ok) {
        console.log(`[SEARCH] Found ${data.totalWines} wines across ${data.results?.length} restaurants`);
        setSearchResults(data.results || []);
      } else {
        setError(data.error || 'Search failed');
        setSearchResults([]);
      }
    } catch (err) {
      setError('Network error: ' + err.message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const detectDuplicateWines = (results) => {
    const wineKeyMap = {}; // matchKey -> array of {restaurantName, restaurantId, price}

    results.forEach(restaurant => {
      restaurant.wines.forEach(wine => {
        if (!wineKeyMap[wine.matchKey]) {
          wineKeyMap[wine.matchKey] = [];
        }
        wineKeyMap[wine.matchKey].push({
          restaurantName: restaurant.restaurantName,
          restaurantId: restaurant.restaurantId,
          price: wine.price
        });
      });
    });

    // Filter to only wines that appear in 2+ restaurants
    const duplicates = Object.keys(wineKeyMap).filter(
      key => wineKeyMap[key].length > 1
    );

    return { wineKeyMap, duplicates };
  };

  const handleFindMatches = useCallback(async () => {
    if (!selectedRestaurant) {
      setError('Please select a restaurant');
      return;
    }

    setLoading(true);
    setError('');

    console.log('[PAIRING] Searching with preferences:', preferences);

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
        console.log('[PAIRING] Received', data.matches?.length, 'matches');
        if (data.matches?.length > 0) {
          console.log('[PAIRING] Top matches with EXACT scores:');
          data.matches.slice(0, 5).forEach((wine, i) => {
            const exactScore = wine.matchScore.toFixed(4);
            const roundedPercent = Math.round(wine.matchScore * 100);
            console.log(`  ${i + 1}. ${wine.producer} ${wine.varietal}`);
            console.log(`     Score: ${exactScore} → ${roundedPercent}% (body: ${wine.bodyWeight})`);
          });
        }
        setMatches(data.matches || []);
        if (data.matches.length === 0) {
          setError('No wines match your current preferences. Try loosening your filters — expand your price range, remove a flavor note, or adjust a slider.');
        } else {
          trackEvent('pairing_result_viewed', { restaurantId: selectedRestaurant });
        }
      } else {
        setError(data.error || 'Failed to find matches');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedRestaurant, preferences, trackEvent]);

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
          wineName: getWineDisplayName(wine),
          restaurantName: restaurants.find(r => r.restaurantId === selectedRestaurant)?.name || '',
          wineType: wine.type || '',
          acidity: wine.acidity || '',
          tannins: wine.tannins || '',
          bodyWeight: wine.bodyWeight || '',
          sweetnessLevel: wine.sweetnessLevel || ''
        }),
      });

      if (response.ok) {
        trackEvent('wine_saved', { wineId: wine.wineId, restaurantId: selectedRestaurant, wineName: getWineDisplayName(wine) });
        // Show confirmation modal with wine name
        setConfirmationModal({
          wineName: getWineDisplayName(wine),
          show: true
        });
        // Auto-close modal after 4 seconds
        setTimeout(() => {
          setConfirmationModal(null);
        }, 4000);
      } else {
        setError('Failed to save pairing');
      }
    } catch (err) {
      setError('Network error saving pairing: ' + err.message);
    }
  };

  const wineTypes = ['red', 'white', 'rosé', 'sparkling', 'dessert'];
  const flavorOptions = ['oak', 'cherry', 'citrus', 'berry', 'vanilla', 'spice', 'floral', 'chocolate', 'earthy', 'tropical', 'herbal', 'honey', 'pear', 'biscuit'];

  // Render search results grouped by restaurant
  const renderSearchResults = () => {
    if (searchKeyword.trim().length < 2) {
      return <p className="empty-state">Enter at least 2 characters to search across all restaurants</p>;
    }

    if (searchResults.length === 0 && !searchLoading) {
      return <p className="empty-state">No wines found matching "{searchKeyword}"</p>;
    }

    const { wineKeyMap, duplicates } = detectDuplicateWines(searchResults);

    return (
      <div className="restaurant-groups">
        {searchResults.map(restaurant => (
          <div key={restaurant.restaurantId} className="restaurant-group">
            <div className="restaurant-header">
              <h4>{restaurant.restaurantName}</h4>
              <span className="restaurant-city">{restaurant.restaurantCity}</span>
              <span className="wine-count">{restaurant.wines.length} {restaurant.wines.length === 1 ? 'wine' : 'wines'}</span>
            </div>
            <div className="wine-list">
              {restaurant.wines.map(wine => (
                <div
                  key={wine.wineId}
                  className={`wine-card search-result ${duplicates.includes(wine.matchKey) ? 'has-duplicate' : ''}`}
                >
                  <div className="wine-header">
                    <h4>
                      {wine.year && `${wine.year} `}
                      {wine.producer} {wine.varietal}
                    </h4>
                  </div>
                  {wine.region && (
                    <p className="wine-region">
                      <span className="region-icon">📍</span>
                      {wine.region}
                    </p>
                  )}
                  <p className="wine-type">{wine.type}</p>
                  <p className="wine-price">${wine.price}</p>
                  {wine.glassPrice && (
                    <div className="btg-banner">🥂 By the glass: ${wine.glassPrice}</div>
                  )}

                  {duplicates.includes(wine.matchKey) && (
                    <div className="price-comparison-badge">
                      <span className="badge-icon">🏷️</span>
                      <span className="badge-text">
                        Available at {wineKeyMap[wine.matchKey].length} restaurants
                      </span>
                      <div className="price-list">
                        {wineKeyMap[wine.matchKey]
                          .sort((a, b) => a.price - b.price)
                          .map((loc, i) => (
                            <div key={i} className="price-item">
                              <span>{loc.restaurantName}: ${loc.price}</span>
                              {i === 0 && <span className="best-price">Lowest</span>}
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}

                  <div className="wine-details">
                    <span className="detail"><strong>Acidity:</strong> {wine.acidity}</span>
                    <span className="detail"><strong>Tannins:</strong> {wine.tannins}</span>
                    <span className="detail"><strong>Body:</strong> {wine.bodyWeight}</span>
                    <span className="detail"><strong>Sweetness:</strong> {wine.sweetnessLevel}</span>
                  </div>

                  {wine.flavorProfile && wine.flavorProfile.length > 0 && (
                    <div className="flavor-list">
                      {wine.flavorProfile.map((flavor) => (
                        <span key={flavor} className="flavor-badge">{flavor}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Transform restaurants to options format for SearchableSelect
  const restaurantOptions = restaurants.map(r => ({
    value: r.restaurantId,
    label: `${r.name} (${r.city})`
  }));

  return (
    <div className="discovery-container">
      <h2>Find Your Perfect Wine</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Wine Selection Confirmation Modal */}
      {confirmationModal && (
        <div className="modal-overlay" onClick={() => setConfirmationModal(null)}>
          <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-icon">🍷</div>
              <h3>Wine Selected!</h3>
              <p className="selected-wine">{confirmationModal.wineName}</p>
              <p className="modal-message">
                Enjoy your wine! We hope you love this pairing as much as we do. Cheers! 🍾
              </p>
              <button
                className="modal-close-btn"
                onClick={() => setConfirmationModal(null)}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

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
                <button className="quiz-prompt-btn" onClick={onStartQuiz}>
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

      {/* Search Mode Toggle */}
      <div className="search-mode-toggle">
        <button
          className={`mode-btn ${searchMode === 'matching' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('matching');
            setSearchKeyword('');
            setSearchResults([]);
            setError('');
          }}
        >
          Find Matches
        </button>
        <button
          className={`mode-btn ${searchMode === 'search' ? 'active' : ''}`}
          onClick={() => {
            setSearchMode('search');
            setError('');
          }}
        >
          Search Wines
        </button>
      </div>

      {/* Conditional rendering based on search mode */}
      {searchMode === 'matching' ? (
        <>
          {/* Preferences Section at Top */}
          <div className="preferences-section">
        <div className="pref-row">
          <div className="pref-item">
            <label>Select Restaurant</label>
            {restaurantError ? (
              <div className="restaurant-load-error">
                Couldn't load restaurants.{' '}
                <button className="retry-link" onClick={fetchRestaurants}>Tap to retry</button>
              </div>
            ) : (
              <SearchableSelect
                options={restaurantOptions}
                value={selectedRestaurant || ''}
                onChange={(val) => {
                  setSelectedRestaurant(val);
                  if (val) trackEvent('restaurant_view', { restaurantId: val });
                }}
                placeholder="Choose a restaurant..."
              />
            )}
          </div>
        </div>

        {/* Wine List Last Updated Timestamp */}
        {selectedRestaurant && lastUpdated && (
          <div className="wine-list-updated">
            <span className="updated-icon">📅</span>
            <span>Wine list last updated: {formatDate(lastUpdated)}</span>
          </div>
        )}

        {selectedRestaurant && loadingTimestamp && (
          <div className="wine-list-updated loading">
            <span>Loading update date...</span>
          </div>
        )}

        <div className="pref-row">
          <div className="pref-item">
            <label>Quick-fill from profile</label>
            <select
              className={`profile-dropdown${!activeProfileName ? ' placeholder' : ''}`}
              value={(() => {
                if (!activeProfileName) return '';
                const match = profileOptions.find(p => p.label === activeProfileName);
                if (match) return match.id;
                const custom = customProfiles.find(p => p.name === activeProfileName);
                return custom ? `custom-${custom.id}` : '';
              })()}
              onChange={(e) => e.target.value && applyProfileById(e.target.value)}
            >
              <option value="">Choose a profile to auto-fill...</option>
              {profileOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}{quizProfile && p.label === quizProfile ? ' (Your Profile)' : ''}
                </option>
              ))}
              {customProfiles.length > 0 && (
                <optgroup label="My Profiles">
                  {customProfiles.map(p => (
                    <option key={p.id} value={`custom-${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        <div className="pref-or-divider">
          <span>OR</span>
        </div>
        <p className="pref-or-hint">Adjust as many or as few fields as you'd like — there's no wrong answer.</p>

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
                value={reverseBodyWeight[preferences.bodyWeight] || 2}
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
            <label>{preferences.btgOnly ? 'Glass Price Range' : 'Price Range'}</label>
            <div className="price-inputs">
              <input
                type="number"
                placeholder="Min"
                value={preferences.priceRange.min}
                onChange={(e) => {
                  setActiveProfileName(null);
                  setPreferences((prev) => ({
                    ...prev,
                    priceRange: {
                      ...prev.priceRange,
                      min: parseInt(e.target.value),
                    },
                  }));
                }}
              />
              <span>-</span>
              <input
                type="number"
                placeholder="Max"
                value={preferences.priceRange.max}
                onChange={(e) => {
                  setActiveProfileName(null);
                  setPreferences((prev) => ({
                    ...prev,
                    priceRange: {
                      ...prev.priceRange,
                      max: parseInt(e.target.value),
                    },
                  }));
                }}
              />
            </div>
          </div>
        </div>

        <div className="pref-row">
          <div className="pref-item btg-toggle-item">
            <button
              className={`btg-toggle-btn ${preferences.btgOnly ? 'active' : ''}`}
              onClick={() => {
                setActiveProfileName(null);
                setPreferences(prev => ({ ...prev, btgOnly: !prev.btgOnly }));
              }}
            >
              <span className="btg-toggle-icon">🥂</span>
              By the glass only
              <span className="btg-toggle-status">{preferences.btgOnly ? 'ON' : 'OFF'}</span>
            </button>
            {preferences.btgOnly && (
              <p className="btg-toggle-note">Showing only wines available by the glass. Price range applies to glass prices.</p>
            )}
          </div>
        </div>

        <div className="pref-row">
          <button className="reset-btn" onClick={handleReset}>
            Reset All
          </button>

          <button className="save-btn" onClick={() => setShowSaveModal(true)}>
            Set Current Selections as Preferred Taste Profile
          </button>

          {showSaveModal && (
            <div className="save-profile-modal">
              <input
                className="profile-name-input"
                placeholder="Name your profile (e.g. My Weekend Wines)"
                value={newProfileName}
                onChange={e => setNewProfileName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCustomProfile()}
                autoFocus
              />
              {customProfiles.length >= 3 && (
                <div className="replace-profile-selector">
                  <label>Replace existing profile:</label>
                  <select value={replaceTargetId} onChange={e => setReplaceTargetId(e.target.value)}>
                    <option value="">— Choose profile to replace —</option>
                    {customProfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="save-modal-actions">
                <button
                  className="save-btn"
                  onClick={saveCustomProfile}
                  disabled={!newProfileName.trim() || (customProfiles.length >= 3 && !replaceTargetId)}
                >
                  Save
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => { setShowSaveModal(false); setNewProfileName(''); setReplaceTargetId(''); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {loading && <p className="loading-indicator">Searching...</p>}
        {saveStatus === 'saved' && <p className="save-indicator">Preferences saved!</p>}
      </div>
      </>
      ) : (
        /* Search Mode UI */
        <div className="search-section">
          <div className="search-input-container">
            <input
              type="text"
              className="wine-search-input"
              placeholder="Search by producer, varietal, or region..."
              value={searchKeyword}
              onChange={(e) => handleSearchKeywordChange(e.target.value)}
              autoFocus
            />
            {searchKeyword && (
              <button
                className="clear-search-btn"
                onClick={() => {
                  setSearchKeyword('');
                  setSearchResults([]);
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          {searchLoading && <p className="loading-indicator">Searching across all restaurants...</p>}
        </div>
      )}

      {/* Results Section Below */}
      <div className="results-panel">
        {searchMode === 'matching' ? (
          <>
            <h3>Matching Wines</h3>
            {matches.length > 0 ? (
          <div className="wine-list">
            {matches.map((wine) => (
              <div key={wine.wineId} className="wine-card">
                <div className="wine-header">
                  <h4>
                    {wine.year && `${wine.year} `}
                    {wine.producer} {wine.varietal}
                  </h4>
                  <CircularProgress percentage={wine.matchScore * 100} />
                </div>
                {wine.region && (
                  <p className="wine-region">
                    <span className="region-icon">📍</span>
                    {wine.region}
                  </p>
                )}
                <p className="wine-type">{wine.type}</p>
                <p className="wine-price">${wine.price}</p>
                {wine.glassPrice && (
                  <div className="btg-banner">🥂 By the glass: ${wine.glassPrice}</div>
                )}
                <div className="wine-details">
                  <span className="detail">
                    <strong>Acidity:</strong> {wine.acidity}
                  </span>
                  <span className="detail">
                    <strong>Tannins:</strong> {wine.tannins}
                  </span>
                  <span className="detail">
                    <strong>Body:</strong> {wine.bodyWeight}
                  </span>
                  <span className="detail">
                    <strong>Sweetness:</strong> {wine.sweetnessLevel}
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
                <button
                  className="save-pairing-btn"
                  onClick={() => savePairing(wine)}
                >
                  ♥ Confirm Selection
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            {selectedRestaurant ? 'Adjust your preferences to find wines' : 'Select a restaurant to get started'}
          </p>
        )}
          </>
        ) : (
          <>
            <h3>Search Results</h3>
            {renderSearchResults()}
          </>
        )}
      </div>

      {/* Info Modals */}
      {activeInfoModal === 'acidity' && (
        <div className="modal-overlay" onClick={() => setActiveInfoModal(null)}>
          <div className="modal-dialog info-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="info-modal-close-btn"
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
              className="info-modal-close-btn"
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
              className="info-modal-close-btn"
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
              className="info-modal-close-btn"
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
