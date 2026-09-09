'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useT } from "./locale";
import { createPortal } from 'react-dom';
import { COUNTRIES, DEFAULT_COUNTRY, getCountry } from '../lib/phone-countries';

/**
 * The WhatsApp number field: country flag, then the dial code as a dimmed
 * prefix inside the input so nobody has to guess whether to type their own.
 *
 * One component because there are four of these — the auth modal's signup and
 * login-by-phone forms, the landing hero's signup, and the dashboard's "add
 * your number" prompt — and each hand-rolled copy was another place for the
 * rule to drift. Six copies of the Nigeria-only check had already drifted
 * apart before this existed; the landing hero was a seventh nobody had found.
 *
 * The menu is portalled to <body> and positioned from the trigger's own rect.
 * It has to be: every one of these sits inside a card with `overflow-y-auto`,
 * which clips an absolutely-positioned child, so the list was cut off exactly
 * where it needed to be readable. On a phone it becomes a bottom sheet, which
 * is both thumb-reachable and impossible to crop.
 */

const MOBILE = '(max-width: 1023px)';

export function PhoneField({
  id = 'phone',
  country = DEFAULT_COUNTRY,
  onCountry,
  value = '',
  onValue,
  t,
  dark,
  compact = false,
  autoFocus = false,
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const trigRef = useRef(null);
  const listId = useId();
  const cc = getCountry(country) || getCountry(DEFAULT_COUNTRY);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      if (window.matchMedia(MOBILE).matches) { setAnchor({ mobile: true }); return; }
      const r = trigRef.current?.getBoundingClientRect();
      if (!r) return;
      // Flip above the trigger when there is not room below, so the list is
      // never the thing that pushes a short modal off-screen.
      const below = window.innerHeight - r.bottom;
      const needed = 8 + COUNTRIES.length * 38 + 12;
      setAnchor(below < needed && r.top > needed
        ? { left: Math.round(r.left), bottom: Math.round(window.innerHeight - r.top + 6) }
        : { left: Math.round(r.left), top: Math.round(r.bottom + 6) });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [open]);

  const pad = compact ? '11px 12px' : '12px';
  const inputPad = compact ? '11px' : '12px';
  const surface = dark ? '#171126' : '#fffdfb';

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        ref={trigRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Country: ${cc.name}`}
        style={{
          padding: pad, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontFamily: 'inherit',
          background: t.inputBg, border: `1px solid ${open ? (t.accent || '#c47d8e') : t.inputBorder}`,
          color: t.textSoft || t.soft,
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>{cc.flag}</span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"
          style={{ opacity: .5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
        {/* Stronger than the placeholder: this is content, not a hint. */}
        <span aria-hidden="true" style={{ position: 'absolute', left: 14, fontSize: 15, pointerEvents: 'none', userSelect: 'none', color: t.textSoft || t.soft }}>
          +{cc.dial}
        </span>
        <input
          id={id}
          name="phone"
          type="tel"
          autoComplete="tel"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onValue?.(e.target.value.replace(/\D/g, '').slice(0, cc.maxLocal + 1))}
          placeholder={cc.example}
          className="font-[inherit]"
          style={{
            width: '100%', padding: `${inputPad} 14px ${inputPad} ${28 + cc.dial.length * 9}px`,
            borderRadius: 12, fontSize: 15, outline: 'none',
            background: t.inputBg, border: `1px solid ${t.inputBorder}`, color: t.text,
          }}
        />
      </div>

      {open && anchor && createPortal(
        <>
          <button
            type="button"
            aria-label={tr("Close country list")}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000, border: 'none', cursor: 'default',
              background: anchor.mobile ? 'rgba(0,0,0,.42)' : 'transparent',
            }}
          />
          <div
            id={listId}
            role="listbox"
            aria-label={tr("Country")}
            style={anchor.mobile
              ? { position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10001, padding: '9px 9px calc(14px + env(safe-area-inset-bottom))', borderRadius: '19px 19px 0 0', background: surface, border: `1px solid ${t.inputBorder}`, boxShadow: '0 -18px 44px rgba(0,0,0,.26)' }
              : { position: 'fixed', ...anchor, zIndex: 10001, width: 236, padding: 6, borderRadius: 13, background: surface, border: `1px solid ${t.inputBorder}`, boxShadow: '0 18px 44px rgba(0,0,0,.24)' }}
          >
            {anchor.mobile && <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(127,127,127,.3)', margin: '1px auto 7px' }} />}
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={c.code === country}
                onClick={() => { onCountry?.(c.code); onValue?.(''); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: anchor.mobile ? '11px' : '8px 9px', borderRadius: 999, border: 'none',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  fontSize: anchor.mobile ? 13.5 : 13, fontWeight: 600, color: t.text,
                  background: c.code === country ? 'rgba(196,125,142,.16)' : 'transparent',
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1, width: 20, textAlign: 'center' }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: 11, color: t.textMuted || t.muted }}>+{c.dial}</span>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
