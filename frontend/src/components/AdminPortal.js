import React, { useState, useEffect } from 'react';
import '../styles/AdminPortal.css';
import { API_URL } from '../config';
import AdminLogin from './AdminLogin';
import FileUpload from './FileUpload';
import WineReviewTable from './WineReviewTable';
import MenuDiff from './MenuDiff';
import WineListFilter from './WineListFilter';
import RestaurantForm from './RestaurantForm';
import SearchableSelect from './SearchableSelect';
import AdminAnalytics from './AdminAnalytics';

function AdminPortal() {
  const [adminUser, setAdminUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedUploadMethod, setSelectedUploadMethod] = useState('csv');
  const [uploadMode, setUploadMode] = useState('replace'); // 'replace' | 'append'
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [wineCount, setWineCount] = useState(0);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [parsedWines, setParsedWines] = useState(null);
  const [pendingStoredPaths, setPendingStoredPaths] = useState(null);
  const [existingWines, setExistingWines] = useState([]);
  const [filteredWines, setFilteredWines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);

  // Restore admin session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('sipsyncAdminToken');
    const adminData = localStorage.getItem('sipsyncAdminData');
    if (token && adminData) {
      const parsed = JSON.parse(adminData);
      setAdminUser({ ...parsed, token });
    }
  }, []);

  // Fetch restaurants when admin logs in
  useEffect(() => {
    if (adminUser) {
      if (adminUser.role === 'superadmin') {
        fetchRestaurants();
      } else if (adminUser.restaurantId) {
        setSelectedRestaurant(adminUser.restaurantId);
      }
    }
  }, [adminUser]);

  // Fetch wine count and history when restaurant is selected
  useEffect(() => {
    if (selectedRestaurant && adminUser) {
      fetchWineCount();
      fetchUploadHistory();
    }
  }, [selectedRestaurant, adminUser]);

  const fetchRestaurants = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/restaurants`, {
        headers: { 'Authorization': `Bearer ${adminUser.token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRestaurants(data.restaurants);
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
    }
  };

  const fetchWineCount = async () => {
    try {
      const response = await fetch(`${API_URL}/wines/restaurant/${selectedRestaurant}`);
      if (response.ok) {
        const data = await response.json();
        setWineCount(data.wines ? data.wines.length : 0);
        setExistingWines(data.wines || []);
      }
    } catch (error) {
      console.error('Error fetching wine count:', error);
    }
  };

  const fetchUploadHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/upload-history/${selectedRestaurant}`, {
        headers: { 'Authorization': `Bearer ${adminUser.token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUploadHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching upload history:', error);
    }
  };

  const handleAdminLogin = (loginData) => {
    setAdminUser(loginData);
    localStorage.setItem('sipsyncAdminToken', loginData.token);
    localStorage.setItem('sipsyncAdminData', JSON.stringify({
      adminId: loginData.adminId,
      email: loginData.email,
      role: loginData.role,
      restaurantId: loginData.restaurantId
    }));
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    setSelectedRestaurant(null);
    localStorage.removeItem('sipsyncAdminToken');
    localStorage.removeItem('sipsyncAdminData');
  };

  const handleUploadMethodSelect = (method) => {
    setSelectedUploadMethod(method);
    setCurrentView('upload');
  };

  const handleWinesParsed = (wines, storedPaths) => {
    setParsedWines(wines);
    setPendingStoredPaths(storedPaths || null);
    // Always show review table first so admin can see confidence flags and edit values
    setCurrentView('review');
  };

  const handleReviewComplete = (wines) => {
    setParsedWines(wines);
    if (uploadMode === 'append') {
      const existingKeys = new Set(
        existingWines.map(w =>
          (w.producer || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' +
          (w.varietal || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' +
          (w.type || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        )
      );
      const newOnly = wines.filter(w => {
        const key =
          (w.producer || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' +
          (w.varietal || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '|' +
          (w.type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return !existingKeys.has(key);
      });
      setParsedWines(newOnly);
      setCurrentView('appendReview');
    } else if (existingWines.length > 0) {
      setCurrentView('diff');
    } else {
      handleSaveWines(wines);
    }
  };

  const handleSaveWines = async (wines) => {
    setLoading(true);
    setError('');
    try {
      const operations = wines.map(wine => ({
        action: 'add',
        wine: {
          year: wine.year || '',
          producer: wine.producer,
          varietal: wine.varietal,
          region: wine.region || '',
          type: wine.type,
          price: parseFloat(wine.price) || 0,
          glassPrice: parseFloat(wine.glassPrice) > 0 ? parseFloat(wine.glassPrice) : null,
          acidity: wine.acidity || 'medium',
          tannins: wine.tannins || 'low',
          bodyWeight: wine.bodyWeight || 'medium',
          sweetnessLevel: wine.sweetnessLevel || 'dry',
          flavorProfile: wine.flavorProfile || [],
          inventoryStatus: 'available',
          createdAt: new Date()
        }
      }));

      const response = await fetch(`${API_URL}/wines/restaurant/${selectedRestaurant}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({ operations })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save wines');
      }

      const result = await response.json();
      await fetch(`${API_URL}/admin/upload-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({
          restaurantId: selectedRestaurant,
          uploadType: selectedUploadMethod,
          wineCount: wines.length,
          summary: `Added ${result.added || wines.length} wines`,
          storedPaths: pendingStoredPaths || undefined
        })
      });

      setSuccessMsg(`Successfully added ${result.added || wines.length} wines!`);
      setParsedWines(null);
      setCurrentView('dashboard');
      fetchWineCount();
      fetchUploadHistory();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error saving wines:', err);
      setError(err.message || 'Failed to save wines. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppendSave = async (wines) => {
    setLoading(true);
    setError('');
    try {
      const operations = wines.map(wine => ({
        action: 'add',
        wine: {
          year: wine.year || '',
          producer: wine.producer,
          varietal: wine.varietal,
          region: wine.region || '',
          type: wine.type,
          price: parseFloat(wine.price) || 0,
          glassPrice: parseFloat(wine.glassPrice) > 0 ? parseFloat(wine.glassPrice) : null,
          acidity: wine.acidity || 'medium',
          tannins: wine.tannins || 'low',
          bodyWeight: wine.bodyWeight || 'medium',
          sweetnessLevel: wine.sweetnessLevel || 'dry',
          flavorProfile: wine.flavorProfile || [],
          inventoryStatus: 'available',
          createdAt: new Date()
        }
      }));

      const response = await fetch(`${API_URL}/wines/restaurant/${selectedRestaurant}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({ operations })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to append wines');
      }

      const result = await response.json();
      await fetch(`${API_URL}/admin/upload-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({
          restaurantId: selectedRestaurant,
          uploadType: `append-${selectedUploadMethod}`,
          wineCount: wines.length,
          summary: `Appended ${result.added || wines.length} new wines`,
          storedPaths: pendingStoredPaths || undefined
        })
      });

      setSuccessMsg(`Appended ${result.added || wines.length} new wines to the list!`);
      setParsedWines(null);
      setUploadMode('replace');
      setCurrentView('dashboard');
      fetchWineCount();
      fetchUploadHistory();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error appending wines:', err);
      setError(err.message || 'Failed to append wines. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDiff = async (operations) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/wines/restaurant/${selectedRestaurant}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({ operations })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to apply changes');
      }

      const result = await response.json();
      const parts = [];
      if (result.added) parts.push(`Added ${result.added}`);
      if (result.updated) parts.push(`Updated ${result.updated}`);
      if (result.deleted) parts.push(`Removed ${result.deleted}`);

      await fetch(`${API_URL}/admin/upload-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({
          restaurantId: selectedRestaurant,
          uploadType: selectedUploadMethod,
          wineCount: result.total,
          summary: parts.join(', ') || 'No changes',
          storedPaths: pendingStoredPaths || undefined
        })
      });

      setSuccessMsg(parts.join(', ') || 'Changes applied successfully!');
      setParsedWines(null);
      setCurrentView('dashboard');
      fetchWineCount();
      fetchUploadHistory();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error applying diff:', err);
      setError(err.message || 'Failed to apply changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async (historyId, storedPaths) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/ai/reanalyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({ restaurantId: selectedRestaurant, historyId })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Re-analysis failed');
      }
      const data = await response.json();
      handleWinesParsed(data.wines, storedPaths);
    } catch (err) {
      setError(err.message || 'Failed to re-analyze menu');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setParsedWines(null);
    setFilteredWines(null);
    setUploadMode('replace');
  };

  const handleManualEdit = async () => {
    if (wineCount === 0) {
      setError('No wines to edit. Upload a menu first.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/wines/restaurant/${selectedRestaurant}`);
      if (!response.ok) {
        throw new Error('Failed to load wines');
      }

      const data = await response.json();
      setParsedWines(data.wines || []);
      setFilteredWines(null);
      setCurrentView('manualEdit');
    } catch (err) {
      console.error('Error loading wines for manual edit:', err);
      setError(err.message || 'Failed to load wines. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualEditSave = async (wines) => {
    setLoading(true);
    setError('');
    try {
      // Full replacement: delete all existing, then add all edited wines
      const operations = [
        // Delete all existing wines
        ...existingWines.map(wine => ({
          action: 'delete',
          wineId: wine.wineId
        })),
        // Add all edited wines
        ...wines.map(wine => ({
          action: 'add',
          wine: {
            year: wine.year || '',
            producer: wine.producer,
            varietal: wine.varietal,
            region: wine.region || '',
            type: wine.type,
            price: parseFloat(wine.price) || 0,
            acidity: wine.acidity || 'medium',
            tannins: wine.tannins || 'low',
            bodyWeight: wine.bodyWeight || 'medium',
            sweetnessLevel: wine.sweetnessLevel || 'dry',
            flavorProfile: wine.flavorProfile || [],
            inventoryStatus: 'available',
            createdAt: new Date()
          }
        }))
      ];

      const response = await fetch(`${API_URL}/wines/restaurant/${selectedRestaurant}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({ operations })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save manual edits');
      }

      const result = await response.json();

      // Log to upload history
      await fetch(`${API_URL}/admin/upload-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminUser.token}`
        },
        body: JSON.stringify({
          restaurantId: selectedRestaurant,
          uploadType: 'manual-edit',
          wineCount: wines.length,
          summary: `Manual edit: ${result.added || wines.length} wines in list`
        })
      });

      setSuccessMsg(`Manual edits saved! Wine list updated (${wines.length} wines).`);
      setParsedWines(null);
      setFilteredWines(null);
      setCurrentView('dashboard');
      fetchWineCount();
      fetchUploadHistory();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error saving manual edits:', err);
      setError(err.message || 'Failed to save manual edits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRestaurant = () => {
    setShowRestaurantForm(true);
  };

  const handleSaveRestaurant = (restaurant) => {
    setShowRestaurantForm(false);
    setSuccessMsg(`Restaurant "${restaurant.name}" added successfully!`);
    setTimeout(() => setSuccessMsg(''), 5000);
    // Refresh restaurant list for superadmins
    if (adminUser.role === 'superadmin') {
      fetchRestaurants();
    }
  };

  // Not logged in — show login
  if (!adminUser) {
    return <AdminLogin onAdminLogin={handleAdminLogin} />;
  }

  const selectedRestaurantName = restaurants.find(r => r.id === selectedRestaurant)?.name || 'Your Restaurant';

  return (
    <div className="admin-portal">
      <div className="admin-header">
        <h2>Admin Portal</h2>
        <div className="admin-header-right">
          <span className="admin-email">{adminUser.email} ({adminUser.role})</span>
          <button className="admin-logout-btn" onClick={handleAdminLogout}>Logout</button>
        </div>
      </div>

      {/* Restaurant Selector + Add New (super admin only) */}
      {adminUser.role === 'superadmin' && (
        <div className="restaurant-selector-row">
          {restaurants.length > 0 && (
            <div className="restaurant-selector">
              <label>Select Restaurant</label>
              <SearchableSelect
                options={restaurants.map(r => ({
                  label: `${r.name} — ${r.city || 'No city'}`,
                  value: r.id
                }))}
                value={selectedRestaurant || ''}
                onChange={(val) => setSelectedRestaurant(val)}
                placeholder="Search restaurants..."
              />
            </div>
          )}
          <button className="add-restaurant-btn" onClick={handleAddRestaurant}>
            + Add New Restaurant
          </button>
        </div>
      )}

      {error && (
        <div className="admin-error-msg">
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
        </div>
      )}

      {successMsg && (
        <div className="admin-success-msg">
          {successMsg}
        </div>
      )}

      {loading && currentView === 'dashboard' && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="processing-spinner" style={{ width: 40, height: 40, border: '4px solid #f0f0f0', borderTopColor: '#722F37', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#666' }}>Saving...</p>
        </div>
      )}

      {(currentView === 'dashboard' || currentView === 'analytics') && selectedRestaurant && (
        <div className="admin-nav">
          <button
            className={`admin-nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`admin-nav-btn ${currentView === 'analytics' ? 'active' : ''}`}
            onClick={() => setCurrentView('analytics')}
          >
            Analytics
          </button>
        </div>
      )}

      {currentView === 'analytics' && selectedRestaurant && (
        <AdminAnalytics restaurantId={selectedRestaurant} token={adminUser.token} />
      )}

      {currentView === 'dashboard' && selectedRestaurant && (
        <>
          {/* Stats */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{wineCount}</div>
              <div className="stat-label">Current Wines</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{uploadHistory.length}</div>
              <div className="stat-label">Total Uploads</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{selectedRestaurantName}</div>
              <div className="stat-label">Restaurant</div>
            </div>
          </div>

          {/* Manual Edit Button */}
          <button className="edit-winelist-btn" onClick={handleManualEdit}>
            ✏️ Edit Wine List Manually
          </button>

          {/* Upload Methods */}
          <div className="upload-section">
            <h3>Upload Wine Menu</h3>
            <div className="upload-mode-toggle">
              <button
                className={`upload-mode-btn ${uploadMode === 'replace' ? 'active' : ''}`}
                onClick={() => setUploadMode('replace')}
              >
                Replace — Upload a new menu, review all changes
              </button>
              <button
                className={`upload-mode-btn ${uploadMode === 'append' ? 'active' : ''}`}
                onClick={() => setUploadMode('append')}
              >
                Append — Add new wines only, nothing removed
              </button>
            </div>
            <div className="upload-cards">
              <div className="upload-card" onClick={() => handleUploadMethodSelect('csv')}>
                <div className="upload-card-icon">CSV</div>
                <h4>Upload Spreadsheet</h4>
                <p>Upload a CSV file with wine data. AI fills in tasting profiles.</p>
              </div>
              <div className="upload-card" onClick={() => handleUploadMethodSelect('pdf')}>
                <div className="upload-card-icon">PDF</div>
                <h4>Upload PDF Menu</h4>
                <p>Upload your wine menu PDF. AI extracts and profiles every wine.</p>
              </div>
              <div className="upload-card" onClick={() => handleUploadMethodSelect('photo')}>
                <div className="upload-card-icon">IMG</div>
                <h4>Photo of Menu</h4>
                <p>Take a photo of your printed menu. AI reads and profiles it.</p>
              </div>
            </div>
          </div>

          {/* Upload History */}
          <div className="upload-history">
            <h3>Upload History</h3>
            {uploadHistory.length > 0 ? (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Wines</th>
                    <th>Summary</th>
                    <th>Uploaded By</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {uploadHistory.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.createdAt).toLocaleDateString()}</td>
                      <td>{h.uploadType?.toUpperCase()}</td>
                      <td>{h.wineCount}</td>
                      <td>{h.summary}</td>
                      <td>{h.uploadedBy}</td>
                      <td>
                        {h.storedPaths && h.storedPaths.length > 0 && (
                          <button
                            className="reanalyze-btn"
                            onClick={() => handleReanalyze(h.id, h.storedPaths)}
                            title="Re-run AI analysis on the original menu images"
                          >
                            Re-analyze
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="history-empty">No uploads yet. Upload your first wine menu above.</div>
            )}
          </div>
        </>
      )}

      {currentView === 'upload' && (
        <>
          <button className="back-to-dashboard" onClick={handleBackToDashboard}>
            Back to Dashboard
          </button>
          <FileUpload adminToken={adminUser.token} restaurantId={selectedRestaurant} onWinesParsed={handleWinesParsed} initialMethod={selectedUploadMethod} />
        </>
      )}

      {currentView === 'review' && parsedWines && (
        <>
          <button className="back-to-dashboard" onClick={handleBackToDashboard}>
            Back to Dashboard
          </button>
          <WineReviewTable wines={parsedWines} onConfirm={handleReviewComplete} />
        </>
      )}

      {currentView === 'diff' && parsedWines && (
        <>
          <button className="back-to-dashboard" onClick={handleBackToDashboard}>
            Back to Dashboard
          </button>
          <MenuDiff
            newWines={parsedWines}
            existingWines={existingWines}
            onApply={handleApplyDiff}
            loading={loading}
          />
        </>
      )}

      {currentView === 'appendReview' && parsedWines && (
        <>
          <button className="back-to-dashboard" onClick={handleBackToDashboard}>
            Back to Dashboard
          </button>
          <div className="append-review-notice">
            {parsedWines.length === 0
              ? 'All wines in this upload already exist in your list. Nothing new to add.'
              : `${parsedWines.length} new wine${parsedWines.length !== 1 ? 's' : ''} found that are not yet in your list. Review and confirm to add them.`}
          </div>
          {parsedWines.length > 0 && (
            <WineReviewTable wines={parsedWines} onConfirm={handleAppendSave} />
          )}
        </>
      )}

      {currentView === 'manualEdit' && parsedWines && (
        <>
          <div className="manual-edit-header">
            <h3>Edit Wine List Manually</h3>
            <button className="back-to-dashboard" onClick={handleBackToDashboard}>
              ← Back to Dashboard
            </button>
          </div>

          <WineListFilter
            wines={parsedWines}
            onFilterChange={(filtered) => setFilteredWines(filtered)}
          />

          <WineReviewTable
            wines={filteredWines || parsedWines}
            onConfirm={handleManualEditSave}
          />
        </>
      )}

      {!selectedRestaurant && (
        <div className="history-empty">
          Select a restaurant to get started.
        </div>
      )}

      {/* Restaurant Form Modal */}
      {showRestaurantForm && (
        <div className="modal-overlay">
          <RestaurantForm
            adminToken={adminUser.token}
            onSave={handleSaveRestaurant}
            onCancel={() => setShowRestaurantForm(false)}
          />
        </div>
      )}
    </div>
  );
}

export default AdminPortal;
