'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hasConsent } from './cookie-banner';

function fire(eventName, customData) {
  const eventId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  if (typeof window !== 'undefined' && window.fbq && hasConsent()) {
    window.fbq('track', eventName, customData || {}, { eventID: eventId });
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
  useEffect(() => { fire('PageView'); }, [pathname]);
  return null;
}

export function trackViewContent(customData) {
  fire('ViewContent', customData);
}
