'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hasConsent } from './cookie-banner';
import { isInternalDashboardPath } from '@/lib/internal-dashboard-path';

function fire(eventName, customData) {
  if (typeof window !== 'undefined' && isInternalDashboardPath(window.location.pathname)) return;
  const eventId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  if (typeof window !== 'undefined' && window.fbq && hasConsent('advertising')) {
    window.fbq('track', eventName, customData || {}, { eventID: eventId });
  }
  // TikTok's own convention: .page() on navigation, .track() for anything else —
  // not .track('PageView', ...) the way Meta's pixel takes it. The third
  // argument is where event_id goes (Meta takes it as { eventID } in the
  // fourth); it must be the SAME id the server event carries or TikTok counts
  // the pair twice instead of deduplicating it. ttq.page() accepts no event_id
  // at all, which is why no server-side Pageview is sent for TikTok.
  if (typeof window !== 'undefined' && window.ttq && hasConsent('advertising')) {
    if (eventName === 'PageView') window.ttq.page();
    else window.ttq.track(eventName, customData || {}, { event_id: eventId });
  }
  fetch('/api/capi/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      custom_data: customData,
      source_url: window.location.href,
    }),
    keepalive: true,
  }).catch(() => {});
}

export default function CAPIPageView() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isInternalDashboardPath(pathname)) fire('PageView');
  }, [pathname]);
  return null;
}

export function trackViewContent(customData) {
  fire('ViewContent', customData);
}
