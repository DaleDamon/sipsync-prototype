import React, { useState } from 'react';
import '../styles/FeedbackButton.css';
import { API_URL } from '../config';

function FeedbackButton({ user, currentScreen }) {
  const [open, setOpen] = useState(false);
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
          text: text.trim(),
          currentScreen,
          sessionId,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
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
                  disabled={submitting || !text.trim()}
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
