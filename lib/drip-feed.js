// Drip-feed / gradual delivery calculator
// Uses the provider's native runs+interval API to spread delivery over time.
// runs = how many times to repeat, interval = minutes between each run.
// Provider delivers (quantity / runs) per run, so total = quantity.
//
// Only applies to services with dripfeed=true from the provider.

const CONSERVATIVE_PLATFORMS = [
  'instagram', 'tiktok', 'facebook', 'twitter', 'twitter/x', 'snapchat', 'threads',
];

const CONSERVATIVE_THRESHOLDS = [
  { max: 100, spreadMinutes: 0 },          // instant
  { max: 500, spreadMinutes: 60 },          // 1 hour
  { max: 2000, spreadMinutes: 240 },        // 4 hours
  { max: 5000, spreadMinutes: 720 },        // 12 hours
  { max: Infinity, spreadMinutes: 1440 },   // 24 hours
];

const RELAXED_THRESHOLDS = [
  { max: 500, spreadMinutes: 0 },           // instant
  { max: 2000, spreadMinutes: 60 },         // 1 hour
  { max: 10000, spreadMinutes: 360 },       // 6 hours
  { max: Infinity, spreadMinutes: 720 },    // 12 hours
];

/**
 * Calculate drip-feed params for an order.
 * Returns { runs, interval } where:
 *   - runs = number of times to repeat the order
 *   - interval = minutes between each run
 *   - The provider receives quantity/runs per run, totalling the full quantity.
 *
 * @param {string} platform - e.g. 'instagram', 'youtube'
 * @param {number} quantity - total quantity ordered
 * @param {object} [customThresholds] - optional override from admin settings
 * @returns {{ runs: number, interval: number } | null} - null means instant delivery
 */
export function calculateDripFeed(platform, quantity, customThresholds = null) {
  if (!quantity || quantity <= 0) return null;

  const platformLower = (platform || '').toLowerCase();
  const isConservative = CONSERVATIVE_PLATFORMS.some(p => platformLower.includes(p));
  const thresholds = customThresholds || (isConservative ? CONSERVATIVE_THRESHOLDS : RELAXED_THRESHOLDS);

  const threshold = thresholds.find(t => quantity <= t.max);
  if (!threshold || threshold.spreadMinutes <= 0) return null;

  // Target ~50-200 per run, capped at 10 runs to keep it reasonable
  const targetPerRun = Math.max(50, Math.min(200, Math.ceil(quantity / 10)));
  const runs = Math.max(2, Math.min(10, Math.ceil(quantity / targetPerRun)));
  const interval = Math.max(1, Math.round(threshold.spreadMinutes / runs));

  return { runs, interval };
}

export { CONSERVATIVE_PLATFORMS, CONSERVATIVE_THRESHOLDS, RELAXED_THRESHOLDS };
