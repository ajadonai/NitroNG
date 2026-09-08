'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { CURRENCIES, BASE_CURRENCY, isActive, formatDisplayPrice, formatMoney, convertFromNaira, convertToNaira } from "../lib/currency";
import { LOCALES, LOCALE_CODES, SOURCE_LOCALE, isLocale, makeTranslator } from "../lib/i18n";

/**
 * Currency and language, the way theme already works: a preference in
 * localStorage, a provider every page already sits under, and one hook.
 *
 * Currency here is a display unit and nothing more. The wallet holds naira and
 * every price is naira; a foreign currency on screen is that naira read in
 * another unit at the one deposit rate the server resolves. Switching cannot
 * change what anyone pays — the premium, when charged, is inside the exchange
 * at deposit, not in anything this file computes.
 *
 * Language is a shell for now: English is the only populated one. The others
 * are listed so the control looks finished and the plumbing exists, and they
 * are marked unavailable so choosing them is impossible, not just useless.
 */

const LocaleCtx = createContext(null);

// A language appears in the picker once its dictionary covers enough of the
// site to be worth choosing. Empty today: the dictionaries exist but are not
// filled in, and a half-English French page is worse than an English one.
// Add a code here when its coverage is good — `npm run i18n:report` says.
const AVAILABLE_LOCALES = new Set([]);

/**
 * The switcher's list, derived from lib/i18n.js so there is one place a
 * language exists. `available` is not a property of a language, it is a fact
 * about whether its dictionary has arrived — English is the source and always
 * available; the rest turn on when `messages/<code>.json` has enough in it.
 */
export const LANGUAGES = LOCALE_CODES.map((code) => ({
  ...LOCALES[code],
  available: code === SOURCE_LOCALE || AVAILABLE_LOCALES.has(code),
}));

/**
 * The currency and language controls: off in production until the switch is
 * finished (Trip's call, 8 Sep 2026), on locally so it can be worked on.
 * NODE_ENV is inlined at build time, so a production build ships neither the
 * buttons nor this branch. Replace the expression with `true` on the day it
 * goes live.
 *
 * It gates two things, and the second is the one that is easy to miss: anyone
 * who chose a currency while the buttons were live still has it in
 * localStorage, and with nothing on screen to change it they would be stuck
 * reading dollars with no way back. So the saved choice is ignored while the
 * controls are hidden. Ignored, not deleted — it returns when they do.
 */
export const SWITCHER_LIVE = process.env.NODE_ENV === "development";

const CURRENCY_KEY = "nitro-currency";
const LANG_KEY = "nitro-lang";
const EMPTY_FX = { depositRate: null, usdRates: {} };

