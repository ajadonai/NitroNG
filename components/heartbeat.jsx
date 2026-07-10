'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function Heartbeat() {
  const pathname = usePathname();

  useEffect(() => {
    let sid = sessionStorage.getItem('nitro_hb_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('nitro_hb_sid', sid);
    }

    const beat = () => {
      let page = pathname;
      if (pathname === '/dashboard') {
        try {
          const sub = localStorage.getItem('nitro-page');
          if (sub && sub !== 'home') page = `/dashboard/${sub}`;
        } catch {}
      }
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, page }),
        keepalive: true,
      }).catch(() => {});
    };

    beat();
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') beat();
    }, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  return null;
}
