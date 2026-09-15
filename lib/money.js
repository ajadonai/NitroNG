/**
 * Naira, written down once.
 *
 * `naira()` was defined twenty-three times across the app and did not mean the
 * same thing twice. Eleven copies returned a formatted string and twelve
 * returned a plain number, under one name, in one codebase. That alone is worth
 * ending, but the reason it had to be done carefully is that the copies also
 * disagreed on the answer: `₦12,345.67` from the Telegram bot against
 * `₦12,346` from the outreach summary, for the same 1234567 kobo. Merging them
 * blind would have silently changed what every bot message prints.
 *
 * So the disagreement is a parameter now rather than a fork. Three functions,
 * because there are genuinely three jobs, and each call site says which one it
 * means instead of hiding the choice in a local copy:
 *
 *   koboToNaira(kobo)              → a number, for arithmetic and JSON
 *   formatKobo(kobo, { round })    → a ₦ string, from the unit we store
 *   formatNaira(naira, { round })  → a ₦ string, from a figure already in naira
 *
 * On rounding. `formatKobo` keeps the fraction by default because that is what
 * the money paths did and a customer reading ₦12,345.67 is being told the
 * truth. `formatNaira` rounds by default because a figure that is already in
 * naira has usually been divided down on purpose. Neither default is a
 * judgement about which is right — they preserve what each caller already did,
 * so this module changed no output anywhere on the day it landed.
 *
 * Locale is left to the runtime. Every variant that passed 'en-NG' produced
 * byte-identical output to the ones that passed nothing, for every integer
 * checked, so naming a locale here would add a promise without adding a
 * behaviour.
 *
 * Deliberately not folded in, because each is a different function wearing the
 * same name: pulse-dashboard's, which renders a true minus (U+2212) for
 * negatives; ify/outreach's, which returns an empty string for null rather than
 * ₦0; platform-card's and reseller-catalogue's, which take a second argument
 * entirely.
 */

const toNumber = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
};

/** Kobo to naira as a number, rounded. For arithmetic and API payloads. */
export function koboToNaira(kobo) {
  return Math.round(toNumber(kobo) / 100);
}

/**
 * Kobo to a ₦ string. Keeps the kobo fraction unless asked not to:
 * formatKobo(1234567) is "₦12,345.67", formatKobo(1234567, { round: true })
 * is "₦12,346".
 */
export function formatKobo(kobo, { round = false } = {}) {
  const naira = toNumber(kobo) / 100;
  return `₦${(round ? Math.round(naira) : naira).toLocaleString()}`;
}

/**
 * A figure already in naira to a ₦ string. Rounds by default, since a value
 * that has already been divided down is usually meant to read as whole naira.
 */
export function formatNaira(naira, { round = true } = {}) {
  const n = toNumber(naira);
  return `₦${(round ? Math.round(n) : n).toLocaleString()}`;
}
