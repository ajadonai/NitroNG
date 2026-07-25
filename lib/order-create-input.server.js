import { cleanLink } from '@/lib/clean-link';
import { buildOrderOfferSnapshot } from '@/lib/order-offer-display';

// SERVER-ONLY API boundary. The .server.js suffix makes accidental client use
// visible without adding a runtime marker dependency; the rules stay pure so
// they can be imported directly by Vitest.

const NITRO_MINIMUM_QUANTITIES = Object.freeze({
  followers: 100,
  likes: 100,
  views: 500,
  comments: 10,
  engagement: 50,
  plays: 500,
  reviews: 10,
});

const DEFAULT_NITRO_MINIMUM = 50;
const LINK_GUIDE = ' Learn more: https://nitro.ng/blog/how-to-find-the-right-link';

const POST_PATTERNS = Object.freeze({
  instagram: /\/(p|reel|reels|tv|stories|share)\//i,
  tiktok: /\/(video|photo|v|t)\//i,
  'twitter/x': /\/(status|i\/status)\//i,
  youtube: /\/(watch|shorts|live)\b|youtu\.be\//i,
  facebook: /\/(posts|videos|watch|photos|photo|reel|share\/[rpv]|story\.php|permalink\.php)\b/i,
  threads: /\/post\//i,
  telegram: /\/\d+\s*$/,
  linkedin: /\/(posts|pulse|feed\/update)\//i,
  snapchat: /\/spotlight\//i,
  pinterest: /\/pin\//i,
  reddit: /\/comments\//i,
  twitch: /\/videos\//i,
  kick: /\/clips\//i,
  spotify: /\/(track|album|playlist|episode)\//i,
  bluesky: /\/post\//i,
  tumblr: /\/post\/\d/i,
  vimeo: /\/\d{5,}/,
  quora: /\/(answer|unanswered)\//i,
  deezer: /\/(track|album|playlist)\//i,
  tidal: /\/(track|album|playlist)\//i,
  audiomack: /\/(song|album|playlist)\//i,
  boomplay: /\/(songs|albums|playlists)\//i,
  applemusic: /\/(album|song|music-video)\//i,
  shazam: /\/(track|song)\//i,
});

const SHORT_POST_DOMAINS = Object.freeze({
  tiktok: /^(vt|vm)\.tiktok\.com$/i,
  'twitter/x': /^t\.co$/i,
  facebook: /^(fb\.watch|fb\.me)$/i,
  instagram: /^ig\.me$/i,
});

/**
 * @typedef {Object} CreateOrderInput
 * @property {string|undefined} tierId
 * @property {string|undefined} serviceId
 * @property {number|string} quantity
 * @property {string|undefined} comments
 * @property {number|undefined} rawDripDays
 * @property {boolean|undefined} confirmDuplicate
 * @property {boolean|undefined} redeemPoints
 * @property {string} link
 * @property {boolean} isUrl
 * @property {boolean} isUsername
 */

/**
 * Normalizes the public POST body and rejects malformed field types before
 * they can reach Prisma or provider-input string operations.
 *
 * @param {Object} body
 * @returns {{ ok: true, value: CreateOrderInput } | { ok: false, error: string }}
 */
