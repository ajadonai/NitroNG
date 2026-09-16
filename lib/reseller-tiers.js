// The reseller ladder: what the rungs are, who is on which, and what a rung is
// actually worth on a given service.
//
// Kept apart from lib/markup because markup answers "what does this cost" and
// this answers "who is this person to us". The price path needs both and the
// nightly cron needs only this, so a cron that walks every reseller does not
// pull the bracket maths in behind it.
//
// Three numbers decide everything here, and they are settings rather than
// constants because Trip sets them:
//
//   reseller_tiers          the rungs — threshold and rate
//   reseller_band_caps      the most any tier may take off a given cost band
//   reseller_seat_lifetime  lifetime spend that makes the bottom rung permanent
//
// Spend is always **retail-equivalent**: what the orders would have cost at the
// site price. Counting the discounted charge would mean a promoted reseller
// measures slower the better it does, which is the kind of rule that looks fine
// until somebody is stuck one rung below where they earned.
import { DEFAULT_RESELLER_DISCOUNT } from './markup';

/**
 * The drawn ladder. Starter's threshold is the price of admission rather than a
 * floor of zero: below it a reseller is not a small reseller, they are a retail
 * customer with a badge, and the break-even maths says that is the one thing
 * this ladder must not create. A Wholesale reseller has to be worth 1.87 retail
 * customers before the discount pays for itself.
 */
export const DEFAULT_TIERS = [
  { id: 'T1', name: 'Starter',   threshold: 10000000,  pct: 10 },
  { id: 'T2', name: 'Trade',     threshold: 25000000,  pct: 15 },
  { id: 'T3', name: 'Bulk',      threshold: 50000000,  pct: 20 },
  { id: 'T4', name: 'Scale',     threshold: 100000000, pct: 25 },
  { id: 'T5', name: 'Wholesale', threshold: 200000000, pct: 30 },
];

/** Bands with no entry take their tier's own rate. Only Ultra binds at 30%. */
export const DEFAULT_BAND_CAPS = { Ultra: 22 };

/** Lifetime retail-equivalent spend that keeps the Starter seat for good. */
export const DEFAULT_SEAT_LIFETIME = 100000000;

