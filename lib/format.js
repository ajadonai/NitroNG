/** Format number as Nigerian Naira */
export const fN = (a) => `${a < 0 ? "-" : ""}₦${Math.round(Math.abs(a)).toLocaleString("en-NG")}`;

/**
 * Money someone holds — a wallet balance, a commission ready to withdraw.
 * Never rounds up, because balances arrive here as kobo ÷ 100 and can carry a
 * fraction: rounding ₦4,999.60 to ₦5,000 shows a payout that has not been
 * earned and an order that cannot be afforded. Same rule as the display
 * currency layer, which has the full note (lib/currency.js). Prices keep fN —
 * they round the other way.
 */
export const fHeld = (a) => fN(Math.floor(Number(a) || 0));

const TZ = "Africa/Lagos";

/**
 * The BCP-47 tag each language formats dates in.
 *
 * A French reader met "Tuesday, September 8" under "Bonsoir" — a translated
 * page with an English weekday in the middle of it. The weekday and month
 * names come from Intl, not from the dictionary, so no amount of translating
 * reaches them; only the locale does.
 *
 * Pidgin has no date locale of its own and takes Nigerian English, which is
 * what a Pidgin speaker reads dates in anyway. Arabic uses Latin digits
 * (nu-latn) deliberately: the wallet, the order ids and the prices beside it
 * are all Latin, and mixing numeral systems down one column is harder to read
 * than either on its own.
 *
 * The zone never changes. Nitro runs on Lagos time for everyone, because a
 * delivery estimate has to mean the same thing to the customer and to support.
 */
const DATE_LOCALE = { en: "en-NG", pcm: "en-NG", fr: "fr-FR", sw: "sw-KE", ar: "ar-EG-u-nu-latn" };
export const dateLocale = (lang) => DATE_LOCALE[lang] || DATE_LOCALE.en;

// Nitro runs on Lagos time and always will: the business day, the cron
// boundaries and the ops team are all WAT. What changed is who is reading —
// signup now accepts five countries, so a customer in London or Nairobi can be
// looking at these timestamps. Every time therefore carries its zone ("14:32
// WAT") rather than being silently Nigerian. Dates without a time are left
// alone: a day needs no zone to be understood.
//
// The zone stays fixed rather than following the viewer on purpose — these
// formatters also build the server-side Telegram digests and admin strings,
// and a timestamp that means one thing in an email and another on screen is
// worse than one that is explicit about which clock it is on.

/** Format date — short (for orders, activity). Pass true for dateOnly (no time) */
export const fD = (d, dateOnly, lang) => { const dt = new Date(d), yr = dt.getFullYear() !== new Date().getFullYear(); const opts = { timeZone: TZ, month: "short", day: "numeric", ...(yr && { year: "numeric" }), ...(!dateOnly && { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) }; return dt.toLocaleDateString(dateLocale(lang), opts); };

/** Format time only — e.g. "08:33 WAT" */
export const fT = (d, lang) => new Date(d).toLocaleTimeString(dateLocale(lang), { timeZone: TZ, hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

/** Format date — with year (for blog, referrals) */
export const fDY = (d, lang) => new Date(d).toLocaleDateString(dateLocale(lang), { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });

/** WAT date boundaries for server-side queries (UTC+1) */
export function watBounds() {
  const now = new Date();
  const watNow = new Date(now.getTime() + 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth(), watNow.getUTCDate()) - 60 * 60 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdaySameTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(watNow.getUTCFullYear(), watNow.getUTCMonth(), 1) - 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { now, todayStart, yesterdayStart, yesterdaySameTime, monthStart, weekStart };
}

/** Format date — relative (for conversation lists) */
export const fRel = (d, lang, words = {}) => {
  const now = new Date(), dt = new Date(d);
  const watNow = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const watDt = new Date(dt.toLocaleString("en-US", { timeZone: TZ }));
  const startOfToday = new Date(watNow.getFullYear(), watNow.getMonth(), watNow.getDate());
  const diff = startOfToday - new Date(watDt.getFullYear(), watDt.getMonth(), watDt.getDate());
  const days = Math.round(diff / 86400000);
  if (days <= 0) return dt.toLocaleTimeString(dateLocale(lang), { timeZone: TZ, hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  // "Yesterday" and "2d ago" are words, not formatting, so Intl cannot supply
  // them. The caller passes translations; without them it reads English, which
  // is the same contract the rest of the translation layer keeps.
  if (days === 1) return words.yesterday || "Yesterday";
  if (days < 7) return words.daysAgo ? words.daysAgo(days) : `${days}d ago`;
  return dt.toLocaleDateString(dateLocale(lang), { timeZone: TZ, day: "numeric", month: "short", year: "2-digit" });
};
