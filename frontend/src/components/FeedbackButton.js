import React, { useState } from 'react';
import '../styles/FeedbackButton.css';
import { API_URL } from '../config';

function FeedbackButton({ user, currentScreen }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating && !text.trim()) return;
    setSubmitting(true);
    try {
      const sessionId = sessionStorage.getItem('sipsync_session') || null;
      await fetch(`${API_URL}/analytics/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          rating,
          text: text.trim(),
          currentScreen,
          sessionId,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setRating(0);
        setText('');
        setSubmitted(false);
      }, 1800);
    } catch {
      // silent fail — don't let feedback errors surface to user
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setRating(0);
    setText('');
    setSubmitted(false);
  };

  return (
    <>
      <button
        className="feedback-fab"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
      >
        Feedback
      </button>

      {open && (
        <>
          <div className="feedback-backdrop" onClick={handleClose} />
          <div className="feedback-sheet">
            {submitted ? (
              <div className="feedback-thanks">
                <span className="feedback-thanks-icon">✓</span>
                <p>Thanks for your feedback!</p>
              </div>
            ) : (
              <>
                <div className="feedback-header">
                  <h4>How's your experience?</h4>
                  <button className="feedback-close" onClick={handleClose}>×</button>
                </div>

                <div className="feedback-stars">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      className={`feedback-star ${star <= (hovered || rating) ? 'active' : ''}`}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      onClick={() => setRating(star)}
                      aria-label={`${star} star`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                <textarea
                  className="feedback-text"
                  placeholder="Tell us what happened, what you loved, or what's missing..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  rows={3}
                  maxLength={500}
                />

                <button
                  className="feedback-submit"
                  onClick={handleSubmit}
                  disabled={submitting || (!rating && !text.trim())}
                >
                  {submitting ? 'Sending...' : 'Send Feedback'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default FeedbackButton;
