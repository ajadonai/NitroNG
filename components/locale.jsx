'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { CURRENCIES, BASE_CURRENCY, isActive, formatDisplayPrice, formatMoney } from "../lib/currency";

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

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧", available: true },
  { code: "pcm", label: "Pidgin", flag: "🇳🇬", available: false },
  { code: "yo", label: "Yoruba", flag: "🇳🇬", available: false },
  { code: "ha", label: "Hausa", flag: "🇳🇬", available: false },
  { code: "ig", label: "Igbo", flag: "🇳🇬", available: false },
  // Pairs with the Kenyan shilling in the currency menu: a language for each
  // currency Nitro sells in.
  { code: "sw", label: "Kiswahili", flag: "🇰🇪", available: false },
  { code: "fr", label: "Français", flag: "🇫🇷", available: false },
];

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

  const setLang = useCallback((code) => {
    if (!LANGUAGES.some(x => x.code === code && x.available)) return;
    setLangState(code);
    try { localStorage.setItem(LANG_KEY, code); } catch {}
  }, []);

  // Naira in → the string that goes on screen. With no rate yet (or ever), it
  // prints naira, which is the contract every caller relies on.
  const fmt = useCallback(
    (naira) => formatDisplayPrice(naira, { code: currency, depositRate: fx.depositRate, usdRates: fx.usdRates }),
    [currency, fx],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, lang, setLang, fx, fxPending, fmt, ensureRates, meta: CURRENCIES[currency] || CURRENCIES[BASE_CURRENCY] }),
    [currency, setCurrency, lang, setLang, fx, fxPending, fmt, ensureRates],
  );

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  return useContext(LocaleCtx);
}

/** A money formatter bound to the current display currency. Outside the
 *  provider (admin, tests) it formats naira, so it is always safe to call. */
export function useMoney() {
  const l = useContext(LocaleCtx);
  return l?.fmt ?? ((n) => formatMoney(n, BASE_CURRENCY));
}
