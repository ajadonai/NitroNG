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
      fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, page: pathname }),
        keepalive: true,
      }).catch(() => {});
    };

    beat();
    const iv = setInterval(beat, 10_000);
    return () => clearInterval(iv);
  }, [pathname]);

  return null;
}
