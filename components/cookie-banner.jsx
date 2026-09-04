'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { isInternalDashboardPath } from '@/lib/internal-dashboard-path';
import CookieSettingsSheet from './cookie-settings';

const KEY = 'nitro-cookie-consent';

/**
 * The stored choice, or null when none has been made.
 * Old plain values still count: "accepted" is everything on, "declined" is everything off.
 */
export function readConsent() {
  if (typeof window === 'undefined') return null;
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { return null; }
  if (!raw) return null;
  if (raw === 'accepted') return { necessary: true, analytics: true, advertising: true };
  if (raw === 'declined') return { necessary: true, analytics: false, advertising: false };
  try {
    const p = JSON.parse(raw);
    return { necessary: true, analytics: !!p.analytics, advertising: !!p.advertising, at: p.at };
  } catch { return null; }
}

export function hasConsent(category) {
  const c = readConsent();
  return !!(c && c[category]);
}

/** Meta's _fbc format: fb.1.<set-time ms>.<click id>. Sent to CAPI raw, never hashed. */
export function buildFbcValue(fbclid, nowMs = Date.now()) {
  return `fb.1.${nowMs}.${fbclid}`;
}

/**
 * The pixel normally writes _fbc from ?fbclid — but when it is blocked or slow
 * the click id is lost and server Purchase events can never carry fbc. Capture
 * it first-party on landing, before the pixel loads.
 */
function ensureFbcFromClick() {
  try {
    const fbclid = new URLSearchParams(window.location.search).get('fbclid');
    if (!fbclid) return;
    if (document.cookie.split('; ').some(c => c.startsWith('_fbc='))) return;
    document.cookie = `_fbc=${encodeURIComponent(buildFbcValue(fbclid))}; path=/; max-age=${90 * 86400}; SameSite=Lax`;
  } catch {}
}

export function initPixel() {
  if (typeof window === 'undefined' || window.fbq || isInternalDashboardPath(window.location.pathname)) return;
  ensureFbcFromClick();
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init','27456534517306114');
  window.fbq('track','PageView');
}

export default function CookieBanner() {
  const pathname = usePathname();
  const internalDashboard = isInternalDashboardPath(pathname);
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dark, setDark] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (internalDashboard) return;
    const consent = readConsent();
    if (consent) {
      if (consent.advertising) initPixel();
      return;
    }
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, [internalDashboard]);

  useEffect(() => {
    const check = () => {
      const theme = localStorage.getItem('nitro-theme');
      if (theme === 'day') setDark(false);
      else if (theme === 'night') setDark(true);
      else {
        const hour = new Date().getHours();
        setDark(hour < 7 || hour >= 18);
      }
    };
    check();
    window.addEventListener('storage', check);
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true });
    return () => { window.removeEventListener('storage', check); observer.disconnect(); };
  }, []);

  const save = useCallback((choice) => {
    const value = { necessary: true, analytics: !!choice.analytics, advertising: !!choice.advertising, at: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
    if (value.advertising) initPixel();
    window.dispatchEvent(new Event('nitro-consent-changed'));
    setSheet(false);
    if (show) setExiting(true);
  }, [show]);

  const openSheet = useCallback(() => {
    setCurrent(readConsent());
    setSheet(true);
  }, []);

  // The footer's "Cookie settings" link and the old reset link both open the sheet.
  useEffect(() => {
    window.addEventListener('nitro-cookie-settings', openSheet);
    window.addEventListener('nitro-cookie-reset', openSheet);
    return () => {
      window.removeEventListener('nitro-cookie-settings', openSheet);
      window.removeEventListener('nitro-cookie-reset', openSheet);
    };
  }, [openSheet]);

  if (internalDashboard) return null;

  return (
    <>
      <CookieSettingsSheet open={sheet} onClose={() => setSheet(false)} onSave={save} dark={dark} initial={current} />
      {show && (
        <div className="fixed bottom-0 inset-x-0 z-[9999] p-2.5 sm:px-3.5" style={{ animation: exiting ? "cookieSlideDown .35s ease-in forwards" : "cookieSlideUp .4s ease-out" }} onAnimationEnd={() => { if (exiting) setShow(false); }}>
          <div
            className="max-w-[680px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 p-3.5 sm:py-3 sm:px-4 rounded-r-xl border-l-[3px] border-l-accent"
            style={{
              background: dark ? 'rgba(20,16,28,.97)' : 'rgba(255,255,255,.98)',
              borderTop: `1px solid ${dark ? 'rgba(196,125,142,.28)' : 'rgba(163,88,107,.28)'}`,
              borderRight: `1px solid ${dark ? 'rgba(196,125,142,.28)' : 'rgba(163,88,107,.28)'}`,
              borderBottom: `1px solid ${dark ? 'rgba(196,125,142,.28)' : 'rgba(163,88,107,.28)'}`,
              boxShadow: dark ? '0 -4px 24px rgba(0,0,0,.4)' : '0 -4px 24px rgba(0,0,0,.12)',
            }}
          >
            <div className="flex-1 flex items-center gap-2.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <p className="text-xs leading-normal" style={{ color: dark ? 'rgba(255,255,255,.7)' : 'rgba(28,27,25,.7)' }}>
                We use essential cookies to keep you signed in. Non-essential cookies (analytics, advertising) are only used with your consent.{' '}
                <a href="/cookie" className="font-semibold" style={{ color: dark ? '#c47d8e' : '#8b4a5e' }}>Cookie policy</a>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openSheet}
                className="flex-1 sm:flex-none py-[7px] px-2 text-xs font-semibold cursor-pointer bg-transparent border-none"
                style={{ color: dark ? 'rgba(255,255,255,.7)' : 'rgba(28,27,25,.75)' }}
              >Cookie settings</button>
              <button
                onClick={() => save({ analytics: false, advertising: false })}
                className="flex-1 sm:flex-none py-[7px] px-[18px] rounded-lg text-xs font-medium cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px"
                style={{
                  color: dark ? 'rgba(255,255,255,.7)' : 'rgba(28,27,25,.75)',
                  border: `1px solid ${dark ? 'rgba(255,255,255,.24)' : 'rgba(28,27,25,.25)'}`,
                }}
              >Decline</button>
              <button
                onClick={() => save({ analytics: true, advertising: true })}
                className="flex-1 sm:flex-none py-[7px] px-[18px] rounded-lg text-xs font-medium cursor-pointer bg-accent text-white transition-transform duration-200 hover:-translate-y-px"
              >Accept</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
