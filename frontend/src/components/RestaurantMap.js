import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/RestaurantMap.css';
import { API_URL } from '../config';

function RestaurantMap({ onRestaurantSelect }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Custom marker icon (traditional wine glass shaped)
  const customIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><g fill="%238b0000"><path d="M 7 4 L 25 4 L 22 18 Q 21 24 16 26 Q 11 24 10 18 L 7 4 Z" fill="%238b0000"/><rect x="14" y="26" width="4" height="10" fill="%238b0000"/><ellipse cx="16" cy="37" rx="6" ry="3" fill="%238b0000"/></g></svg>',
    iconSize: [32, 44],
    iconAnchor: [16, 44],
    popupAnchor: [0, -44],
  });

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/restaurants`);
      if (response.ok) {
        const data = await response.json();
        setRestaurants(data.restaurants || []);
      } else {
        setError('Failed to fetch restaurants');
      }
    } catch (err) {
      setError('Error fetching restaurants: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="map-container"><p className="loading">Loading restaurants...</p></div>;
  }

  // Filter restaurants that have coordinates (support both old and new formats)
  const restaurantsWithCoords = restaurants.filter(r => {
    // New format
    if (r.coordinates?.latitude && r.coordinates?.longitude) return true;
    // Old format (backward compatibility)
    if (r.latitude && r.longitude) return true;
    return false;
  });

  // Helper function to get coordinates from either format
  const getCoords = (restaurant) => {
    if (restaurant.coordinates) {
      return [restaurant.coordinates.latitude, restaurant.coordinates.longitude];
    }
    return [restaurant.latitude, restaurant.longitude];
  };

  return (
    <div className="map-container">
      <h2>🗺️ Find Restaurants Near You</h2>
      <p className="map-subtitle">Click on a restaurant to explore their wines</p>

      {error && <div className="error-message">{error}</div>}

      {restaurantsWithCoords.length === 0 ? (
        <div className="no-restaurants">
          <p>No restaurants with location data available yet.</p>
        </div>
      ) : (
        <>
          <div className="map-wrapper">
            <MapContainer
              center={[41.8781, -87.6298]} // Chicago center
              zoom={12}
              scrollWheelZoom={true}
              className="leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {restaurantsWithCoords.map((restaurant) => (
                <Marker
                  key={restaurant.id}
                  position={getCoords(restaurant)}
                  icon={customIcon}
                >
                  <Popup>
                    <div className="restaurant-popup">
                      <h4>{restaurant.name}</h4>
                      {restaurant.address?.street ? (
                        <>
                          <p className="location">
                            {restaurant.address.street}<br />
                            {restaurant.address.city}, {restaurant.address.state} {restaurant.address.zipCode}
                          </p>
                        </>
                      ) : (
                        <p className="location">{restaurant.city}</p>
                      )}
                      {restaurant.contact?.phone && (
                        <p className="contact-info">📞 {restaurant.contact.phone}</p>
                      )}
                      {restaurant.contact?.website && (
                        <p className="contact-info">
                          🌐 <a href={restaurant.contact.website} target="_blank" rel="noopener noreferrer">
                            Website
                          </a>
                        </p>
                      )}
                      <p className="wine-count">
                        {restaurant.wineCount || 0} wines available
                      </p>
                      <button
                        className="popup-button"
                        onClick={() => onRestaurantSelect(restaurant.restaurantId)}
                      >
                        Pair Now
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="restaurants-list-sidebar">
            <h3>Restaurants ({restaurantsWithCoords.length})</h3>
            <div className="restaurants-list">
              {restaurantsWithCoords.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="restaurant-list-item"
                  onClick={() => onRestaurantSelect(restaurant.restaurantId)}
                >
                  <div className="restaurant-info">
                    <h4>{restaurant.name}</h4>
                    {restaurant.address?.street ? (
                      <p className="city">{restaurant.address.neighborhood || restaurant.address.city}</p>
                    ) : (
                      <p className="city">{restaurant.city}</p>
                    )}
                    <p className="wine-count">
                      {restaurant.wineCount || 0} wines
                    </p>
                  </div>
                  <button className="view-btn">→</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default RestaurantMap;
