'use client';
import { useEffect } from 'react';
import Dashboard from '@/components/dashboard';

export default function DashboardClient() {
  useEffect(() => {
    const entries = performance.getEntriesByType?.('navigation');
    const nav = entries?.[0];
    if (nav && 'type' in nav && nav.type === 'back_forward') {
      fetch('/api/auth/me').then(r => { if (r.status === 401) window.location.replace('/?logout=1'); });
    }
  }, []);

  return <Dashboard />;
}
