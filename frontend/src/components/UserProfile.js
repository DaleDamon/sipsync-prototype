import React, { useState, useEffect } from 'react';
import '../styles/UserProfile.css';
import PolarGraph from './PolarGraph';
import { API_URL } from '../config';

function UserProfile({ user, onRetakeQuiz }) {
  const [pairingHistory, setPairingHistory] = useState([]);
  const [visitedRestaurants, setVisitedRestaurants] = useState([]);
  const [quizProfile, setQuizProfile] = useState(null);
  const [savedPreferences, setSavedPreferences] = useState(null);
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
          {quizProfile && (
            <p className="user-profile-badge">
              🍷 Wine Profile: <strong>{quizProfile}</strong>
            </p>
          )}
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
