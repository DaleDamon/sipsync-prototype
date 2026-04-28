import React, { useState } from 'react';
import '../styles/AuthScreen.css';
import { API_URL } from '../config';

function AuthScreen({ onLogin }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, name }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin({
          userId: data.userId,
          phoneNumber: data.phoneNumber,
          token: data.token,
        });
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome to SipSync</h2>
        <p className="subtitle">Find your perfect wine pairing</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="tel"
            placeholder="Phone number (e.g., +1234567890)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthScreen;
