'use client';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { CURRENCIES, BASE_CURRENCY, isActive, formatDisplayPrice, formatMoney, convertFromNaira, convertToNaira } from "../lib/currency";
import { LOCALES, LOCALE_CODES, SOURCE_LOCALE, isLocale, makeTranslator } from "../lib/i18n";
import { fD, fT, fDY, fRel } from "../lib/format";

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
const AVAILABLE_LOCALES = new Set(["pcm", "fr", "sw", "ar"]);

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
// Live since 12 Sep 2026: GHS and KES are real charge currencies (International
// Nitro step 3) and the four dictionaries sit at 100%. Set back to
// `process.env.NODE_ENV === "development"` to hide both pickers again — the
// provider also stops honouring saved preferences while this is false.
export const SWITCHER_LIVE = true;

const CURRENCY_KEY = "nitro-currency";
const LANG_KEY = "nitro-lang";
const EMPTY_FX = { depositRate: null, usdRates: {} };

/**
 * initialLang and initialMessages come from the server on a locale route —
 * /fr, /sw, /ar. They exist for one reason: Google indexes what is
 * server-rendered. Without them the provider starts in English, renders an
 * English page, and only switches after hydration, so a French URL would be an
 * English page as far as a crawler is concerned. That is worse than having no
 * French URL at all, because it is duplicate content in the wrong language.
 *
 * On the English site both are undefined and nothing changes: the provider
 * starts at "en" and reads the reader's saved choice on mount, as before.
 */
export function LocaleProvider({ children, initialLang, initialMessages }) {
  const routeLocale = isLocale(initialLang) && initialLang !== SOURCE_LOCALE ? initialLang : null;
  const [currency, setCurrencyState] = useState(BASE_CURRENCY);
  const [lang, setLangState] = useState(routeLocale || "en");
  const [fx, setFx] = useState(EMPTY_FX);

  // Saved preferences, read once. Anything unrecognised falls back to the
  // defaults rather than throwing, since localStorage can hold anything — this
  // is also what quietly reverts anyone who chose a currency before it was
  // turned back off, without a jarring "your currency was reset" moment.
  useEffect(() => {
    if (!SWITCHER_LIVE) return;
    try { const c = localStorage.getItem(CURRENCY_KEY); if (isActive(c)) setCurrencyState(c); } catch {}
    // A locale in the URL outranks a saved preference: /fr is French for
    // everybody, including someone who last read the site in Pidgin.
    if (routeLocale) return;
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
  // Seeded from the server on a locale route, so the very first render is
  // already translated and the client never downloads a dictionary it was
  // handed. Everywhere else it starts empty and is fetched on demand.
  const [messages, setMessages] = useState(routeLocale && initialMessages ? initialMessages : {});
  useEffect(() => {
    if (lang === SOURCE_LOCALE || !isLocale(lang)) { setMessages({}); return undefined; }
    if (lang === routeLocale && initialMessages) return undefined;
    let dead = false;
    import(`../messages/${lang}.json`)
      .then((m) => { if (!dead) setMessages(m.default || m); })
      .catch(() => { if (!dead) setMessages({}); });   // falls back to English
    return () => { dead = true; };
  }, [lang]);

  // English in, the chosen language out — or the same English back, which is
  // what makes a missing translation merely untranslated rather than broken.
  const tr = useMemo(() => makeTranslator(lang, messages), [lang, messages]);

  // Dates bound to the chosen language. Weekday and month names come from Intl
  // rather than the dictionary, so translating copy never reaches them — a
  // French page showed "Tuesday, September 8" under "Bonsoir" until this
  // existed. fRel also carries two actual words, which it takes from here.
  const dates = useMemo(() => ({
    d: (v, dateOnly) => fD(v, dateOnly, lang),
    t: (v) => fT(v, lang),
    dy: (v) => fDY(v, lang),
    rel: (v) => fRel(v, lang, {
      yesterday: tr("Yesterday"),
      daysAgo: (n) => `${n}${tr("d ago")}`,
    }),
  }), [lang, tr]);

  // Tell the document what language it is actually in, and which way it runs.
  //
  // Both halves of this were customer-visible bugs, found the same evening on
  // the Arabic dashboard. The layout ships `lang="en-NG"` because the server
  // cannot know the choice — it lives in localStorage — so a page of Arabic
  // was announcing itself as English, and Chrome duly offered to translate it:
  // "تابع التسليم" came back as "Follow the prayer" and "أرسل طلبك" as "Send
  // your request", English nonsense sitting in the middle of a modal nobody
  // could explain. A browser is right to translate a page it is told is in a
  // language it plainly is not.
  //
  // `dir` is the other half. Without it Arabic is laid out left-to-right and
  // the bidirectional algorithm puts every neutral character in the wrong
  // place: "Budget (بدون تعويض)" rendered as "Budget (بدون) تعويض)". That is
  // not the dictionary being wrong, it is the paragraph running the wrong way.
  //
  // This is not the whole RTL job — mirroring the nav, the chevrons and the
  // back arrows is still its own piece of work — but it is the half that stops
  // sentences being corrupted, and it is three lines.
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang === SOURCE_LOCALE ? "en-NG" : lang;
    el.dir = LOCALES[lang]?.dir || "ltr";
  }, [lang]);

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
    () => ({ currency, setCurrency, lang, setLang, tr, dates, fx, fxPending, fmt, fmtNative, toDisplay, toNaira, ensureRates, meta: CURRENCIES[currency] || CURRENCIES[BASE_CURRENCY] }),
    [currency, setCurrency, lang, setLang, tr, dates, fx, fxPending, fmt, fmtNative, toDisplay, toNaira, ensureRates],
  );

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  return useContext(LocaleCtx);
}

/**
 * The translator, bound to the chosen language.
 *
 *     const tr = useT();
 *     <h2>{tr("Fund your wallet")}</h2>
 *
 * Outside the provider — admin, tests, anything server-rendered — it returns
 * the English unchanged, so it is always safe to call and never needs guarding.
 */
export function useT() {
  const l = useContext(LocaleCtx);
  return l?.tr ?? ((english) => english);
}

/**
 * Date formatters bound to the chosen language.
 *
 *     const d = useDates();
 *     d.d(order.created)      → "8 sept." in French, "8 Sept" in English
 *
 * Outside the provider it formats in Nigerian English, the same default the
 * raw helpers in lib/format.js have always had.
 */
export function useDates() {
  const l = useContext(LocaleCtx);
  return l?.dates ?? {
    d: (v, dateOnly) => fD(v, dateOnly),
    t: (v) => fT(v),
    dy: (v) => fDY(v),
    rel: (v) => fRel(v),
  };
}

/** A money formatter bound to the current display currency. Outside the
 *  provider (admin, tests) it formats naira, so it is always safe to call. */
export function useMoney() {
  const l = useContext(LocaleCtx);
  return l?.fmt ?? ((n, opts) => formatMoney(n, BASE_CURRENCY, opts));
}
