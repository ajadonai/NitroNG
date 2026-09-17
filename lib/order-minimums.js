// Nitro's retail floors sit above a provider's technical minimum. They keep a
// first order meaningful while `effectiveOrderMinimum` always preserves a
// higher provider constraint and never creates an impossible range.
const FLOORS = Object.freeze({
  followers: 100,
  'podcast-followers': 100,
  likes: 100,
  views: 500,
  'shorts-views': 500,
  plays: 500,
  'podcast-plays': 500,
  comments: 10,
  'shorts-comments': 10,
  'verified-comments': 10,
  reviews: 10,
  engagement: 50,
  reposts: 50,
  reshares: 50,
  saves: 50,
  'channel-members': 100,
  'channel members': 100,
  'community-members': 100,
  'monthly-listeners': 1000,
  downloads: 100,
  traffic: 100,
});

export const DEFAULT_ORDER_MINIMUM = 50;

export function orderMinimumForType(type) {
  return FLOORS[String(type || '').trim().toLowerCase()] || DEFAULT_ORDER_MINIMUM;
}

export function effectiveOrderMinimum(type, providerMinimum, providerMaximum) {
  const min = Math.max(1, Number(providerMinimum) || 1, orderMinimumForType(type));
  const max = Number(providerMaximum);
  return Number.isFinite(max) && max > 0 ? Math.min(min, max) : min;
}
