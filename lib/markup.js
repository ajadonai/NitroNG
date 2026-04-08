// Nitro markup calculator — simple per-tier percentage
//
// MTP costs are stored in USD cents (rate * 100).
// We convert to NGN kobo using the exchange rate before applying markup.
//
// Markup percentages are stored in Settings DB:
//   markup_budget    = e.g. "150" (meaning 150% markup = 2.5x)
//   markup_standard  = e.g. "200" (meaning 200% markup = 3x)
//   markup_premium   = e.g. "250" (meaning 250% markup = 3.5x)
//   markup_default   = e.g. "200" (for services with no tier)
//   markup_min_margin = e.g. "50" (minimum margin floor %)
//   markup_usd_rate  = e.g. "1600" (NGN per $1)

const DEFAULT_USD_RATE = 1600;

// Defaults if not set in DB
const DEFAULTS = {
  Budget: 150,
  Standard: 200,
  Premium: 250,
  default: 200,
  minMargin: 50,
};

/**
 * Convert USD cents (costPer1k from MTP) to NGN kobo
 * @param {number} usdCents - cost in USD cents (rate * 100)
 * @param {number} usdRate - NGN per $1 (e.g. 1600)
 * @returns {number} cost in NGN kobo
 */
export function usdCentsToKobo(usdCents, usdRate = DEFAULT_USD_RATE) {
  // usdCents / 100 = USD -> * usdRate = NGN -> * 100 = kobo
  // Simplified: usdCents * usdRate
  return Math.round(usdCents * usdRate);
}

/**
 * Calculate sell price from cost in kobo using a markup percentage
 * @param {number} costKobo - cost in NGN kobo per 1K units
 * @param {number} markupPercent - e.g. 150 means cost x 2.5
 * @param {number} minMarginPercent - minimum margin floor, e.g. 50
 * @returns {number} sellPer1k in NGN kobo (rounded up)
 */
export function calculateMarkup(costKobo, markupPercent = 200, minMarginPercent = 50) {
  if (!costKobo || costKobo <= 0) return 0;

  let sellPrice = Math.ceil(costKobo * (1 + markupPercent / 100));

  // Enforce minimum margin floor
  const minSell = Math.ceil(costKobo * (1 + minMarginPercent / 100));
  if (sellPrice < minSell) sellPrice = minSell;

  return sellPrice;
}

/**
 * Get markup percentage for a tier name
 * @param {string} tier - "Budget", "Standard", "Premium", or null/undefined
 * @param {object} settings - markup settings from DB
 * @returns {{ markupPercent: number, minMargin: number, usdRate: number }}
 */
export function getMarkupForTier(tier, settings = {}) {
  const markupPercent = Number(
    tier === "Budget" ? (settings.markup_budget || DEFAULTS.Budget) :
    tier === "Standard" ? (settings.markup_standard || DEFAULTS.Standard) :
    tier === "Premium" ? (settings.markup_premium || DEFAULTS.Premium) :
    (settings.markup_default || DEFAULTS.default)
  );
  const minMargin = Number(settings.markup_min_margin || DEFAULTS.minMargin);
  const usdRate = Number(settings.markup_usd_rate || DEFAULT_USD_RATE);
  return { markupPercent, minMargin, usdRate };
}

/**
 * Calculate sell price for a specific tier
 * costPer1k in DB is USD cents (from MTP sync). This converts to NGN kobo first.
 * @param {number} costPer1k - cost in USD cents (from DB)
 * @param {string} tier - "Budget" | "Standard" | "Premium" | null
 * @param {object} settings - markup settings from DB
 * @returns {number} sellPer1k in NGN kobo
 */
export function calculateTierPrice(costPer1k, tier, settings = {}) {
  const { markupPercent, minMargin, usdRate } = getMarkupForTier(tier, settings);
  const costKobo = usdCentsToKobo(costPer1k, usdRate);
  return calculateMarkup(costKobo, markupPercent, minMargin);
}

/**
 * Format kobo to Naira string
 */
export function koboToNaira(kobo) {
  return `\u20A6${(kobo / 100).toLocaleString("en-NG")}`;
}

/**
 * Calculate margin percentage (both values must be in same unit)
 */
export function marginPercent(costUsdCents, sellKobo, usdRate = DEFAULT_USD_RATE) {
  const costKobo = usdCentsToKobo(costUsdCents, usdRate);
  if (!costKobo || costKobo <= 0) return 0;
  return Math.round(((sellKobo - costKobo) / costKobo) * 100);
}

export { DEFAULTS as MARKUP_DEFAULTS, DEFAULT_USD_RATE };