// Number(null), Number(undefined ?? '') and Number('') are 0, 0 and 0 — so a
// naive Number() turns "not set" into "zero per cent", which reads as a valid
// rate and charges a reseller full retail. It shipped that way here for about
// ten minutes and the custom-rate test caught it.
const num = (v, fallback) => {
  if (v === null || v === undefined || String(v).trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * The ladder as configured, always sorted and always non-empty.
 *
 * A malformed setting falls back to the drawn ladder rather than to an empty
 * one: no tiers would mean every reseller silently drops to retail, which is a
 * pricing change nobody asked for arriving through a JSON parse error.
 */
export function tiersFrom(settings = {}) {
  let rows = DEFAULT_TIERS;
  try {
    const parsed = JSON.parse(settings.reseller_tiers);
    if (Array.isArray(parsed) && parsed.length) {
      rows = parsed
        .map((t, i) => ({
          id: String(t.id || `T${i + 1}`),
          name: String(t.name || `Tier ${i + 1}`),
          threshold: Math.max(0, num(t.threshold, 0)),
          pct: Math.min(99, Math.max(0, num(t.pct, 0))),
        }))
        .sort((a, b) => a.threshold - b.threshold);
    }
  } catch { /* the drawn ladder */ }
  return rows;
}

export function bandCapsFrom(settings = {}) {
  try {
    const parsed = JSON.parse(settings.reseller_band_caps);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out = {};
      for (const [band, v] of Object.entries(parsed)) {
        // An empty string is "no cap", which is not the same as a cap of zero —
        // zero would put every tier on retail for that band.
        if (v === null || v === undefined || String(v).trim() === '') continue;
        const n = num(v, null);
        if (n !== null && n >= 0 && n < 100) out[band] = n;
      }
      return out;
    }
  } catch { /* the drawn caps */ }
  return DEFAULT_BAND_CAPS;
}

export const seatLifetimeFrom = (settings = {}) =>
  Math.max(0, num(settings.reseller_seat_lifetime, DEFAULT_SEAT_LIFETIME));

export const tierById = (tiers, id) => tiers.find(t => t.id === id) || null;

/**
 * The tier a given rolling-30-day spend earns, or null for below the first rung.
 *
 * Null is a real answer and not an error: it means normal pricing. Everything
 * downstream has to handle it, because it is where a reseller who stopped
 * buying ends up.
 */
export function tierForSpend(tiers, spendKobo) {
  let earned = null;
  for (const t of tiers) if (spendKobo >= t.threshold) earned = t;
  return earned;
}

/**
 * What a tier is worth on one cost band, after the cap.
 *
 * The cap binds **every** tier, not only the top one. Capping only the top
 * inverts the ladder: Scale on 25% would pay less than Wholesale held at 22%,
 * so climbing a rung would put a reseller's prices up. That is the kind of
 * thing that ships and gets found by the person it overcharged.
 */
export function pctForBand(pct, bandLabel, caps) {
  const cap = caps?.[bandLabel];
  return cap === null || cap === undefined ? pct : Math.min(pct, cap);
}

/**
 * Does this profile's lifetime spend keep its seat?
 *
 * The seat, not the tier. A reseller who did the lifetime figure once and now
 * buys ₦20k a month keeps the bottom rung — which costs 10% of very little and
 * is a real reason to aim for the milestone. Keeping them on Wholesale would
 * cost actual money, so it does not.
 */
export const hasSeat = (lifetimeKobo, settings) => lifetimeKobo >= seatLifetimeFrom(settings);

/**
 * The rate a profile pays, and where it came from.
 *
 * `mode` is the admin's choice and it wins over the ladder in two of three
 * cases, so it is resolved here rather than in the price path — a price path
 * that has to know about pinning is a price path that will eventually disagree
 * with the page showing the pin.
 */
export function resolveRate(profile, settings) {
  const tiers = tiersFrom(settings);
  const mode = profile?.tierMode || 'auto';

  if (mode === 'custom') {
    const pct = num(profile?.discountPct, null);
    if (pct !== null && pct >= 0 && pct < 100) {
      return { mode: 'custom', tier: null, tierName: 'Custom', pct };
    }
    // A custom mode with no usable number is a half-finished edit, not a
    // licence to charge the global rate. Fall through to the ladder.
  }

  if (mode === 'pinned') {
    const t = tierById(tiers, profile?.pinnedTier);
    if (t) return { mode: 'pinned', tier: t.id, tierName: t.name, pct: t.pct };
  }

  const t = tierById(tiers, profile?.tier);
  if (t) return { mode: 'auto', tier: t.id, tierName: t.name, pct: t.pct };

  // On the ladder but on no rung: normal pricing. This is what a reseller who
  // dropped out looks like, and it must resolve to zero rather than to the
  // global discount, or dropping out would be free.
  return { mode: 'auto', tier: null, tierName: null, pct: 0 };
}

/**
 * The global rate, for accounts that predate the ladder.
 *
 * Only reached while `reseller_tiers_live` is off. Once the ladder is on, every
 * reseller has a tier or is on retail, and there is no third state.
 */
export const globalPct = (settings) => {
  const n = num(settings?.markup_reseller_discount, null);
  return n !== null && n >= 0 && n < 100 ? n : DEFAULT_RESELLER_DISCOUNT;
};

export const ladderLive = (settings) => String(settings?.reseller_tiers_live ?? '') === 'true';

/**
 * What the nightly evaluation should do with one profile.
 *
 * Pure: it takes the profile, the two spend figures and the settings, and
 * returns the decision. The cron does the writing. Every rule Trip set is in
 * this one function, which is the point — a ladder whose rules are spread
 * across a cron, a price path and an admin action is a ladder nobody can
 * answer questions about.
 *
 *   — Promotion is immediate. Cross a threshold and the next order is cheaper.
 *   — Demotion waits for month end. A slow fortnight never costs a rung.
 *   — Nobody is judged before their first full calendar month is up.
 *   — Below the first rung is normal pricing, not a smaller discount.
 *   — A seat earned on lifetime spend is never lost, but it holds the bottom
 *     rung only. Holding Wholesale for somebody who stopped buying would cost
 *     real money; holding Starter costs 10% of very little.
 *   — Pinned and custom are the admin's word and the ladder does not argue.
 */
export function evaluate(profile, spend, settings, now = new Date(), opts = {}) {
  const tiers = tiersFrom(settings);
  const mode = profile?.tierMode || 'auto';
  const current = profile?.tier ?? null;
  const seat = profile?.seatForLife || hasSeat(spend.lifetime, settings);
  const earnsSeat = !profile?.seatForLife && hasSeat(spend.lifetime, settings);

  if (mode !== 'auto') {
    // Still worth latching: a pinned reseller who crosses the lifetime figure
    // has earned the seat, and will want it the day the pin comes off.
    return { tier: current, changed: false, reason: null, seat: earnsSeat ? true : undefined, earnsSeat };
  }

  const earned = tierForSpend(tiers, spend.rolling);
  const rank = (id) => (id === null || id === undefined ? -1 : tiers.findIndex(t => t.id === id));
  const earnedId = earned?.id ?? (seat ? tiers[0].id : null);
  const from = rank(current), to = rank(earnedId);

  if (to > from) {
    return { tier: earnedId, changed: true, reason: current === null ? 'restored' : 'promoted', earnsSeat };
  }
  if (to < from) {
    // A reseller inside their first full month is left alone entirely.
    const protectedUntil = profile?.firstMonthEndsAt ? new Date(profile.firstMonthEndsAt) : null;
    if (protectedUntil && now < protectedUntil) {
      return { tier: current, changed: false, reason: null, earnsSeat };
    }
    if (!opts.monthEnd) return { tier: current, changed: false, reason: null, earnsSeat };
    return { tier: earnedId, changed: true, reason: earnedId === null ? 'dropped' : 'demoted', earnsSeat };
  }
  return { tier: current, changed: false, reason: null, earnsSeat };
}
