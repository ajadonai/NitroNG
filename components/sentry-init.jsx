'use client';

import { useEffect } from 'react';

let initialized = false;

export default function SentryInit() {
  useEffect(() => {
    if (initialized) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    initialized = true;

    import('@sentry/nextjs').then(Sentry => {
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        debug: false,
      });
    });
  }, []);

  return null;
}
