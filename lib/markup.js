// Nitro markup calculator — simple per-tier percentage
// Cost and sell prices are in kobo (100 kobo = ₦1)
//
// Markup percentages are stored in Settings DB:
//   markup_budget    = e.g. "150" (meaning 150% markup = 2.5x)
//   markup_standard  = e.g. "200" (meaning 200% markup = 3x)
//   markup_premium   = e.g. "250" (meaning 250% markup = 3.5x)
//   markup_default   = e.g. "200" (for services with no tier)
//   markup_min_margin = e.g. "50" (minimum margin floor %)

// Defaults if not set in DB
const DEFAULTS = {
  Budget: 150,
  Standard: 200,
  Premium: 250,
  default: 200,
  minMargin: 50,
};

/**
 * Calculate sell price from cost using a markup percentage
 * @param {number} costPer1k - cost in kobo per 1K units
 * @param {number} markupPercent - e.g. 150 means cost × 2.5
 * @param {number} minMarginPercent - minimum margin floor, e.g. 50
 * @returns {number} sellPer1k in kobo (rounded up)
 */
export function calculateMarkup(costPer1k, markupPercent = 200, minMarginPercent = 50) {
  if (!costPer1k || costPer1k <= 0) return 0;

  let sellPrice = Math.ceil(costPer1k * (1 + markupPercent / 100));

  // Enforce minimum margin floor
  const minSell = Math.ceil(costPer1k * (1 + minMarginPercent / 100));
  if (sellPrice < minSell) sellPrice = minSell;

  return sellPrice;
}

/**
 * Get markup percentage for a tier name
 * @param {string} tier - "Budget", "Standard", "Premium", or null/undefined
 * @param {object} settings - { markup_budget, markup_standard, markup_premium, markup_default, markup_min_margin }
 * @returns {{ markupPercent: number, minMargin: number }}
 */
export function getMarkupForTier(tier, settings = {}) {
  const markupPercent = Number(
    tier === "Budget" ? (settings.markup_budget || DEFAULTS.Budget) :
    tier === "Standard" ? (settings.markup_standard || DEFAULTS.Standard) :
    tier === "Premium" ? (settings.markup_premium || DEFAULTS.Premium) :
    (settings.markup_default || DEFAULTS.default)
  );
  const minMargin = Number(settings.markup_min_margin || DEFAULTS.minMargin);
  return { markupPercent, minMargin };
}

/**
 * Calculate sell price for a specific tier
 * @param {number} costPer1k - cost in kobo
 * @param {string} tier - "Budget" | "Standard" | "Premium" | null
 * @param {object} settings - markup settings from DB
 * @returns {number} sellPer1k in kobo
 */
export function calculateTierPrice(costPer1k, tier, settings = {}) {
  const { markupPercent, minMargin } = getMarkupForTier(tier, settings);
  return calculateMarkup(costPer1k, markupPercent, minMargin);
}

/**
 * Format kobo to Naira string
 */
export function koboToNaira(kobo) {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

/**
 * Calculate margin percentage
 */
export function marginPercent(cost, sell) {
  if (!cost || cost <= 0) return 0;
  return Math.round(((sell - cost) / cost) * 100);
}

export { DEFAULTS as MARKUP_DEFAULTS };
