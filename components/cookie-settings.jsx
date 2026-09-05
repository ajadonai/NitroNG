'use client';
import { useState, useEffect } from 'react';

const ACCENT = '#c47d8e';

function Switch({ on, locked, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={locked}
      onClick={() => !locked && onChange(!on)}
      className="relative shrink-0 ml-auto w-10 h-[22px] rounded-full border-none p-0 transition-colors duration-200"
      style={{ background: locked ? 'rgba(128,124,120,.55)' : on ? ACCENT : 'rgba(128,124,120,.35)', cursor: locked ? 'default' : 'pointer' }}
    >
      <span className="absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)]" style={{ left: on || locked ? 20 : 2, transition: 'left .2s ease' }} />
    </button>
  );
}

const ROWS = [
  { key: 'necessary', title: 'Necessary', line: 'Sign-in, your cart, your theme. Always on.', locked: true },
  { key: 'analytics', title: 'Analytics', line: 'Counts visits so we know which pages help. No names.' },
  { key: 'advertising', title: 'Advertising', line: 'Lets Meta know a sign-up came from an ad we paid for.' },
];

/**
 * The cookie settings sheet: a centred card on a desktop, a bottom sheet on a phone.
 * `initial` is { analytics, advertising }; `onSave` receives the same shape.
 */
export default function CookieSettingsSheet({ open, onClose, onSave, dark, initial }) {
  const [choice, setChoice] = useState({ analytics: false, advertising: false });

  useEffect(() => {
    if (open) setChoice({ analytics: !!initial?.analytics, advertising: !!initial?.advertising });
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  const text = dark ? '#f5f3f0' : '#1a1917';
  const muted = dark ? '#8a8580' : '#757170';
  const line = dark ? 'rgba(255,255,255,.12)' : 'rgba(28,27,25,.11)';
  const ghost = { color: text, border: `1px solid ${line}`, background: 'transparent' };
  const btn = 'h-[38px] px-4 rounded-[9px] text-[13px] font-semibold cursor-pointer transition-transform duration-150 hover:-translate-y-px max-sm:w-full';

  return (
    <div onClick={onClose} className="fixed inset-0 z-[10000] flex items-center justify-center max-sm:items-end" style={{ background: 'rgba(0,0,0,.45)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-settings-title"
        onClick={e => e.stopPropagation()}
        className="w-[520px] max-w-[calc(100%-28px)] max-sm:w-full max-sm:max-w-full rounded-[18px] max-sm:rounded-b-none px-[22px] pt-[22px] pb-[18px] flex flex-col gap-3"
        style={{ background: dark ? '#171126' : '#ffffff', border: `1px solid ${line}`, boxShadow: '0 24px 60px rgba(0,0,0,.3)', maxHeight: '92dvh', overflowY: 'auto' }}
      >
        <div>
          <h2 id="cookie-settings-title" className="serif text-[28px] font-semibold leading-tight m-0" style={{ color: text }}>Cookie settings</h2>
          <p className="text-[13.5px] leading-normal mt-1 mb-0" style={{ color: muted }}>Choose what the site may remember. Necessary ones keep you signed in and cannot be turned off.</p>
        </div>

        {ROWS.map(r => (
          <div key={r.key} className="flex items-center gap-3 py-3" style={{ borderTop: `1px solid ${line}` }}>
            <div className="flex flex-col min-w-0">
              <span className="text-[14.5px] font-semibold" style={{ color: text }}>{r.title}</span>
              <span className="text-[12.5px]" style={{ color: muted }}>{r.line}</span>
            </div>
            <Switch on={r.locked ? true : !!choice[r.key]} locked={r.locked} label={r.title} onChange={v => setChoice(c => ({ ...c, [r.key]: v }))} />
          </div>
        ))}

        <div className="flex gap-2 justify-end pt-1.5 max-sm:flex-col" style={{ borderTop: `1px solid ${line}` }}>
          <button type="button" className={btn} style={ghost} onClick={() => onSave({ analytics: false, advertising: false })}>Only necessary</button>
          <button type="button" className={btn} style={ghost} onClick={() => onSave({ analytics: true, advertising: true })}>Accept all</button>
          <button type="button" className={`${btn} text-white border-none`} style={{ background: ACCENT }} onClick={() => onSave(choice)}>Save choices</button>
        </div>
        <a href="/cookie" className="text-[12.5px] font-semibold text-center no-underline" style={{ color: ACCENT }}>Read the cookie policy</a>
      </div>
    </div>
  );
}
