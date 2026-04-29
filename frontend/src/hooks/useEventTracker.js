import { useCallback } from 'react';
import { API_URL } from '../config';

function getSessionId() {
  let id = sessionStorage.getItem('sipsync_session');
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('sipsync_session', id);
  }
  return id;
}

export function useEventTracker(userId) {
  const trackEvent = useCallback((eventType, extra = {}) => {
    if (!userId) return;
    fetch(`${API_URL}/analytics/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, eventType, sessionId: getSessionId(), ...extra }),
    }).catch(() => {});
  }, [userId]);

  return { trackEvent };
}

export function logSession(userId) {
  if (!userId) return;
  const sessionId = getSessionId();
  const startTime = Date.now();
  sessionStorage.setItem('sipsync_session_start', startTime);

  fetch(`${API_URL}/analytics/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      sessionId,
      platform: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile-web' : 'web',
    }),
  }).catch(() => {});

  // Fire session_end with duration when user leaves or tabs away
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      const durationMs = Date.now() - startTime;
      navigator.sendBeacon(
        `${API_URL}/analytics/session-end`,
        new Blob(
          [JSON.stringify({ userId, sessionId, durationMs })],
          { type: 'application/json' }
        )
      );
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
}
