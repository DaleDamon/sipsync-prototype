import React, { useState } from 'react';
import { API_URL } from '../config';
import '../styles/RestaurantForm.css';

function RestaurantForm({ restaurant, adminToken, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: restaurant?.name || '',
    address: {
      street: restaurant?.address?.street || '',
      city: restaurant?.address?.city || 'Chicago',
      state: restaurant?.address?.state || 'IL',
      zipCode: restaurant?.address?.zipCode || '',
      country: restaurant?.address?.country || 'USA',
      neighborhood: restaurant?.address?.neighborhood || ''
    },
    contact: {
      phone: restaurant?.contact?.phone || '',
      website: restaurant?.contact?.website || '',
      email: restaurant?.contact?.email || ''
    }
  });

  const [geocodeError, setGeocodeError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);
    setGeocodeError(null);

    try {
      const url = restaurant
        ? `${API_URL}/restaurants/${restaurant.id}`
        : `${API_URL}/restaurants`;

      const method = restaurant ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error === 'Geocoding failed') {
          setGeocodeError(error.message);
        } else {
          throw new Error(error.message || 'Failed to save restaurant');
        }
        return;
      }

      const result = await response.json();
      onSave(result.restaurant || result);
    } catch (err) {
      console.error('Save failed:', err);
      setGeocodeError(err.message || 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = formData.name &&
    formData.address.street &&
    formData.address.city &&
    formData.address.state &&
    formData.address.zipCode;

  return (
    <div className="restaurant-form">
      <div className="form-header">
        <h3>{restaurant ? 'Edit Restaurant' : 'Add New Restaurant'}</h3>
        <button className="close-btn" onClick={onCancel}>&times;</button>
      </div>

      <div className="form-body">
        {/* Restaurant Name */}
        <div className="form-group">
          <label>Restaurant Name *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Quartino Ristorante"
            required
          />
        </div>

        {/* Address Section */}
        <div className="form-section">
          <h4>Address</h4>

          <div className="form-group">
            <label>Street Address *</label>
            <input
              type="text"
              placeholder="626 N State St"
              value={formData.address.street}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, street: e.target.value }
              })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>City *</label>
              <input
                type="text"
                value={formData.address.city}
                onChange={(e) => setFormData({
                  ...formData,
                  address: { ...formData.address, city: e.target.value }
                })}
                required
              />
            </div>

            <div className="form-group">
              <label>State *</label>
              <input
                type="text"
                value={formData.address.state}
                onChange={(e) => setFormData({
                  ...formData,
                  address: { ...formData.address, state: e.target.value }
                })}
                maxLength="2"
                placeholder="IL"
                required
              />
            </div>

            <div className="form-group">
              <label>Zip Code *</label>
              <input
                type="text"
                value={formData.address.zipCode}
                onChange={(e) => setFormData({
                  ...formData,
                  address: { ...formData.address, zipCode: e.target.value }
                })}
                placeholder="60654"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Neighborhood (optional)</label>
            <input
              type="text"
              placeholder="e.g., River North"
              value={formData.address.neighborhood}
              onChange={(e) => setFormData({
                ...formData,
                address: { ...formData.address, neighborhood: e.target.value }
              })}
            />
          </div>
        </div>

        {/* Contact Section */}
        <div className="form-section">
          <h4>Contact Info (optional)</h4>

          <div className="form-group">
            <label>Phone</label>
            <input
              type="tel"
              placeholder="+1 (312) 698-5000"
              value={formData.contact.phone}
              onChange={(e) => setFormData({
                ...formData,
                contact: { ...formData.contact, phone: e.target.value }
              })}
            />
          </div>

          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              placeholder="https://restaurant.com"
              value={formData.contact.website}
              onChange={(e) => setFormData({
                ...formData,
                contact: { ...formData.contact, website: e.target.value }
              })}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="info@restaurant.com"
              value={formData.contact.email}
              onChange={(e) => setFormData({
                ...formData,
                contact: { ...formData.contact, email: e.target.value }
              })}
            />
          </div>
        </div>

        {/* Geocoding Error */}
        {geocodeError && (
          <div className="error-banner">
            <strong>⚠️ Could not find address</strong>
            <p>{geocodeError}</p>
            <p>Please verify the address is correct and try again.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="form-actions">
        <button className="btn-cancel" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button
          className="btn-save"
          onClick={handleSubmit}
          disabled={isSaving || !isValid}
        >
          {isSaving ? 'Saving...' : restaurant ? 'Update Restaurant' : 'Save Restaurant'}
        </button>
      </div>
    </div>
  );
}

export default RestaurantForm;
