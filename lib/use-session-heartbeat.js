'use client';
import { useEffect, useRef, useCallback } from 'react';

const INTERVAL_MS = 15 * 60 * 1000;
const ACTIVITY_WINDOW_MS = 30 * 60 * 1000;

export function useSessionHeartbeat(type = 'user') {
  const timer = useRef(null);
  const lastActivity = useRef(Date.now());

  const trackActivity = useCallback(() => { lastActivity.current = Date.now(); }, []);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastAttemptAt = 0;

    async function renew({ force = false } = {}) {
      if (!active || inFlight) return;
      if (document.visibilityState === 'hidden') return;
      if (!force && Date.now() - lastActivity.current > ACTIVITY_WINDOW_MS) return;
      inFlight = true;
      lastAttemptAt = Date.now();
      try {
        const res = await fetch('/api/auth/renew', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ type }),
        });
        if (active && res.status === 401) {
          const redirect = type === 'admin' ? '/admin/login?logout=1' : '/?logout=1';
          window.location.replace(redirect);
        }
      } catch {
        // A network failure is not proof that the durable session expired.
      } finally {
        inFlight = false;
      }
    }

    function onActivity() {
      trackActivity();
      if (Date.now() - lastAttemptAt >= INTERVAL_MS) renew();
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        trackActivity();
        renew({ force: true });
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, { passive: true });

    renew({ force: true });
    timer.current = setInterval(renew, INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, [type, trackActivity]);
}
