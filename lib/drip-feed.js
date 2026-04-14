// Drip-feed / gradual delivery calculator
// Spreads orders over time to appear organic and avoid account flagging
//
// Conservative platforms (Instagram, TikTok, Facebook, Twitter) get slower delivery
// Relaxed platforms (YouTube, Spotify, SoundCloud, web traffic) get faster delivery

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

const BATCH_SIZE = 50; // deliver ~50 per batch

/**
 * Calculate drip-feed params for an order
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

  // Find matching threshold
  const threshold = thresholds.find(t => quantity <= t.max);
  if (!threshold || threshold.spreadMinutes <= 0) return null; // instant

  // Calculate runs and interval
  // runs = total batches, interval = minutes between each batch
  const runs = Math.max(2, Math.ceil(quantity / BATCH_SIZE));
  const interval = Math.max(1, Math.round(threshold.spreadMinutes / runs));

  return { runs, interval };
}

export { CONSERVATIVE_PLATFORMS, CONSERVATIVE_THRESHOLDS, RELAXED_THRESHOLDS };
