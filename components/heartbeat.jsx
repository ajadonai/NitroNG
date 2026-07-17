'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  HEARTBEAT_INTERVAL_MS,
  normalizeHeartbeatPage,
} from '@/lib/heartbeat';

export default function Heartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    const beat = () => {
      let page = normalizeHeartbeatPage(pathname) || '/';
      if (pathname === '/dashboard') {
        try {
          const sub = localStorage.getItem('nitro-page');
          const dashboardPage = sub && sub !== 'home'
            ? normalizeHeartbeatPage(`/dashboard/${sub}`)
            : null;
          if (dashboardPage) page = dashboardPage;
        } catch {}
      }
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
        keepalive: true,
      }).catch(() => {});
    };

    beat();
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') beat();
    }, HEARTBEAT_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  return null;
}
