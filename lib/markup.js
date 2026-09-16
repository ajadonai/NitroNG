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
//   markup_reseller_discount = e.g. "20" (% off the finished price, resellers only)

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
 * Look up the per-provider bonus percentage from settings.
 * Settings key: markup_provider_bonus_{provider}  (e.g. markup_provider_bonus_mtp = "3")
 * @param {string} provider - "mtp" | "dao"
 * @param {object} settings - markup settings from DB
 * @returns {number} bonus percentage (e.g. 3 means +3%)
 */
export function getProviderBonus(provider, settings = {}) {
  return Number(settings[`markup_provider_bonus_${provider}`] || 0);
}

/**
 * Calculate sell price for a service tier using settings from DB
 * @param {number} costPer1k - raw cost from MTP (USD cents × 100, as stored in services.costPer1k)
 * @param {string} tier - "Budget" | "Standard" | "Premium"
 * @param {object} settings - markup settings from DB { markup_brackets, markup_margin_floor, etc }
 * @param {boolean} nigerian - whether this is a Nigerian service
 * @param {number} providerBonus - extra % to add for this provider (e.g. 3 = +3%)
 * @returns {number} sellPer1k in NGN kobo (same unit as serviceTier.sellPer1k)
 */
export function calculateTierPrice(costPer1k, tier, settings = {}, nigerian = false, providerBonus = 0) {
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

  // Apply per-provider bonus (e.g. pocket MTP volume discount)
  if (providerBonus > 0) {
    sell = Math.round(sell * (1 + providerBonus / 100));
  }

  // Apply Nigerian bonus
  if (nigerian && ngBonus > 0) {
    sell = Math.round(sell * (1 + ngBonus / 100));
  }

  // Round up to whole naira (nearest 100 kobo)
  sell = Math.ceil(sell / 100) * 100;

  return sell;
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
const DEFAULT_RESELLER_DISCOUNT = 20;

/**
 * Reseller price: a flat percentage off the finished retail price.
 *
 * Applied last, on top of everything else — brackets, tier multiplier, provider
 * bonus and the Nigerian bonus have all already run. That ordering is what makes
 * it safe: it can only ever remove this percentage of the price, so no service
 * can be pushed near or below cost. Taking a share of the *markup* instead would
 * eat almost the entire margin on thin-margin services.
 *
 * One setting covers both catalogues. A curated service arrives here with its
 * tier multiplier already applied, so resellers see the same tier structure the
 * dashboard shows; a full-catalogue service has no tier and arrives at the base
 * price. Both then take the same discount.
 */
// A discount is usable only if it is a real number in range. Anything else is
// ignored rather than trusted: a stray 150 or a negative would give the
// catalogue away, and Number('') is 0, so a blank field would silently mean
// "no discount" while a missing one meant "the default".
function usablePct(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : null;
}

/**
 * The least Nitro will sell a service for, whatever rate the reseller is on.
 *
 * A flat discount off retail does not mean a flat margin, because retail is not
 * a flat markup. The live brackets run 10x at the cheap end down to 1.5x on
 * Ultra, so the same 30% that leaves 85.7% margin on a Micro service leaves
 * 4.8% on an Ultra one — and 33.3% there sells at exactly what we paid.
 *
 * So the rate is a ceiling on the discount, not a promise about it. Margin is
 * the promise:
 *
 *   margin = (price - cost) / price >= floor   =>   price >= cost / (1 - floor)
 *
 * At a 10% floor that is cost / 0.9, so a service costing us ₦20,000 per 1k can
 * never be sold to a reseller under ₦22,223 no matter who asks or what their
 * tier says. Rounded up to the naira, which rounds in the floor's favour.
 *
 * This also closes the rate box on its own. It has always accepted anything
 * under 100%, so 40% could be typed in and saved; with the floor in the price
 * path rather than in the form, 40% simply stops biting at the point it would
 * start costing money.
 *
 * Cost is passed in **kobo, on the same basis as the price beside it** — per
 * 1k where the price is per 1k, and for the whole order where the price is for
 * the whole order. That is the one thing a caller has to get right, and it is
 * the reason this takes kobo rather than the USD cents the services table
 * stores: a per-1k floor compared against a 250-unit charge would clamp every
 * small order up to the price of a thousand.
 *
 * Returns null when there is no cost to measure against, which is the one case
 * where no floor can honestly be computed.
 */
export const RESELLER_MARGIN_FLOOR = 10;

export function resellerFloorKobo(costKobo, settings = {}) {
  const cost = Number(costKobo);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const floorPct = Number(settings.markup_reseller_margin_floor ?? RESELLER_MARGIN_FLOOR);
  // A floor of 100% or more has no finite price, and a negative one is not a
  // floor. Either way, fall back to the default rather than returning nonsense.
  const pct = Number.isFinite(floorPct) && floorPct >= 0 && floorPct < 100 ? floorPct : RESELLER_MARGIN_FLOOR;
  return Math.ceil(cost / (1 - pct / 100) / 100) * 100;
}

/** Per-1k cost in kobo from the USD cents the services table stores. */
export function costKoboPer1k(costPer1k, settings = {}) {
  const cost = Number(costPer1k);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return cost * Number(settings.markup_usd_rate || DEFAULT_USD_RATE);
}

/**
 * The most a rate is actually worth on one service before it breaks the floor.
 *
 * Reported rather than applied, so the admin drawer and the reseller docs can
 * say "30%, and 25.9% on the thinnest services" instead of printing a badge
 * that does not match what gets charged.
 */
export function effectiveResellerPct(retailKobo, costKobo, settings = {}, override = null) {
  const retail = Number(retailKobo);
  if (!retail || retail <= 0) return 0;
  const asked = usablePct(override)
    ?? usablePct(settings.markup_reseller_discount)
    ?? DEFAULT_RESELLER_DISCOUNT;
  const floor = resellerFloorKobo(costKobo, settings);
  if (floor === null) return asked;
  if (floor >= retail) return 0;
  return Math.min(asked, (1 - floor / retail) * 100);
}

/**
 * @param {number} retailPer1k finished retail price in kobo
 * @param {object} settings    markup_* settings
 * @param {number|null} override per-reseller rate; falls back to the global one
 * @param {number|null} costKobo provider cost in kobo, same basis as the price
 */
export function resellerPrice(retailPer1k, settings = {}, override = null, costKobo = null) {
  const price = Number(retailPer1k);
  if (!price || price <= 0) return 0;
  // The reseller's own rate wins when set, so a high-volume account can be
  // rewarded without turning every other reseller into a row to maintain.
  const pct = usablePct(override)
    ?? usablePct(settings.markup_reseller_discount)
    ?? DEFAULT_RESELLER_DISCOUNT;
  const discounted = Math.ceil((price * (1 - pct / 100)) / 100) * 100;

  // The floor never raises a price above retail. A service already priced under
  // its own floor is a retail pricing problem, and charging a reseller MORE than
  // a walk-in customer to fix it would be a strange way to solve it.
  const floor = resellerFloorKobo(costKobo, settings);
  if (floor === null) return discounted;
  return Math.min(price, Math.max(discounted, floor));
}

export function formatNaira(amount) {
  return `\u20A6${Number(amount).toLocaleString("en-NG")}`;
}

export { DEFAULT_BRACKETS, DEFAULT_USD_RATE, DEFAULT_TIER_MULTIPLIERS, DEFAULT_RESELLER_DISCOUNT };
