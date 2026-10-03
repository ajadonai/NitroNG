'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hasConsent } from './cookie-banner';
import { isInternalDashboardPath } from '@/lib/internal-dashboard-path';
import { tiktokProperties } from '@/lib/tiktok-properties';

/**
 * The browser half of conversion tracking. Every event gets one id, which goes
 * to both pixels and to the server, so each platform collapses the browser
 * event and its server twin into a single conversion. The field is spelled
 * differently on each side — Meta takes { eventID } fourth, TikTok takes
 * { event_id } third — and getting it wrong raises no error at all.
 */
function firePixels(eventName, customData, eventId) {
  if (typeof window === 'undefined' || !hasConsent('advertising')) return false;
  let fired = false;
  if (window.fbq) {
    window.fbq('track', eventName, customData || {}, { eventID: eventId });
    fired = true;
  }
  if (window.ttq) {
    // TikTok's own convention: .page() for navigation, .track() for anything
    // else — not .track('PageView', ...) the way Meta's pixel takes it.
    // ttq.page() accepts no event_id, which is why no server-side Pageview is
    // sent for TikTok: there would be nothing for it to be matched against.
    // Meta's custom_data goes to Meta as-is; TikTok validates content_type
    // against two allowed values and wants a content_id, so it gets the
    // translated shape. The server half translates identically.
    if (eventName === 'PageView') window.ttq.page();
    else window.ttq.track(eventName, tiktokProperties(customData) || {}, { event_id: eventId });
    fired = true;
  }
  return fired;
}

/**
 * The most recent PageView, so that consent granted mid-visit can still fire
 * the browser half — reusing the id the server already received rather than
 * minting a new one, which would report a second page view instead of
 * completing the first.
 */
let lastPageView = null;

function fire(eventName, customData) {
  if (typeof window !== 'undefined' && isInternalDashboardPath(window.location.pathname)) return;
  const eventId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const pixelsFired = firePixels(eventName, customData, eventId);
  if (eventName === 'PageView') lastPageView = { eventId, pixelsFired };
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

  // A visitor who accepts cookies partway through a page already had their
  // PageView sent server-side, with no pixel loaded to receive the browser
  // half. Once the pixels initialise, send it with the same id so the pair
  // still matches.
  useEffect(() => {
    const onConsentChange = () => {
      if (!lastPageView || lastPageView.pixelsFired) return;
      lastPageView.pixelsFired = firePixels('PageView', undefined, lastPageView.eventId);
    };
    window.addEventListener('nitro-consent-changed', onConsentChange);
    return () => window.removeEventListener('nitro-consent-changed', onConsentChange);
  }, []);

  return null;
}

export function trackViewContent(customData) {
  fire('ViewContent', customData);
}
