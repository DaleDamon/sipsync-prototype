import React, { useState, useEffect } from 'react';
import '../styles/Analytics.css';
import { API_URL } from '../config';

function Analytics({ user }) {
  const [stats, setStats] = useState(null);
  const [popularWines, setPopularWines] = useState([]);
  const [preferencesTrends, setPreferencesTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/analytics/trending`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setPopularWines(data.popularWines || []);
        setPreferencesTrends(data.preferencesTrends);
      } else {
        setError('Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to fetch analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
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
      {popularWines.length > 0 && (() => {
        const maxCount = popularWines[0]?.selectionCount || 1;
        return (
          <section className="analytics-section">
            <h3>⭐ Most Saved Wines</h3>
            <ol className="popular-wines-list">
              {popularWines.slice(0, 10).map((wine, idx) => {
                const displayName = wine.wineName || (wine.producer && wine.varietal
                  ? `${wine.year ? wine.year + ' ' : ''}${wine.producer} ${wine.varietal}`
                  : wine.name || 'Unnamed Wine');
                const count = wine.selectionCount || wine.matchCount || 0;
                const barWidth = Math.round((count / maxCount) * 100);
                return (
                  <li key={idx} className="popular-wine-row">
                    <span className="popular-wine-rank">#{idx + 1}</span>
                    <div className="popular-wine-info">
                      <span className="popular-wine-name">{displayName}</span>
                      <div className="popular-wine-meta">
                        {wine.restaurantName && (
                          <span className="popular-wine-restaurant">{wine.restaurantName}</span>
                        )}
                        <div className="popular-wine-bar-track">
                          <div className="popular-wine-bar-fill" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    </div>
                    <span className="popular-wine-count">{count} {count === 1 ? 'save' : 'saves'}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })()}

      {/* User Preferences Trends Section */}
      {preferencesTrends && (
        <section className="analytics-section">
          <h3>👥 User Preference Trends</h3>
          <p className="section-subtitle">Based on confirmed wine selections</p>
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
                            preferencesTrends.totalSelections > 0
                              ? (count / preferencesTrends.totalSelections) * 100
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
                            preferencesTrends.totalSelections > 0
                              ? (count / preferencesTrends.totalSelections) * 100
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
                            preferencesTrends.totalSelections > 0
                              ? (count / preferencesTrends.totalSelections) * 100
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

            {preferencesTrends.trends.sweetnessLevel && (
            <div className="preference-card">
              <h4>🍬 Sweetness</h4>
              <div className="preference-breakdown">
                {Object.entries(preferencesTrends.trends.sweetnessLevel).map(([level, count]) => (
                  <div key={level} className="preference-item">
                    <span className="preference-label">
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                    <div className="preference-bar-container">
                      <div
                        className="preference-bar"
                        style={{
                          width: `${
                            preferencesTrends.totalSelections > 0
                              ? (count / preferencesTrends.totalSelections) * 100
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
            )}
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
                      <span className="wine-type-badge-count">{count} selection{count !== 1 ? 's' : ''}</span>
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
