'use client';
import { useState } from 'react';

export default function PreviewError() {
  const [dark, setDark] = useState(true);
  const bg = dark ? '#0e1225' : '#f3f0ec';

  const messages = [
    "Payment verification failed",
    "Could not verify payment. Please contact support.",
    "Initialization failed",
    "Check your connection",
  ];

  return (
    <div style={{ minHeight: '100dvh', background: bg, padding: '40px 20px', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', transition: 'background .3s' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: dark ? '#f5f3f0' : '#1a1a1a', margin: 0 }}>Payment Error Alert</h1>
          <button onClick={() => setDark(!dark)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)'}`, background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)', color: dark ? '#ccc' : '#555', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
              background: dark
                ? 'linear-gradient(135deg, rgba(239,68,68,.10), rgba(239,68,68,.04))'
                : 'linear-gradient(135deg, rgba(220,38,38,.07), rgba(220,38,38,.02))',
              border: `1px solid ${dark ? 'rgba(252,165,165,.18)' : 'rgba(220,38,38,.15)'}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: dark ? 'rgba(239,68,68,.15)' : 'rgba(220,38,38,.10)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke={dark ? '#fca5a5' : '#dc2626'} strokeWidth="1.5" opacity=".35" />
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill={dark ? '#fca5a5' : '#dc2626'} opacity=".12" />
                  <path d="M15 9l-6 6M9 9l6 6" stroke={dark ? '#fca5a5' : '#dc2626'} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: dark ? '#fca5a5' : '#dc2626' }}>
                Payment unsuccessful <span style={{ fontWeight: 400, color: dark ? 'rgba(252,165,165,.6)' : 'rgba(220,38,38,.55)' }}>— {msg}</span>
              </div>
              <button style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6,
                color: dark ? 'rgba(252,165,165,.4)' : 'rgba(220,38,38,.3)', flexShrink: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: dark ? '#555' : '#999', textAlign: 'center' }}>Temporary preview — delete before deploying</div>
      </div>
    </div>
  );
}
