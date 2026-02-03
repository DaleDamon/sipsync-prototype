import React, { useState } from 'react';
import '../styles/AuthScreen.css';
import { API_URL } from '../config';

function AuthScreen({ onLogin }) {
  const [step, setStep] = useState('phone'); // 'phone' or 'verify'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/send-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('verify');
        // For testing without Twilio
        if (data.testCode) {
          setError(`[TEST MODE] Your code is: ${data.testCode}`);
        }
      } else {
        setError(data.error || 'Failed to send code');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          code,
          name: step === 'verify' && !name ? 'User' : name,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin({
          userId: data.userId,
          phoneNumber: data.phoneNumber,
          token: data.token,
        });
      } else {
        setError(data.error || 'Verification failed');
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

        {step === 'phone' ? (
          <form onSubmit={handleSendCode}>
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
              {loading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength="6"
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              type="button"
              className="back-btn"
              onClick={() => {
                setStep('phone');
                setCode('');
              }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AuthScreen;
