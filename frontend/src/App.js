import React, { useState, useEffect } from 'react';
import './App.css';
import AuthScreen from './components/AuthScreen';
import PairingDiscovery from './components/PairingDiscovery';
import Analytics from './components/Analytics';
import RestaurantMap from './components/RestaurantMap';
import QRScanner from './components/QRScanner';
import UserProfile from './components/UserProfile';
import WineQuiz from './components/WineQuiz';

function App() {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [preSelectedRestaurant, setPreSelectedRestaurant] = useState(null);
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [userHasPreferences, setUserHasPreferences] = useState(true);

  // Check if user is logged in on mount and handle URL routing
  useEffect(() => {
    const token = localStorage.getItem('sipsyncToken');
    const userId = localStorage.getItem('sipsyncUserId');
    if (token && userId) {
      const userData = { userId, token };
      setUser(userData);

      // Check if user has preferences
      checkUserPreferences(userId);

      // Check if there's a restaurant ID in the URL
      const pathParts = window.location.pathname.split('/');
      if (pathParts[1] === 'restaurant' && pathParts[2]) {
        setPreSelectedRestaurant(pathParts[2]);
        setCurrentScreen('discovery');
        // Clean up the URL
        window.history.replaceState({}, document.title, '/');
      } else {
        setCurrentScreen('discovery');
      }
    }
  }, []);

  // Check if user has saved preferences
  const checkUserPreferences = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/auth/user/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        if (!userData.savedPreferences || userData.savedPreferences.length === 0) {
          setUserHasPreferences(false);
          setShowQuizPrompt(true);
        } else {
          setUserHasPreferences(true);
        }
      }
    } catch (error) {
      console.error('Error checking user preferences:', error);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('sipsyncToken', userData.token);
    localStorage.setItem('sipsyncUserId', userData.userId);
    checkUserPreferences(userData.userId);
    setCurrentScreen('discovery');
  };

  const handleQuizPromptAccept = () => {
    setShowQuizPrompt(false);
    setShowQuiz(true);
  };

  const handleQuizPromptSkip = () => {
    setShowQuizPrompt(false);
  };

  const handleQuizComplete = () => {
    setShowQuiz(false);
    setUserHasPreferences(true);
    setCurrentScreen('discovery');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sipsyncToken');
    localStorage.removeItem('sipsyncUserId');
    setCurrentScreen('auth');
  };

  const handleQRScan = (restaurantId) => {
    setPreSelectedRestaurant(restaurantId);
    setShowQRScanner(false);
    setCurrentScreen('discovery');
  };

  const handleMapRestaurantSelect = (restaurantId) => {
    setPreSelectedRestaurant(restaurantId);
    setCurrentScreen('discovery');
  };

  const handleCloseScanner = () => {
    setShowQRScanner(false);
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="logo-container">
          <img src="/SipSync Logo.png" alt="SipSync" className="logo-image" />
        </div>
        {user && (
          <div className="nav-menu">
            <button
              className={`nav-btn ${currentScreen === 'discovery' ? 'active' : ''}`}
              onClick={() => {
                setCurrentScreen('discovery');
                setPreSelectedRestaurant(null);
              }}
            >
              Find Wines
            </button>
            <button
              className={`nav-btn ${currentScreen === 'map' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('map')}
            >
              Map
            </button>
            <button
              className={`nav-btn ${currentScreen === 'analytics' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('analytics')}
            >
              Trending
            </button>
            <button
              className={`nav-btn ${currentScreen === 'profile' ? 'active' : ''}`}
              onClick={() => setCurrentScreen('profile')}
            >
              Profile
            </button>
            <button
              className={`nav-btn ${showQRScanner ? 'active' : ''}`}
              onClick={() => setShowQRScanner(true)}
            >
              Scan
            </button>
            <button className="nav-btn logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </nav>

      <main className="main-content">
        {!user ? (
          <AuthScreen onLogin={handleLogin} />
        ) : showQuiz ? (
          <WineQuiz user={user} onComplete={handleQuizComplete} />
        ) : currentScreen === 'discovery' ? (
          <PairingDiscovery user={user} preSelectedRestaurant={preSelectedRestaurant} />
        ) : currentScreen === 'map' ? (
          <RestaurantMap onRestaurantSelect={handleMapRestaurantSelect} />
        ) : currentScreen === 'analytics' ? (
          <Analytics user={user} />
        ) : currentScreen === 'profile' ? (
          <UserProfile user={user} onRetakeQuiz={() => setShowQuiz(true)} />
        ) : null}
      </main>

      {showQuizPrompt && user && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <h2>Discover Your Wine Profile</h2>
            <p>Take a quick 15-question quiz to find wines tailored to your preferences. It takes about 2-3 minutes!</p>
            <div className="modal-actions">
              <button className="modal-btn primary" onClick={handleQuizPromptAccept}>
                Discover My Profile
              </button>
              <button className="modal-btn secondary" onClick={handleQuizPromptSkip}>
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showQRScanner && user && (
        <QRScanner onScan={handleQRScan} onClose={handleCloseScanner} />
      )}
    </div>
  );
}

export default App;
