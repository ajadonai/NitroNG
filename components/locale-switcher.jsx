'use client';
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CURRENCIES, CURRENCY_CODES, canDisplay, isActive } from "../lib/currency";
import { useLocale, useT, LANGUAGES } from "./locale";
import { useBodyScrollLock } from "./ui-primitives";

/**
 * The two nav controls. Same pill as the sky toggle: ringed, 999px, labelled
 * on a desktop and a bare symbol on a phone so both fit beside the theme
 * toggle and the hamburger. Styled by .loc-* in globals.css.
 *
 * One surface serves both breakpoints: a popover hung under the pill on a
 * desktop, a bottom sheet on a phone. CSS decides which, so there is one menu,
 * one piece of state, and one behaviour to learn. It owns the screen while
 * open — backdrop, scroll lock, opaque card — per the modal rules.
 */

const GLOBE = (
  <svg className="loc-gl" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
  </svg>
);
const CHEV = <svg className="loc-cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const TICK = <svg className="loc-tk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;

const MOBILE = "(max-width: 1023px)";

function Picker({ label, trigger, children, open, setOpen }) {
  const id = useId();
  const trig = useRef(null);
  // Where the desktop popover hangs. Null on a phone, where CSS pins the same
  // element to the bottom of the viewport as a sheet instead.
  const [anchor, setAnchor] = useState(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // The menu is portalled to <body>: the nav bars sit under a backdrop-filter,
  // which turns any position:fixed descendant into a child of the bar instead
  // of the viewport — the mobile sheet was rendering at the top of the screen.
  // Portalling means measuring the trigger ourselves to place the popover.
  useEffect(() => {
    if (!open) return undefined;
    const measure = () => {
      if (window.matchMedia(MOBILE).matches) { setAnchor({}); return; }
      const r = trig.current?.getBoundingClientRect();
      if (r) setAnchor({ top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [open]);

  return (
    <div className="loc-wrap">
      <button ref={trig} type="button" className={`loc-pill${open ? " open" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label}
        onClick={() => setOpen(o => !o)}>
        {trigger}
      </button>
      {open && anchor && createPortal(
        <>
          <button type="button" className="loc-backdrop" aria-label={`Close ${label.toLowerCase()}`} onClick={() => setOpen(false)} />
          <div id={id} role="menu" aria-label={label} className="loc-menu" style={anchor}>
            <div className="loc-grab" aria-hidden="true" />
            {children}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

export function CurrencySwitcher() {
  const loc = useLocale();
  const tr = useT();
  const [open, setOpen] = useState(false);
  if (!loc) return null;
  const { currency, setCurrency, fx, fxPending, ensureRates } = loc;
  const meta = CURRENCIES[currency];

  return (
    <Picker label="Currency" open={open} setOpen={(v) => { if (v) ensureRates?.(); setOpen(v); }}
      trigger={<>
        <span className={`loc-sym${currency === "KES" ? " wide" : ""}`} aria-hidden="true">{meta.symbol}</span>
        <span className="loc-cd">{currency}</span>
        {CHEV}
      </>}>
      <div className="loc-sec">{tr("Show prices in")}</div>
      <CurrencyOptions onPick={() => setOpen(false)} />
    </Picker>
  );
}

/**
 * The currency rows on their own, so a popover and a settings modal can show
 * the same list. Rendered by CurrencySwitcher above and by the settings page.
 */
export function CurrencyOptions({ onPick }) {
  const loc = useLocale();
  const tr = useT();
  if (!loc) return null;
  const { currency, setCurrency, fx, fxPending } = loc;
  return (
    <>
      {CURRENCY_CODES.map(code => {
        const c = CURRENCIES[code];
        const on = code === currency;
        // Offered only if choosing it would actually change the prices: active,
        // and with a rate to convert by. Otherwise it reads as "Soon" rather
        // than selecting and silently leaving everything in naira. While the
        // rates are still in flight we go on `active` alone — an unanswered
        // request is not the same as a missing rate.
        const usable = fxPending ? isActive(code) : canDisplay(code, fx);
        return (
          <button key={code} type="button" role="menuitemradio" aria-checked={on} disabled={!usable}
            className={`loc-opt${on ? " on" : ""}${usable ? "" : " soon"}`}
            onClick={() => { if (usable) { setCurrency(code); onPick?.(); } }}>
            <span className={`loc-osy${code === "KES" ? " wide" : ""}`} aria-hidden="true">{c.symbol}</span>
            <span className="loc-onm">{c.name}</span>
            {usable ? <><span className="loc-ocd">{code}</span>{TICK}</> : <span className="loc-soon">{tr("Soon")}</span>}
          </button>
        );
      })}
    </>
  );
}

export function LanguageSwitcher() {
  const loc = useLocale();
  const tr = useT();
  const [open, setOpen] = useState(false);
  if (!loc) return null;
  const { lang, setLang } = loc;
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <Picker label="Language" open={open} setOpen={setOpen}
      trigger={<>
        {GLOBE}
        <span className="loc-cd">{current.code.toUpperCase().slice(0, 2)}</span>
        {CHEV}
      </>}>
      <div className="loc-sec">{tr("Language")}</div>
      <LanguageOptions onPick={() => setOpen(false)} />
    </Picker>
  );
}

/** The language rows on their own — see CurrencyOptions. */
export function LanguageOptions({ onPick }) {
  const loc = useLocale();
  const tr = useT();
  if (!loc) return null;
  const { lang, setLang } = loc;
  return (
    <>
      {LANGUAGES.map(l => {
        const on = l.code === lang;
        return (
          <button key={l.code} type="button" role="menuitemradio" aria-checked={on} disabled={!l.available}
            className={`loc-opt${on ? " on" : ""}${l.available ? "" : " soon"}`}
            onClick={() => { if (l.available) { setLang(l.code); onPick?.(); } }}>
            <span className="loc-ofg" aria-hidden="true">{l.flag}</span>
            <span className="loc-onm">{l.label}</span>
            {l.available ? TICK : <span className="loc-soon">{tr("Soon")}</span>}
          </button>
        );
      })}
    </>
  );
}
