import React, { useState, useEffect } from 'react';
import '../styles/Analytics.css';
import { API_URL } from '../config';

function Analytics({ user }) {
  const [stats, setStats] = useState(null);
  const [popularWines, setPopularWines] = useState([]);
  const [topPairings, setTopPairings] = useState([]);
  const [preferencesTrends, setPreferencesTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const [statsRes, winesRes, pairingsRes, trendsRes] = await Promise.all([
        fetch(`${API_URL}/analytics/restaurant-stats`),
        fetch(`${API_URL}/analytics/popular-wines`),
        fetch(`${API_URL}/analytics/top-pairings`),
        fetch(`${API_URL}/analytics/preference-trends`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (winesRes.ok) {
        const winesData = await winesRes.json();
        setPopularWines(winesData.popularWines || []);
      }
      if (pairingsRes.ok) {
        const pairingsData = await pairingsRes.json();
        setTopPairings(pairingsData.topPairings || []);
      }
      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setPreferencesTrends(trendsData);
      }
    } catch (err) {
      setError('Failed to fetch analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getWineDisplayName = (wine) => {
    const parts = [];
    if (wine.year && wine.year.trim()) parts.push(wine.year);
    if (wine.producer && wine.producer.trim()) parts.push(wine.producer);
    if (wine.varietal && wine.varietal.trim()) parts.push(wine.varietal);
    return parts.join(' ') || wine.name || 'Unnamed Wine';
  };

  if (loading) {
    return <div className="analytics-container"><p className="loading">Loading analytics...</p></div>;
  }

  return (
    <div className="analytics-container">
      <h2>🍷 Wine Community Insights</h2>
      <p className="subtitle">Discover what SipSync users love</p>

      {error && <div className="error-message">{error}</div>}

      {/* Restaurant Stats Section */}
      {stats && (
        <section className="analytics-section">
          <h3>📊 Community Overview</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Restaurants</p>
              <p className="stat-value">{stats.totalRestaurants}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Wines Available</p>
              <p className="stat-value">{stats.totalWines}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Food Pairings</p>
              <p className="stat-value">{stats.totalFoodItems}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Cities</p>
              <p className="stat-value">{stats.totalCities}</p>
            </div>
          </div>

          {stats.winesByType && (
            <div className="wine-types-breakdown">
              <h4>Wines by Type</h4>
              <div className="wine-type-cards">
                {Object.entries(stats.winesByType).map(([type, count]) => (
                  <div key={type} className="wine-type-card">
                    <p className="wine-type-label">{type.charAt(0).toUpperCase() + type.slice(1)}</p>
                    <p className="wine-type-count">{count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Popular Wines Section */}
      {popularWines.length > 0 && (
        <section className="analytics-section">
          <h3>⭐ Most Popular Wines</h3>
          <p className="section-subtitle">Most frequently matched wines across all restaurants</p>
          <div className="wines-grid">
            {popularWines.map((wine, idx) => (
              <div key={idx} className="wine-card-analytics">
                <div className="wine-header-analytics">
                  <h4>{getWineDisplayName(wine)}</h4>
                  <span className="wine-type-badge">{wine.type}</span>
                </div>
                {wine.region && (
                  <p className="wine-region">
                    <span className="region-icon">📍</span>
                    {wine.region}
                  </p>
                )}
                <p className="wine-price">${wine.price}</p>
                <p className="match-count">
                  🎯 {wine.matchCount} matches
                </p>
                {wine.flavorProfile && wine.flavorProfile.length > 0 && (
                  <div className="flavor-tags-analytics">
                    {wine.flavorProfile.map((flavor) => (
                      <span key={flavor} className="flavor-tag-analytics">
                        {flavor}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Food Pairings Section */}
      {topPairings.length > 0 && (
        <section className="analytics-section">
          <h3>🍽️ Top Food & Wine Pairings</h3>
          <p className="section-subtitle">Highest-rated wine and food combinations</p>
          <div className="pairings-grid">
            {topPairings.map((pairing, idx) => (
              <div key={idx} className="pairing-card-analytics">
                <div className="pairing-score-badge">{pairing.pairingScore.toFixed(1)}</div>
                <div className="pairing-content">
                  <h4>{pairing.wine.name}</h4>
                  <p className="wine-type-small">{pairing.wine.type}</p>
                  <div className="pairing-separator"></div>
                  <p className="food-name">{pairing.foodItem.name}</p>
                  {pairing.foodItem.description && (
                    <p className="food-description">{pairing.foodItem.description}</p>
                  )}
                  {pairing.pairingReason && (
                    <p className="pairing-reason">💡 {pairing.pairingReason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* User Preferences Trends Section */}
      {preferencesTrends && (
        <section className="analytics-section">
          <h3>👥 User Preference Trends</h3>
          <p className="section-subtitle">What SipSync users prefer most</p>
          <div className="preferences-grid">
            <div className="preference-card">
              <h4>🫗 Acidity</h4>
              <div className="preference-breakdown">
                {Object.entries(preferencesTrends.trends.acidity).map(([level, count]) => (
                  <div key={level} className="preference-item">
                    <span className="preference-label">
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    <div className="preference-bar-container">
                      <div
                        className="preference-bar"
                        style={{
                          width: `${
                            preferencesTrends.trends.totalUsers > 0
                              ? (count / preferencesTrends.trends.totalUsers) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="preference-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="preference-card">
              <h4>🍂 Tannins</h4>
              <div className="preference-breakdown">
                {Object.entries(preferencesTrends.trends.tannins).map(([level, count]) => (
                  <div key={level} className="preference-item">
                    <span className="preference-label">
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    <div className="preference-bar-container">
                      <div
                        className="preference-bar"
                        style={{
                          width: `${
                            preferencesTrends.trends.totalUsers > 0
                              ? (count / preferencesTrends.trends.totalUsers) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="preference-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="preference-card">
              <h4>💪 Body Weight</h4>
              <div className="preference-breakdown">
                {Object.entries(preferencesTrends.trends.bodyWeight).map(([level, count]) => (
                  <div key={level} className="preference-item">
                    <span className="preference-label">
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    <div className="preference-bar-container">
                      <div
                        className="preference-bar"
                        style={{
                          width: `${
                            preferencesTrends.trends.totalUsers > 0
                              ? (count / preferencesTrends.trends.totalUsers) * 100
                              : 0
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="preference-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {Object.keys(preferencesTrends.trends.wineTypes).length > 0 && (
            <div className="wine-preference-card">
              <h4>🍇 Popular Wine Types</h4>
              <div className="wine-type-list">
                {Object.entries(preferencesTrends.trends.wineTypes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="wine-type-item">
                      <span className="wine-type-name">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                      <span className="wine-type-badge-count">{count} users</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default Analytics;
