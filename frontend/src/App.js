import React, { useState, useEffect } from 'react';
import './App.css';
import AuthScreen from './components/AuthScreen';
import PairingDiscovery from './components/PairingDiscovery';
import Analytics from './components/Analytics';
import RestaurantMap from './components/RestaurantMap';
import QRScanner from './components/QRScanner';
import UserProfile from './components/UserProfile';

function App() {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('auth');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [preSelectedRestaurant, setPreSelectedRestaurant] = useState(null);

  // Check if user is logged in on mount and handle URL routing
  useEffect(() => {
    const token = localStorage.getItem('sipsyncToken');
    const userId = localStorage.getItem('sipsyncUserId');
    if (token && userId) {
      setUser({ userId, token });

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

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('sipsyncToken', userData.token);
    localStorage.setItem('sipsyncUserId', userData.userId);
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
          <span className="logo-text">SipSync</span>
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
        ) : currentScreen === 'discovery' ? (
          <PairingDiscovery user={user} preSelectedRestaurant={preSelectedRestaurant} />
        ) : currentScreen === 'map' ? (
          <RestaurantMap onRestaurantSelect={handleMapRestaurantSelect} />
        ) : currentScreen === 'analytics' ? (
          <Analytics user={user} />
        ) : currentScreen === 'profile' ? (
          <UserProfile user={user} />
        ) : null}
      </main>

      {showQRScanner && user && (
        <QRScanner onScan={handleQRScan} onClose={handleCloseScanner} />
      )}
    </div>
  );
}

export default App;
