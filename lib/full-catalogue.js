// The full list: every listed, priced provider service that is not already a
// curated tier. One definition, read by the reseller catalogue and by the
// customer-facing New Order "Full list" view, so the two can never disagree
// about what the full catalogue is.
//
// Nitro's services table holds the whole upstream catalogue — 17,780 rows on
// 14 Sep 2026 — of which 325 are switched on as the curated set. The rest are
// imported, priced by the markup brackets and refreshed daily, but hidden.
// This is how they are shown: labelled by Nitro (never the provider's name),
// priced at retail, and framed as the provider's own terms.

import { formatResellerService, serviceAttributes } from '@/lib/reseller-format';
import { detectPlatform } from '@/lib/public-service-label';

export const FULL_WHERE = {
  provider: { in: ['mtp', 'dao'] },
  providerListedAt: { not: null },
  costPer1k: { gt: 0 },
  tiers: { none: {} },
  resellerMap: { isNot: null },
};

// Provider categories are messy — "Twitter/X", "OnlyFans" and "Onlyfans",
// "Bluesky" and "BlueSky" — and about eighty of the 113 are not platforms at
// all ("Vip", "Cheapest", "🔵"). The customer list is keyed by the platform
// tiles New Order already has, so each tile owns the categories that mean it
// and the junk never surfaces.
const PLATFORM_CATEGORIES = {
  instagram: ['Instagram'], tiktok: ['TikTok'], youtube: ['YouTube'], facebook: ['Facebook'],
  twitter: ['Twitter/X'], telegram: ['Telegram'], threads: ['Threads'], snapchat: ['Snapchat'],
  linkedin: ['LinkedIn'], pinterest: ['Pinterest'], reddit: ['Reddit'], discord: ['Discord'],
  whatsapp: ['WhatsApp'], twitch: ['Twitch'], kick: ['Kick'], quora: ['Quora'],
  onlyfans: ['OnlyFans', 'Onlyfans'], kwai: ['Kwai'], vimeo: ['Vimeo'], bluesky: ['Bluesky', 'BlueSky'],
  spotify: ['Spotify'], audiomack: ['Audiomack'], boomplay: ['Boomplay'], applemusic: ['Apple Music'],
  soundcloud: ['SoundCloud'], deezer: ['Deezer'], google: ['Google'], trustpilot: ['Trustpilot'],
  // No provider category today. Listed so the map is the whole tile set and a
  // lookup for these returns an empty list rather than undefined.
  tumblr: [], clubhouse: [], tidal: [], shazam: [], mixcloud: [],
  webtraffic: [], appstore: [], playstore: [],
};

export function categoriesForPlatform(platformId) {
  return PLATFORM_CATEGORIES[String(platformId || '').toLowerCase()] || [];
}

// What detectPlatform calls a platform, mapped to the tile that sells it.
const PLATFORM_BY_LABEL = {
  Instagram: 'instagram', TikTok: 'tiktok', YouTube: 'youtube', Facebook: 'facebook',
  X: 'twitter', Telegram: 'telegram', Spotify: 'spotify', Snapchat: 'snapchat',
  LinkedIn: 'linkedin', Pinterest: 'pinterest', Twitch: 'twitch', Discord: 'discord',
  Threads: 'threads', Audiomack: 'audiomack', Boomplay: 'boomplay',
  'Apple Music': 'applemusic', WhatsApp: 'whatsapp', SoundCloud: 'soundcloud',
  Reddit: 'reddit', Quora: 'quora', Kick: 'kick', Bluesky: 'bluesky',
  Tumblr: 'tumblr', Vimeo: 'vimeo', Deezer: 'deezer', Tidal: 'tidal', Shazam: 'shazam',
};
const CATEGORY_TO_PLATFORM = Object.fromEntries(
  Object.entries(PLATFORM_CATEGORIES).flatMap(([id, cats]) => cats.map(c => [c, id])),
);

/**
 * Which tile a service belongs to. The name decides, and the provider's own
 * category is only the fallback.
 *
 * That order is the whole point. 2,655 live services sit under "Other", "Vip",
 * "Cheapest", "Private" and a blue circle emoji across both providers — DAO's
 * "Instagram Followers [HQ Profiles] [Instant Start] [Low Drop] 100K/Day" is
 * filed under "Other" — and keying on the category made every one of them
 * unreachable however plainly its name said Instagram.
 */
// Two tiles Nitro sells that the storefront cleaner has no pattern for, so
// they are detected here rather than by widening a lib the whole storefront
// reads. Without these, "Google Custom Reviews" filed under a blue-circle
// category reaches no tile at all.
const EXTRA_PLATFORM_PATTERNS = [
  ['google', /\bgoogle\b/i],
  ['trustpilot', /\btrust\s*pilot\b/i],
];

