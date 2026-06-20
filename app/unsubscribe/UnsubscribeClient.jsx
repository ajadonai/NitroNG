'use client';

import { useState, useEffect } from 'react';

const ACCENT = '#c47d8e';
const BG = '#e9e4dd';

export default function UnsubscribeClient({ token }) {
  // states: loading | confirm | done | resubscribed | invalid
  const [state, setState] = useState('loading');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        if (d.valid) { setEmail(d.email); setState('confirm'); }
        else setState('invalid');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  async function handleAction(action) {
    setBusy(true);
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      const data = await res.json();
      if (data.success) {
        setState(action === 'resubscribe' ? 'resubscribed' : 'done');
      } else {
        setState('invalid');
      }
    } catch {
      setState('invalid');
    } finally {
      setBusy(false);
    }
  }

  const heading = {
    loading: 'Loading…',
    confirm: 'Unsubscribe from Nitro promotions?',
    done: "You've been unsubscribed",
    resubscribed: 'Welcome back!',
    invalid: 'Invalid link',
  }[state];

  const body = {
    loading: 'Validating your link…',
    confirm: `We’ll stop sending promotional emails to ${email}. You’ll still receive order confirmations and account alerts.`,
    done: 'You won’t receive any more promotional emails from Nitro.',
    resubscribed: "You’ve been resubscribed to Nitro promotions.",
    invalid: 'This link is invalid or has expired. You can manage your notification preferences from your dashboard.',
  }[state];

  return (
    <div style={{
      margin: 0, padding: '40px 20px', background: BG,
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: 440, width: '100%', background: '#fff',
        borderRadius: 22, border: '1px solid #e7e0d8',
        padding: '40px 34px', textAlign: 'center',
      }}>
        <img
          src="https://nitro.ng/wordmark-accent.svg"
          alt="Nitro"
          style={{ height: 28, marginBottom: 28 }}
        />

        <h1 style={{
          fontSize: 22, fontWeight: 800, color: '#1a1a1a',
          margin: '0 0 16px', lineHeight: 1.3,
        }}>{heading}</h1>

        <p style={{
          fontSize: 15, lineHeight: 1.7, color: '#555',
          margin: '0 0 24px',
        }}>{body}</p>

        {state === 'confirm' && (
          <button
            onClick={() => handleAction('unsubscribe')}
            disabled={busy}
            style={{
              display: 'inline-block', background: ACCENT, color: '#fff',
              fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer',
              padding: '14px 32px', borderRadius: 14, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Unsubscribing…' : 'Unsubscribe'}
          </button>
        )}

        {state === 'done' && (
          <div>
            <button
              onClick={() => handleAction('resubscribe')}
              disabled={busy}
              style={{
                display: 'inline-block', background: ACCENT, color: '#fff',
                fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer',
                padding: '14px 32px', borderRadius: 14, opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Resubscribing…' : 'Resubscribe'}
            </button>
            <p style={{ marginTop: 16 }}>
              <a
                href="/dashboard?page=settings#set-notifications"
                style={{ color: ACCENT, fontSize: 14, textDecoration: 'underline' }}
              >
                Manage preferences in dashboard
              </a>
            </p>
          </div>
        )}

        {state === 'invalid' && (
          <a
            href="/dashboard?page=settings#set-notifications"
            style={{
              display: 'inline-block', background: ACCENT, color: '#fff',
              fontSize: 15, fontWeight: 800, textDecoration: 'none',
              padding: '14px 32px', borderRadius: 14,
            }}
          >
            Go to dashboard
          </a>
        )}
      </div>
    </div>
  );
}
