'use client';
import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [show, setShow] = useState(false);
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
    // Re-check when storage changes or on theme toggle
    window.addEventListener('storage', check);
    // Also listen for custom theme change events
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true });
    const interval = setInterval(check, 500);
    return () => { window.removeEventListener('storage', check); observer.disconnect(); clearInterval(interval); };
  }, []);

  const accept = () => {
    localStorage.setItem('nitro-cookie-consent', 'accepted');
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem('nitro-cookie-consent', 'declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="cookie-banner">
      <div className="cookie-inner" style={{
        background: dark ? '#0f1320' : 'rgba(244,241,237,.98)',
        borderTop: `0.5px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(163,88,107,.18)'}`,
        borderRight: `0.5px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(163,88,107,.18)'}`,
        borderBottom: `0.5px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(163,88,107,.18)'}`,
        boxShadow: dark ? '0 -2px 16px rgba(0,0,0,.3)' : '0 -2px 12px rgba(0,0,0,.06)',
      }}>
        <div className="cookie-text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <p style={{ color: dark ? 'rgba(255,255,255,.6)' : 'rgba(28,27,25,.6)' }}>
            We use cookies to keep you signed in and improve your experience.{' '}
            <a href="/cookie" style={{ color: dark ? '#c47d8e' : '#8b4a5e' }}>Cookie policy</a>
          </p>
        </div>
        <div className="cookie-actions">
          <button onClick={decline} className="cookie-decline" style={{
            color: dark ? 'rgba(255,255,255,.45)' : 'rgba(28,27,25,.45)',
            border: `0.5px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(28,27,25,.15)'}`,
          }}>Decline</button>
          <button onClick={accept} className="cookie-accept">Accept</button>
        </div>
      </div>
    </div>
  );
}
