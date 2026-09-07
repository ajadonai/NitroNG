/**
 * Display currency.
 *
 * One model, end to end: every deposit lands in the wallet as naira, whatever
 * it was paid in, and every price is a naira price. A foreign currency on
 * screen is that naira read in another unit — nothing more. Switching the
 * unit changes no value; the wallet, the catalogue and the ledger stay naira.
 *
 * The single number that matters is the DEPOSIT RATE: how many naira one
 * dollar credits. It is the rate the crypto rail actually credits at, and the
 * rate display converts at, read from one setting so the two can never
 * disagree. What you see is what you pay because they are the same division
 * run in opposite directions:
 *
 *     credited naira = dollars  × depositRate
 *     shown dollars  = naira    ÷ depositRate
 *
 * A premium for foreign payers, when Nitro chooses to charge one, is nothing
 * more than setting the deposit rate below mid-market. With the market at
 * ₦1,329, a deposit rate of ₦1,107 means $100 credits ₦110,750 instead of
 * ₦132,900, and an item at ₦2,490 shows as $2.25 instead of $1.87. There is
 * no percentage in the arithmetic; the percentage is an admin convenience,
 * derived from the two rates for display, never used in a calculation.
 *
 * Do NOT reach for `markup_usd_rate` or `markup_usd_market` here. Both are
 * cost-side inputs: market is the official mid-market from the daily cron, and
 * rate is market plus a cushion for turning provider dollar costs into naira
 * sell prices. The crypto rail once borrowed the cushioned one by accident,
 * which is exactly how deposit and display drift apart. The deposit rate is
 * its own setting, chosen on purpose.
 *
 * Naira never converts. Nigerians pay naira prices exactly, and a Nigerian who
 * flips the site to dollars is reading the same naira in another unit.
 */

export const CURRENCIES = {
  NGN: { code: "NGN", symbol: "₦", name: "Naira", decimals: 0 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", decimals: 2 },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", decimals: 0 },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);
export const BASE_CURRENCY = "NGN";

/** Only used when no deposit rate has ever been set. Matches what the crypto
 *  rail credited at when this module was written, so nothing moves on day one. */
export const FALLBACK_DEPOSIT_RATE = 1529;

export function isSupported(code) {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code);
}

/**
 * Naira → the chosen currency, at the deposit rate.
 *
 * Returns a number, or null when a rate needed is missing. Null means "we do
 * not know", and every caller must fall back to showing naira rather than
 * inventing a figure — a wrong price on a money app is worse than an
 * unconverted one.
 */
export function convertFromNaira(naira, { code, depositRate, usdRates } = {}) {
  const amount = Number(naira);
  if (!Number.isFinite(amount)) return null;
  if (!isSupported(code)) return null;
  if (code === BASE_CURRENCY) return amount;

  const rate = Number(depositRate);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const usd = amount / rate;
  if (code === "USD") return usd;

  const perUsd = Number(usdRates?.[code]);
  if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
  return usd * perUsd;
}

/**
 * Dollars deposited → naira credited. The exact inverse of convertFromNaira,
 * kept beside it so the two cannot be edited apart. This is what the crypto
 * invoice and the Add Funds line use.
 */
export function creditForDollars(usd, depositRate) {
  const dollars = Number(usd);
  const rate = Number(depositRate);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return dollars * rate;
}

/**
 * Market rate and a premium % → the deposit rate. This is how the setting is
 * stored: a percentage keeps its meaning as the naira moves, whereas a flat
 * ₦200 silently shrinks as a share of the rate whenever the naira weakens.
 * At ₦1,324 to the dollar, 15% is a deposit rate of ₦1,151, about ₦173 below
 * market; the old flat ₦200 cushion works out to roughly 18% today and would
 * be a different percentage tomorrow.
 */
export function depositRateForPremium(marketRate, premiumPercent) {
  const m = Number(marketRate), p = Number(premiumPercent);
  if (!Number.isFinite(m) || m <= 0) return null;
  if (!Number.isFinite(p) || p <= -100) return null;
  return m / (1 + p / 100);
}

/**
 * The premium as a percentage over mid-market, for the admin screen only.
 * Positive means foreign payers get fewer naira per dollar than the market
 * gives; zero means the deposit rate is at market; negative means Nitro is
 * crediting above market. Never fed back into a price.
 */
export function impliedPremiumPercent(depositRate, marketRate) {
  const d = Number(depositRate), m = Number(marketRate);
  if (!Number.isFinite(d) || !Number.isFinite(m) || d <= 0 || m <= 0) return null;
  return (m / d - 1) * 100;
}

/** `₦12,500` or `$9.81` — the number with its symbol, no approximation marker. */
export function formatMoney(amount, code = BASE_CURRENCY) {
  const meta = CURRENCIES[code];
  if (!meta || !Number.isFinite(Number(amount))) return "";
  const n = Number(amount);
  const body = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  return `${n < 0 ? "-" : ""}${meta.symbol}${body}`;
}

/**
 * What goes on screen. Naira is exact and prints bare. Every other currency
 * prints with "≈", because the figure moves with the deposit rate and the
 * customer is charged in naira — the marker is the honest part. Falls back to
 * naira whenever the conversion is unavailable.
 */
export function formatDisplayPrice(naira, opts = {}) {
  const code = opts.code || BASE_CURRENCY;
  if (code === BASE_CURRENCY) return formatMoney(naira, BASE_CURRENCY);
  const converted = convertFromNaira(naira, { ...opts, code });
  if (converted === null) return formatMoney(naira, BASE_CURRENCY);
  return `≈ ${formatMoney(converted, code)}`;
}
