'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function fire(eventName, customData) {
  const eventId = crypto.randomUUID();
  if (typeof window !== 'undefined' && window.fbq) {
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