export function parseCreateOrderInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' };
  }

  const {
    tierId,
    serviceId,
    link,
    quantity,
    comments,
    dripDays: rawDripDays,
    confirmDuplicate,
    redeemPoints,
  } = body;

  if (!link || !quantity) {
    return { ok: false, error: 'Link and quantity required' };
  }
  if (!tierId && !serviceId) {
    return { ok: false, error: 'Service or tier required' };
  }
  if (
    (tierId !== undefined && (typeof tierId !== 'string' || !tierId.trim()))
    || (serviceId !== undefined && (typeof serviceId !== 'string' || !serviceId.trim()))
  ) {
    return { ok: false, error: 'Invalid service or tier' };
  }
  if (typeof link !== 'string') {
    return { ok: false, error: 'Invalid link' };
  }
  const quantityIsNumber = typeof quantity === 'number' && Number.isFinite(quantity);
  const quantityIsNumericString = typeof quantity === 'string'
    && quantity.trim() !== ''
    && Number.isFinite(Number(quantity));
  if (!quantityIsNumber && !quantityIsNumericString) {
    return { ok: false, error: 'Invalid quantity' };
  }
  if (comments !== undefined && typeof comments !== 'string') {
    return { ok: false, error: 'Invalid comments' };
  }
  if (rawDripDays !== undefined && (typeof rawDripDays !== 'number' || !Number.isFinite(rawDripDays))) {
    return { ok: false, error: 'Invalid drip days' };
  }
  if (confirmDuplicate !== undefined && typeof confirmDuplicate !== 'boolean') {
    return { ok: false, error: 'Invalid duplicate confirmation' };
  }
  if (redeemPoints !== undefined && typeof redeemPoints !== 'boolean') {
    return { ok: false, error: 'Invalid points redemption option' };
  }

  const normalizedLink = cleanLink(link);
  if (normalizedLink.length < 5 || normalizedLink.length > 500) {
    return { ok: false, error: 'Invalid link' };
  }

  const isUrl = /^https?:\/\/.+\..+/.test(normalizedLink);
  const isUsername = /^@?[a-zA-Z0-9._]{1,100}$/.test(normalizedLink);
  if (!isUrl && !isUsername) {
    return { ok: false, error: 'Please enter a valid URL (https://...) or username' };
  }

  return {
    ok: true,
    value: {
      tierId,
      serviceId,
      link: normalizedLink,
      quantity,
      comments,
      rawDripDays,
      confirmDuplicate,
      redeemPoints,
      isUrl,
      isUsername,
    },
  };
}

/**
 * Calculates the undiscounted order amounts in kobo. The arithmetic and
 * whole-naira rounding intentionally match the existing order route.
 *
 * @param {{ tier?: Object|null, service: Object, quantity: *, usdRate: number }} input
 * @returns {{ ok: true, value: { qty: number, chargeKobo: number, costKobo: number, offerSnapshot: Object, tierName: string } } | { ok: false, error: string }}
 */
export function calculateCreateOrderPricing({ tier = null, service, quantity, usdRate }) {
  const qty = Math.floor(Number(quantity));
  if (!qty || Number.isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
    return { ok: false, error: 'Invalid quantity' };
  }

  const nitroMinimum = tier
    ? NITRO_MINIMUM_QUANTITIES[tier.group?.type?.toLowerCase()] || DEFAULT_NITRO_MINIMUM
    : null;
  const minimum = tier ? Math.max(service.min, nitroMinimum) : service.min;
  if (qty < minimum || qty > service.max) {
    return {
      ok: false,
      error: `Quantity must be between ${minimum.toLocaleString()} and ${service.max.toLocaleString()}`,
    };
  }

  const sellPer1k = tier ? tier.sellPer1k : service.sellPer1k;
  const chargeKobo = Math.ceil((Number(sellPer1k) / 1000) * qty / 100) * 100;
  const costKobo = Math.ceil((Number(service.costPer1k) * usdRate / 1000) * qty / 100) * 100;
  const offerSnapshot = buildOrderOfferSnapshot({ tier, service });
  const tierName = `${offerSnapshot.serviceNameAtPurchase}${offerSnapshot.tierNameAtPurchase ? ` (${offerSnapshot.tierNameAtPurchase})` : ''}`;

  if (!chargeKobo || chargeKobo <= 0) {
    return { ok: false, error: 'Service pricing not configured' };
  }

  return {
    ok: true,
    value: { qty, chargeKobo, costKobo, offerSnapshot, tierName },
  };
}

function profileExample(platform) {
  if (platform.includes('instagram')) return 'https://instagram.com/yourpage';
  if (platform.includes('tiktok')) return 'https://tiktok.com/@yourpage';
  if (platform.includes('twitter')) return 'https://x.com/yourhandle';
  if (platform.includes('youtube')) return 'https://youtube.com/@yourchannel';
  return 'your profile link';
}

