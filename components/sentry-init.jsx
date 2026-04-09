'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

let initialized = false;

export default function SentryInit() {
  useEffect(() => {
    if (initialized) return;
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    console.log('[Sentry] DSN available:', !!dsn, dsn ? dsn.substring(0, 20) + '...' : 'none');
    if (!dsn) return;
    
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      debug: true,
    });
    initialized = true;
    console.log('[Sentry] Initialized successfully');
  }, []);

  return null;
}
