// Nitro markup calculator — bracket-based pricing
//
// Services are assigned to a bracket based on their cost.
// Cheap services get higher multipliers, expensive services get lower ones.
//
// Settings stored in DB (Settings table, key/value):
//   markup_brackets     = JSON array of { min, max, multiplier, label }
//   markup_margin_floor = e.g. "50" (minimum margin %, only under ceiling)
//   markup_floor_ceiling = e.g. "5000" (floor only applies below this cost)
//   markup_ng_bonus     = e.g. "25" (extra % on Nigerian services)
//   markup_usd_rate     = e.g. "1600" (NGN per $1)

const DEFAULT_BRACKETS = [
  { min: 0, max: 20, multiplier: 3, label: "Micro" },
  { min: 20, max: 200, multiplier: 2.5, label: "Low" },
  { min: 200, max: 1000, multiplier: 2, label: "Mid" },
  { min: 1000, max: 5000, multiplier: 1.7, label: "High" },
  { min: 5000, max: 20000, multiplier: 1.5, label: "Premium" },
  { min: 20000, max: 999999999, multiplier: 1.35, label: "Ultra" },
];

const DEFAULT_USD_RATE = 1600;

/**
 * Parse brackets from settings, with null safety
 */
function parseBrackets(settings) {
  try {
    if (settings.markup_brackets) {
      const parsed = JSON.parse(settings.markup_brackets);
      return parsed.map(b => ({ ...b, max: b.max == null ? 999999999 : b.max }));
    }
  } catch {}
  return DEFAULT_BRACKETS;
}

/**
 * Calculate sell price using bracket system
 * @param {number} costPer1k - cost in NGN per 1K (already converted from USD)
 * @param {object[]} brackets - array of { min, max, multiplier }
 * @param {number} floorPct - minimum margin % (e.g. 50)
 * @param {number} floorCeiling - floor only applies under this cost
 * @returns {number} sell price per 1K in NGN
 */
export function calcSellPrice(costPer1k, brackets, floorPct = 50, floorCeiling = 5000) {
  if (!costPer1k || costPer1k <= 0) return 0;
  if (!brackets || !brackets.length) brackets = DEFAULT_BRACKETS;
  const bracket = brackets.find(b => costPer1k >= b.min && costPer1k < b.max) || brackets[brackets.length - 1];
  let sell = Math.round(costPer1k * bracket.multiplier);

  // Apply margin floor only under ceiling — clamp to 99% to prevent division by zero
  const clampedFloor = Math.min(floorPct, 99);
  if (costPer1k < floorCeiling && clampedFloor > 0) {
    const minSell = Math.round(costPer1k / (1 - clampedFloor / 100));
    if (sell < minSell) sell = minSell;
  }

  return sell;
}

const DEFAULT_TIER_MULTIPLIERS = { Budget: 1.0, Standard: 1.15, Premium: 1.35 };

/**
 * Calculate sell price for a service tier using settings from DB
 * @param {number} costPer1k - raw cost from MTP (USD cents × 100, as stored in services.costPer1k)
 * @param {string} tier - "Budget" | "Standard" | "Premium"
 * @param {object} settings - markup settings from DB { markup_brackets, markup_margin_floor, etc }
 * @param {boolean} nigerian - whether this is a Nigerian service
 * @returns {number} sellPer1k in NGN kobo (same unit as serviceTier.sellPer1k)
 */
export function calculateTierPrice(costPer1k, tier, settings = {}, nigerian = false) {
  if (!costPer1k || costPer1k <= 0) return 0;

  const usdRate = Number(settings.markup_usd_rate || DEFAULT_USD_RATE);
  const brackets = parseBrackets(settings);
  const floorPct = Number(settings.markup_margin_floor || 50);
  const floorCeiling = Number(settings.markup_floor_ceiling || 5000);
  const ngBonus = Number(settings.markup_ng_bonus || 25);

  // Per-tier multipliers — Budget is base, Standard/Premium are higher
  const tierMults = parseTierMultipliers(settings);
  const tierMult = tierMults[tier] || tierMults.Standard || 1.15;

  // Convert USD cents to NGN kobo: (usdCents / 100) * usdRate * 100 = usdCents * usdRate
  const costKobo = Math.round(costPer1k * usdRate);

  // Convert brackets from NGN display values to kobo for comparison
  const koboBrackets = brackets.map(b => ({
    ...b,
    min: b.min * 100,
    max: b.max >= 999999999 ? 999999999999 : b.max * 100,
  }));

  let sell = calcSellPrice(costKobo, koboBrackets, floorPct, floorCeiling * 100);

  // Apply tier multiplier
  sell = Math.round(sell * tierMult);

  // Apply Nigerian bonus
  if (nigerian && ngBonus > 0) {
    sell = Math.round(sell * (1 + ngBonus / 100));
  }

  // Cap at PostgreSQL INT4 max
  return Math.min(sell, 2147483647);
}

/**
 * Parse tier multipliers from settings, with fallback
 */
function parseTierMultipliers(settings) {
  try {
    if (settings.markup_tier_multipliers) {
      return JSON.parse(settings.markup_tier_multipliers);
    }
  } catch {}
  return DEFAULT_TIER_MULTIPLIERS;
}

/**
 * Format to Naira string
 */
export function formatNaira(amount) {
  return `\u20A6${Number(amount).toLocaleString("en-NG")}`;
}

export { DEFAULT_BRACKETS, DEFAULT_USD_RATE, DEFAULT_TIER_MULTIPLIERS };
