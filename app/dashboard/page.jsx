'use client';
import { useEffect } from 'react';
import Dashboard from '@/components/dashboard';

export default function DashboardPage() {
  useEffect(() => {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav?.type === "back_forward") {
      fetch('/api/auth/me').then(r => { if (r.status === 401) window.location.replace('/?logout=1'); });
    }
  }, []);

  return <Dashboard />;
}

export default function DashboardPage() {
  useEffect(() => {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    if (nav?.type === "back_forward") {
      fetch('/api/auth/me').then(r => { if (r.status === 401) window.location.replace('/?logout=1'); });
    }
  }, []);

  return <Dashboard />;
}
