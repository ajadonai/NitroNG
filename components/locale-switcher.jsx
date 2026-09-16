'use client';
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CURRENCIES, CURRENCY_CODES, canDisplay, isActive } from "../lib/currency";
import { useLocale, useT, LANGUAGES } from "./locale";
import { useBodyScrollLock } from "./ui-primitives";
import { flagSvg, LOCALE_FLAG } from "../lib/flags";

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

const CHEV = <svg className="loc-cv" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const TICK = <svg className="loc-tk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;

const MOBILE = "(max-width: 1023px)";

/**
 * Greetings, not language names. A reader who does not know the word "Pidgin"
 * knows "How far", and a reader who cannot read Latin script recognises مرحبا.
 * Deliberately not translated: each one is already in its own language, which
 * is the whole point of it.
 */
const GREETING = { en: "Hello", pcm: "How far", fr: "Bonjour", sw: "Habari", ar: "مرحبا" };

/** The currency roundel. One gold for all five — the ground says which country,
 *  this says money, and money looks the same everywhere. */
function Coin({ symbol, wide }) {
  return <span className={`loc-coin${wide ? " wide" : ""}`} aria-hidden="true">{symbol}</span>;
}

/** The same circle, carrying drawn flag artwork. See lib/flags.js for why these
 *  are drawn rather than the emoji this file used to print. */
function Flag({ code }) {
  return (
    <span className="loc-flag" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: flagSvg(LOCALE_FLAG[code] || "gb", 24) }} />
  );
}

/**
 * The greeting, rolling. Every greeting is stacked in one grid cell and the
 * current one slid into view, the same way the hero's changing word works — so
 * the box can size itself to the widest and nothing is measured at runtime.
 */
function Greeting({ code }) {
  const codes = Object.keys(GREETING);
  const i = Math.max(0, codes.indexOf(code));
  return (
    <span className="loc-greet">
      {codes.map((c, n) => (
        <i key={c} className={n === i ? "on" : n === (i - 1 + codes.length) % codes.length ? "out" : ""}
          aria-hidden={n !== i}>{GREETING[c]}</i>
      ))}
    </span>
  );
}

function Picker({ label, trigger, children, open, setOpen, ground }) {
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
      <button ref={trig} type="button" className={`loc-pill${open ? " open" : ""}${ground ? " painted" : ""}`} data-ground={ground || undefined} aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label}
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
  const { currency, ensureRates } = loc;
  const meta = CURRENCIES[currency];

  return (
    <Picker label={tr("Currency")} open={open} setOpen={(v) => { if (v) ensureRates?.(); setOpen(v); }}
      trigger={<>
        <Coin symbol={meta.symbol} wide={currency === "KES"} />
        <span className="loc-cd">{currency}</span>
        {CHEV}
      </>} ground={currency}>
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
  const { lang } = loc;
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  return (
    <Picker label={tr("Language")} open={open} setOpen={setOpen}
      trigger={<>
        <Flag code={current.code} />
        {/* The greeting is the label. "Hello" beside a Union flag does not need
            "EN" after it, and the two-letter code was the least readable thing
            in the nav. It rolls on the hero's curve; the flag springs in. */}
        <Greeting code={current.code} />
        {CHEV}
      </>} ground={current.code}>
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
            <Flag code={l.code} />
            <span className="loc-onm">{l.label}</span>
            <span className="loc-ogr" aria-hidden="true">{GREETING[l.code]}</span>
            {l.available ? TICK : <span className="loc-soon">{tr("Soon")}</span>}
          </button>
        );
      })}
    </>
  );
}
