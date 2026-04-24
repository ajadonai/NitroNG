'use client';
import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const consent = localStorage.getItem('nitro-cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

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
    const interval = setInterval(check, 500);
    return () => { window.removeEventListener('storage', check); observer.disconnect(); clearInterval(interval); };
  }, []);

  const dismiss = (choice) => {
    localStorage.setItem('nitro-cookie-consent', choice);
    setExiting(true);
  };

  if (!show) return null;

  return (
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
            We use cookies to keep you signed in and improve your experience.{' '}
            <a href="/cookie" className="font-semibold" style={{ color: dark ? '#c47d8e' : '#8b4a5e' }}>Cookie policy</a>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => dismiss('declined')}
            className="flex-1 sm:flex-none py-[7px] px-[18px] rounded-lg text-xs font-medium cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px"
            style={{
              color: dark ? 'rgba(255,255,255,.7)' : 'rgba(28,27,25,.75)',
              border: `1px solid ${dark ? 'rgba(255,255,255,.24)' : 'rgba(28,27,25,.25)'}`,
            }}
          >Decline</button>
          <button
            onClick={() => dismiss('accepted')}
            className="flex-1 sm:flex-none py-[7px] px-[18px] rounded-lg text-xs font-medium cursor-pointer bg-accent text-white transition-transform duration-200 hover:-translate-y-px"
          >Accept</button>
        </div>
      </div>
    </div>
  );
}