function postExample(platform) {
  if (platform.includes('instagram')) return 'https://instagram.com/p/ABC123';
  if (platform.includes('tiktok')) return 'https://tiktok.com/@user/video/123456';
  if (platform.includes('twitter')) return 'https://x.com/user/status/123456';
  if (platform.includes('youtube')) return 'https://youtube.com/watch?v=ABC123';
  return 'a link to your post or video';
}

function isRecognizedPlatform(platform) {
  return Object.keys(POST_PATTERNS).some(name => platform.includes(name));
}

function isPostLinkForPlatform(link, platform) {
  let linkHost;
  try {
    linkHost = new URL(link).hostname;
  } catch {
    linkHost = '';
  }

  const isShortPostLink = Object.entries(SHORT_POST_DOMAINS).some(
    ([name, pattern]) => platform.includes(name) && pattern.test(linkHost)
  );
  return isShortPostLink || Object.entries(POST_PATTERNS).some(
    ([name, pattern]) => platform.includes(name) && pattern.test(link)
  );
}

/**
 * Validates link shape and provider-specific text inputs for a resolved offer.
 * The returned flags are the only offer inputs needed by provider dispatch.
 *
 * @param {{ tier?: Object|null, service: Object, link: string, isUrl: boolean, comments: * }} input
 * @returns {{ ok: true, value: { apiType: string, needsUsernames: boolean, needsAnswer: boolean, needsKeywords: boolean } } | { ok: false, error: string }}
 */
export function validateCreateOrderOfferInput({ tier = null, service, link, isUrl, comments }) {
  if (tier?.group?.type) {
    const groupType = tier.group.type.toLowerCase();
    const groupName = (tier.group.name || '').toLowerCase();
    const isMultiPost = /last\s+\d+\s*(tweet|post|video|reel|photo)/i.test(groupName);
    const needsProfile = groupType === 'followers' || isMultiPost;
    const needsPost = ['likes', 'views', 'comments', 'engagement', 'plays'].includes(groupType) && !isMultiPost;
    const platform = (service.category || '').toLowerCase();

    if (!isUrl && needsPost) {
      return {
        ok: false,
        error: `This service needs a link to your post or video, not a username.${LINK_GUIDE}`,
      };
    }

    if (isUrl) {
      const isPostLink = isPostLinkForPlatform(link, platform);
      const isProfileLink = !isPostLink;

      if (needsProfile && isPostLink) {
        return {
          ok: false,
          error: `This service needs a profile link, not a post link. Example: ${profileExample(platform)}.${LINK_GUIDE}`,
        };
      }

      if (needsPost && isProfileLink && isRecognizedPlatform(platform)) {
        return {
          ok: false,
          error: `This service needs a post/content link, not a profile link. Example: ${postExample(platform)}.${LINK_GUIDE}`,
        };
      }
    }
  }

  const apiType = (service.apiType || '').toLowerCase();
  const needsCommentText = apiType.includes('custom comment') || apiType.includes('comment replies');
  const needsUsernames = apiType.includes('mention');
  const needsAnswer = apiType === 'poll';
  const needsKeywords = apiType === 'seo';
  if ((needsCommentText || needsUsernames || needsAnswer || needsKeywords) && !comments?.trim()) {
    const label = needsKeywords ? 'Keywords are' : needsUsernames ? 'Usernames are' : needsAnswer ? 'An answer selection is' : 'Comments are';
    return { ok: false, error: `${label} required for this service` };
  }

  if (needsCommentText && comments) {
    const lineCount = comments.split('\n').filter(line => line.trim()).length;
    const minLines = Math.max(service.min, 10);
    if (lineCount < minLines) {
      return {
        ok: false,
        error: `Please provide at least ${minLines} unique comments (one per line). You entered ${lineCount}.`,
      };
    }
  }

  return {
    ok: true,
    value: { apiType, needsUsernames, needsAnswer, needsKeywords },
  };
}