export function platformOf(name, category) {
  const byName = PLATFORM_BY_LABEL[detectPlatform(name)];
  if (byName) return byName;
  const extra = EXTRA_PLATFORM_PATTERNS.find(([, re]) => re.test(String(name || '')));
  if (extra) return extra[0];
  return CATEGORY_TO_PLATFORM[String(category || '')] || null;
}

export function isKnownPlatform(platformId) {
  return Object.hasOwn(PLATFORM_CATEGORIES, String(platformId || '').toLowerCase());
}

// Providers send 2,147,483,647 — a signed 32-bit ceiling — to mean "no limit",
// and 100M+ to mean the same thing in practice. Neither is a number a customer
// should be asked to read as a maximum.
export const MAX_UNLIMITED = 100_000_000;
export function isUnlimited(max) {
  return Number(max) >= MAX_UNLIMITED;
}

/**
 * The type row on the full list — the thing a customer actually came for.
 * Provider names do not carry a type field, so it is read off the Nitro label,
 * which is the only text the customer sees anyway: a row and its group can
 * never disagree. Order matters — "Comment likes" is a like, not a comment,
 * so likes would have to be tested first if it read the other way; instead
 * each rule is written to claim only what it owns.
 */
export const TYPES = ['followers', 'members', 'likes', 'views', 'comments', 'shares', 'engagement'];
export const TYPE_LABELS = {
  followers: 'Followers', members: 'Members', likes: 'Likes', views: 'Views',
  comments: 'Comments', shares: 'Shares', engagement: 'Engagement',
};

export function typeOf(label) {
  const l = String(label || '').toLowerCase();
  // Members and joins: channel and group membership. The most specific word in
  // the catalogue and it never means anything else. 472 services — Telegram
  // channels and groups, Facebook groups, Instagram broadcast channels — used
  // to file under followers, where someone shopping for profile followers met
  // a product that needs a channel link instead.
  if (/\bmembers?\b|\bgroup\s+join|\bjoin\s+group/.test(l)) return 'members';
  // A like on a comment is a like. Tested before both so it cannot be claimed
  // by the word it happens to sit beside.
  if (/\bcomments?\s+(likes?|reacts?|reactions?)\b/.test(l)) return 'likes';
  // "Follow" as often as "Followers": Deezer artist follows, Quora and Spotify
  // page follows, LinkedIn connects and Facebook friend requests are all the
  // same ask, and every one of them used to land in the catch-all.
  if (/\bfollow|\bsubscrib|\bconnects?\b|\bconnection|\bfriends?\s+request/.test(l)) return 'followers';
  // Before comments, so a combo like "Live Stream Views + Likes + Comments"
  // files under what it mostly delivers rather than its last word.
  if (/\bviews?\b|\bimpression|\breach\b|\bwatch|\bplays?\b|\bplayback|\blisten|\bstream|\bvisits?\b/.test(l)) return 'views';
  // A star rating is a review with no words in it.
  if (/\bcomments?\b|\breview|\brating|\bstars?\b|\brepl(y|ies)\b/.test(l)) return 'comments';
  // Shares, reposts, retweets, quote posts and Audiomack re-ups are one action
  // under five platform names. Reposts used to file as likes and retweets as
  // engagement, so the same product sat in two places depending on which
  // network happened to have written it.
  if (/\bshar|reshar|\brepost|\bretweet|\bquote|\bre-?up\b/.test(l)) return 'shares';
  // "votes?\b" without a leading boundary, so upvotes and downvotes count —
  // every Reddit and Quora vote service was in the catch-all because of it.
  if (/\blikes?\b|\breact|\bfavou?rite|\bsaves?\b|\bbookmark|votes?\b|\bplaylist/.test(l)) return 'likes';
  return 'engagement';
}

/**
 * What a listing promises about drops, and whether that promise is a refill.
 *
 * One source for both the badge and the "Refill only" filter, because they used
 * to have two: the badge read the name and the filter read `service.refill`, so
 * #9364 showed "No refill" and still survived a filter for refills.
 *
 * The name wins. Only 2-4% of live services carry the provider's refill flag —
 * that column is whether the API supports a refill *action*, not what the
 * listing promises — so it is the fallback, used only when the name says
 * nothing at all.
 *
 * Non-drop is not a refill. It promises the numbers should not fall, not that
 * they will be replaced if they do, and someone filtering for a refill is
 * asking for the replacement.
 */
