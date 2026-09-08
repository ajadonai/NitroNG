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

// `active` is the selection gate for the picker. All five are on: the maths and
// the cross rates have always worked, and Trip has asked Flutterwave to enable
// cedi and shillings. Note what activation does and does not mean — a currency
// here is a unit prices are READ in. It is not a currency anyone can pay in:
// Flutterwave is still hardcoded to NGN and the only foreign rail is
// dollar-denominated USDT, so a deposit is charged in naira (or dollars) with
// the figure shown plainly beside the box. The bonus ladders are keyed to the
// customer's country, not to this, so nothing here decides what anyone is paid.
export const CURRENCIES = {
  NGN: { code: "NGN", symbol: "₦", name: "Naira", decimals: 0, active: true },
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, active: true },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2, active: true },
  GHS: { code: "GHS", symbol: "₵", name: "Ghanaian Cedi", decimals: 2, active: true },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", decimals: 0, active: true },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES);

/**
 * The currency a customer's market is priced and bonused in, from the country
 * on their account.
 *
 * Country rather than payment rail, because the rail was the wrong question:
 * it made a Nigerian paying USDT collect the dollar bonus ladder, and a US
 * customer collect the naira one if they ever paid another way. What ladder
 * you are on is about which market you are in, not which button you pressed.
 *
 * Safe to key on because country is set from the phone number at signup and
 * only an admin can change it — unlike the display switcher, which anyone can
 * flip, and which therefore must never decide what anyone is paid.
 */
export const CURRENCY_BY_COUNTRY = { NG: "NGN", US: "USD", GB: "GBP", GH: "GHS", KE: "KES" };

export function currencyForCountry(code) {
  return CURRENCY_BY_COUNTRY[code] || BASE_CURRENCY;
}

/**
 * Deposit quick-picks, per currency — NOT the naira ladder converted.
 *
 * ₦1,000 in dollars is $0.66, and ₦50,000 is $32.70. Nobody chooses $32.70.
 * A quick-pick only saves typing if it is a figure someone would have typed
 * anyway, so each currency gets round numbers of its own and the naira charged
 * is worked out from what they tap. The ladders are pitched to cover roughly
 * the same ground in real terms: the cedi and shilling ones start higher
 * because ₵1 and KSh 1 are small units, and starting at 1 would put the first
 * two buttons under the ₦1,000 minimum where they would simply fail.
 */
export const DEPOSIT_PRESETS = {
  NGN: [1000, 2000, 5000, 10000, 20000, 50000],
  USD: [1, 5, 10, 25, 50, 100],
  GBP: [1, 5, 10, 25, 50, 100],
  GHS: [10, 25, 50, 100, 250, 500],
  KES: [100, 500, 1000, 2500, 5000, 10000],
};

/** The gateway's own limits, in naira — mirrored from
 *  app/api/payments/initialize/route.js, where they are enforced. */
export const MIN_DEPOSIT_NAIRA = 1000;
export const MAX_DEPOSIT_NAIRA = 10_000_000;

export function depositPresets(code) {
  return DEPOSIT_PRESETS[code] || DEPOSIT_PRESETS[BASE_CURRENCY];
}

/** Can a customer choose this currency today? Separate from isSupported,
 *  which asks only "does this module know how to convert it". */
export function isActive(code) {
  return isSupported(code) && CURRENCIES[code].active === true;
}

/**
 * Active AND actually convertible right now.
 *
 * Turning a currency on is one boolean above, but the maths still needs a rate:
 * naira needs none, dollars need the deposit rate, and the rest need a cross
 * rate the FX cron writes. Without this check, flipping `active` while a rate
 * was missing would put the currency in the menu and then quietly render every
 * price in naira — the switch would look broken rather than unavailable. The
 * picker asks this, so a currency can never be offered unless choosing it
 * actually changes what you see.
 */
export function canDisplay(code, rates = {}) {
  if (!isActive(code)) return false;
  if (code === BASE_CURRENCY) return true;
  return convertFromNaira(1000, { ...rates, code }) !== null;
}
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
 * The chosen currency → naira, at the same deposit rate. The exact inverse of
 * convertFromNaira, for the one place a customer types a figure instead of
 * reading one: the deposit field. They enter what they want to add in the unit
 * on screen, this says what will actually leave their account, and that naira
 * figure is what gets charged and shown beside it.
 *
 * Ceils to whole naira, like every other charge on the site.
 */
export function convertToNaira(amount, { code, depositRate, usdRates } = {}) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  if (!isSupported(code)) return null;
  if (code === BASE_CURRENCY) return Math.ceil(value);

  const rate = Number(depositRate);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  let usd = value;
  if (code !== "USD") {
    const perUsd = Number(usdRates?.[code]);
    if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
    usd = value / perUsd;
  }
  return Math.ceil(usd * rate);
}

/**
 * How many naira one unit of a currency credits, at the deposit rate.
 *
 * The single number the bonus ladders need: a deposit's own figure comes back
 * out of the kobo by dividing by this, and a bonus in that currency converts to
 * naira by multiplying. Null when a rate is missing, which callers read as
 * "fall back to naira" rather than as zero.
 */
export function nairaPerUnit(code, { depositRate, usdRates } = {}) {
  if (code === BASE_CURRENCY) return 1;
  const rate = Number(depositRate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (code === "USD") return rate;
  const perUsd = Number(usdRates?.[code]);
  if (!Number.isFinite(perUsd) || perUsd <= 0) return null;
  return rate / perUsd;
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

/**
 * Rounding has a direction here, and it is not "nearest".
 *
 * The catalogue ceils to whole naira and every order step ceils again, because
 * a price quoted below the real charge got customers refused with "insufficient
 * balance" for an order the screen said they could afford (see the note in
 * lib/order-form-core.js). The display layer keeps the same discipline, and a
 * balance is that rule seen from the other side:
 *
 *     a price   rounds UP   — never quote less than what will be charged
 *     a balance rounds DOWN — never show more money than someone holds
 *
 * Together they give the invariant the rule exists for: if the balance on
 * screen covers the price on screen, the real balance covers the real charge.
 * "Up" is the default because most figures on the site are prices.
 *
 * Rounding is by magnitude, so a debit line rounds away from zero too — what is
 * owed is never understated.
 */
function roundMagnitude(abs, decimals, direction) {
  const f = 10 ** decimals;
  const scaled = abs * f;
  const nearest = Math.round(scaled);
  // Float dust only: 1.63 arriving as 1.6299999999 must not ceil to 1.64.
  if (Math.abs(scaled - nearest) < 1e-9) return nearest / f;
  return (direction === "down" ? Math.floor(scaled) : Math.ceil(scaled)) / f;
}

/** `₦12,500` or `$9.81` — the number with its symbol, no approximation marker.
 *  Pass `{ round: "down" }` for money someone holds. */
export function formatMoney(amount, code = BASE_CURRENCY, { round = "up" } = {}) {
  const meta = CURRENCIES[code];
  if (!meta || !Number.isFinite(Number(amount))) return "";
  const n = Number(amount);
  const body = roundMagnitude(Math.abs(n), meta.decimals, round).toLocaleString("en-US", {
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
  const round = opts.round === "down" ? "down" : "up";
  if (code === BASE_CURRENCY) return formatMoney(naira, BASE_CURRENCY, { round });
  const converted = convertFromNaira(naira, { ...opts, code });
  if (converted === null) return formatMoney(naira, BASE_CURRENCY, { round });
  return `≈ ${formatMoney(converted, code, { round })}`;
}
