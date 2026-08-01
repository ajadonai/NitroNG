'use client';
import { useEffect } from 'react';
import Dashboard from '@/components/dashboard';
import { useSessionHeartbeat } from '@/lib/use-session-heartbeat';

export default function DashboardClient() {
  useSessionHeartbeat('user');

  useEffect(() => {
    const entries = performance.getEntriesByType?.('navigation');
    const nav = entries?.[0];
    if (nav && 'type' in nav && nav.type === 'back_forward') {
      fetch('/api/auth/me').then(r => { if (r.status === 401) window.location.replace('/?logout=1'); });
    }
  }, []);

  return <Dashboard />;
}