export function LocaleProvider({ children }) {
  const [currency, setCurrencyState] = useState(BASE_CURRENCY);
  const [lang, setLangState] = useState("en");
  const [fx, setFx] = useState(EMPTY_FX);

  // Saved preferences, read once. Anything unrecognised falls back to the
  // defaults rather than throwing, since localStorage can hold anything — this
  // is also what quietly reverts anyone who chose a currency before it was
  // turned back off, without a jarring "your currency was reset" moment.
  useEffect(() => {
    if (!SWITCHER_LIVE) return;
    try { const c = localStorage.getItem(CURRENCY_KEY); if (isActive(c)) setCurrencyState(c); } catch {}
    try { const l = localStorage.getItem(LANG_KEY); if (LANGUAGES.some(x => x.code === l && x.available)) setLangState(l); } catch {}
  }, []);

  // Fetched when a foreign currency is on screen, and on demand when the
  // picker opens — the menu has to know which currencies it can actually
  // convert before it offers them. A Nigerian who never opens it makes no
  // request. The endpoint is small and edge-cached, and this only runs once.
  const [ratesWanted, setRatesWanted] = useState(false);
  const [fxFailed, setFxFailed] = useState(false);
  const ensureRates = useCallback(() => setRatesWanted(true), []);

  useEffect(() => {
    if (currency === BASE_CURRENCY && !ratesWanted) return undefined;
    if (fx.depositRate !== null) return undefined;
    let dead = false;
    fetch("/api/fx")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (dead) return;
        if (d) setFx({ depositRate: d.depositRate ?? null, usdRates: d.usdRates || {} });
        else setFxFailed(true);
      })
      .catch(() => { if (!dead) setFxFailed(true); });
    return () => { dead = true; };
  }, [currency, ratesWanted, fx.depositRate]);

  // "We have asked and have not heard back." The picker needs the distinction
  // between no rate and no rate YET: without it, every foreign currency reads
  // "Soon" for the half-second the fetch takes, which looks like the feature is
  // off rather than loading. Set from ratesWanted rather than the effect, so it
  // is already true on the render that opens the menu.
  const fxPending = (ratesWanted || currency !== BASE_CURRENCY) && fx.depositRate === null && !fxFailed;

  const setCurrency = useCallback((code) => {
    if (!isActive(code)) return;
    setCurrencyState(code);
    try { localStorage.setItem(CURRENCY_KEY, code); } catch {}
  }, []);

  // The dictionary for the chosen language, fetched once when it is chosen.
  // English needs none — it is the source — so a Nigerian reading the site in
  // English never downloads a translation file, which is almost everybody.
  const [messages, setMessages] = useState({});
  useEffect(() => {
    if (lang === SOURCE_LOCALE || !isLocale(lang)) { setMessages({}); return undefined; }
    let dead = false;
    import(`../messages/${lang}.json`)
      .then((m) => { if (!dead) setMessages(m.default || m); })
      .catch(() => { if (!dead) setMessages({}); });   // falls back to English
    return () => { dead = true; };
  }, [lang]);

  // English in, the chosen language out — or the same English back, which is
  // what makes a missing translation merely untranslated rather than broken.
  const t = useMemo(() => makeTranslator(lang, messages), [lang, messages]);

  const setLang = useCallback((code) => {
    if (!LANGUAGES.some(x => x.code === code && x.available)) return;
    setLangState(code);
    try { localStorage.setItem(LANG_KEY, code); } catch {}
  }, []);

  // Naira in → the string that goes on screen. With no rate yet (or ever), it
  // prints naira, which is the contract every caller relies on.
  // `money(n)` is a price and rounds up; `money(n, { round: "down" })` is money
  // someone holds and rounds down. See the note in lib/currency.js.
  const fmt = useCallback(
    (naira, opts) => formatDisplayPrice(naira, { code: currency, depositRate: fx.depositRate, usdRates: fx.usdRates, ...opts }),
    [currency, fx],
  );

  // The two directions a deposit field needs: naira → what to show in the box,
  // and back again for what the customer typed. Both null when there is no rate.
  const toDisplay = useCallback(
    (naira) => convertFromNaira(naira, { code: currency, depositRate: fx.depositRate, usdRates: fx.usdRates }),
    [currency, fx],
  );
  // Formats a figure that is ALREADY in the display currency — the deposit
  // quick-picks, which are native to each currency rather than converted.
  const fmtNative = useCallback((amount) => formatMoney(amount, currency), [currency]);

  const toNaira = useCallback(
    (amount) => convertToNaira(amount, { code: currency, depositRate: fx.depositRate, usdRates: fx.usdRates }),
    [currency, fx],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, lang, setLang, t, fx, fxPending, fmt, fmtNative, toDisplay, toNaira, ensureRates, meta: CURRENCIES[currency] || CURRENCIES[BASE_CURRENCY] }),
    [currency, setCurrency, lang, setLang, t, fx, fxPending, fmt, fmtNative, toDisplay, toNaira, ensureRates],
  );

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  return useContext(LocaleCtx);
}

/**
 * The translator, bound to the chosen language.
 *
 *     const t = useT();
 *     <h2>{t("Fund your wallet")}</h2>
 *
 * Outside the provider — admin, tests, anything server-rendered — it returns
 * the English unchanged, so it is always safe to call and never needs guarding.
 */
export function useT() {
  const l = useContext(LocaleCtx);
  return l?.t ?? ((english) => english);
}

/** A money formatter bound to the current display currency. Outside the
 *  provider (admin, tests) it formats naira, so it is always safe to call. */
export function useMoney() {
  const l = useContext(LocaleCtx);
  return l?.fmt ?? ((n, opts) => formatMoney(n, BASE_CURRENCY, opts));
}