export function refillOf(name, category, providerFlag) {
  const attr = serviceAttributes(name, category).find(a => /refill|guarantee|non-?drop/i.test(a));
  if (!attr) return { refill: !!providerFlag, refillLabel: null };
  if (/^no refill$/i.test(attr)) return { refill: false, refillLabel: attr };
  if (/non-?drop/i.test(attr)) return { refill: false, refillLabel: attr };
  return { refill: true, refillLabel: attr };
}

/**
 * A package priced per item, not per 1,000 — "5 verified comments", "20 votes".
 * The full list quotes everything per 1K, so these would read as a price nobody
 * is being charged. Nitro sells the ones worth selling as curated tiers with
 * their own per-order pricing; the rest are cut. 694 of Instagram's 1,060
 * survive this.
 */
export function isPerItemPackage(service) {
  const max = Number(service.max);
  const min = Number(service.min);
  return max <= 20 || (min === max && max <= 1000);
}

/**
 * Turn service rows from the database into what a customer may see, grouped by
 * the tile that sells them. The raw provider name is used for the label, its
 * attributes and the duplicate check, then discarded: it carries a house style
 * — leading colour emoji, pipe-delimited speed and refill fields — that
 * identifies the source on sight, and the house rule is that it never reaches
 * a customer or a reseller.
 *
 * Duplicates are judged on the provider's own name plus price and range, not on
 * the Nitro label. Labelling is lossy on purpose — it is what makes the names
 * readable — and using it as the fingerprint threw away 3,324 distinct services
 * whose names happened to clean up the same: DAO's Male and Female Nigerian
 * followers, three different Facebook Reactions supply lines, every variant our
 * cleaner flattens. Two rows carrying identical provider text at an identical
 * price are the same product; two rows that merely read alike are not.
 *
 * `priceOf` turns the stored retail kobo into what this caller pays, so the
 * reseller route can pass its wholesale function and the customer route can
 * pass identity.
 */
export function buildAll(services, { usdRate, priceOf = (kobo) => kobo }) {
  let hiddenStale = 0, hiddenPackage = 0, hiddenNoPlatform = 0;
  const rows = [];
  for (const s of services) {
    if (!s.resellerMap || s.resellerMap.retiredAt) continue;
    if (isPerItemPackage(s)) { hiddenPackage++; continue; }
    const costKobo = Number(s.costPer1k) * usdRate;
    const retail = Number(s.sellPer1k);
    // A price at or below cost is a stale one the prices cron has not reached,
    // not a bargain. Hide it rather than quote a number we would never honour.
    if (!retail || retail <= costKobo) { hiddenStale++; continue; }
    // The stored column when the caller has it — the full-list route filters
    // on it in SQL, and a row must group under the same value it was selected
    // by. Computed from the name otherwise, which is what the column caches
    // and what every fixture exercises.
    const platform = s.platform || platformOf(s.name, s.category);
    if (!platform) { hiddenNoPlatform++; continue; }
    const fmt = formatResellerService(s.name, s.category);
    const { refill, refillLabel } = refillOf(s.name, s.category, s.refill);
    rows.push({
      id: s.resellerMap.apiId,
      serviceId: s.id,
      platform,
      label: fmt.base,
      attrs: fmt.attrs,
      type: typeOf(fmt.base),
      price: priceOf(retail) / 100,
      min: s.min,
      max: s.max,
      unlimited: isUnlimited(s.max),
      refill,
      refillLabel,
      dripfeed: s.dripfeed,
      apiType: s.apiType || 'Default',
      _key: `${String(s.name).toLowerCase().replace(/\s+/g, ' ').trim()}|${retail}|${s.min}|${s.max}`,
    });
  }
  // Cheapest first before the cut, so the survivor of a set of twins is the
  // one the customer would have picked anyway.
  rows.sort((a, b) => a.price - b.price || a.id - b.id);
  const seen = new Set();
  const byPlatform = new Map();
  let hiddenTwin = 0;
  for (const r of rows) {
    if (seen.has(r._key)) { hiddenTwin++; continue; }
    seen.add(r._key);
    delete r._key;
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, []);
    byPlatform.get(r.platform).push(r);
  }
  const counts = new Map();
  for (const [platform, list] of byPlatform) {
    const c = { all: list.length };
    for (const t of TYPES) c[t] = 0;
    for (const r of list) c[r.type]++;
    counts.set(platform, c);
  }
  return { byPlatform, counts, hiddenStale, hiddenPackage, hiddenTwin, hiddenNoPlatform };
}

// Nothing a provider wrote may survive into a row. This is the check the
// route test runs over a real page, and what a reviewer can run by hand.
const PROVIDER_TELLS = /[\u{1F535}\u{1F7E2}\u{1F7E1}]|\|\s*(?:Refill|Speed|Max|Start)/iu;
export function looksLikeProviderText(value) {
  return PROVIDER_TELLS.test(String(value || ''));
}
