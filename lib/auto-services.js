// Auto services — "auto likes", "auto comments", "auto views" — are a different
// product from everything else in the catalogue, and nothing said so.
//
// A normal service takes one post and delivers to it. An auto service is a
// subscription: it watches an account and delivers to whatever that account
// posts next. The provider marks them `apiType: "Subscriptions"` and expects a
// PROFILE, sent as `username`, plus min/max per post — not a post link and a
// quantity.
//
// Nothing surfaced that. The public label deliberately strips the provider's
// bracket tags, which is right (they are a provider tell) but also removed the
// only visible "[Auto Likes]" clue, so on the site an auto service read exactly
// like a normal one. The reseller API was worse: `standardType` had no mapping
// for Subscriptions, so it reported `type: "Default"` — actively telling a
// panel this was an ordinary link-and-quantity service.
//
// And the input was wrong. Six separate dispatch sites each carried their own
// copy of `link.match(/instagram\.com\/([^/?#]+)/)`, which on
// `instagram.com/reel/DdT2v2qtD-R/` captures the literal string "reel" and
// sends it as the username. Measured across every auto order ever placed: the
// two given a real profile link completed; all eleven given a post link
// produced username "reel" and went 5 cancelled, 4 stuck, 2 dubious. The regex
// was also Instagram-only, so the 59 Telegram, 16 TikTok and 13 YouTube auto
// services sent no username at all.
//
// So: one definition of what an auto service is, and one way to read a target
// out of a link, for all four platforms that have them.

/** Auto/subscription service, in the provider's terms. */
export function isAutoService(service) {
  return String(service?.apiType || '').trim().toLowerCase() === 'subscriptions';
}

// Path segments that are a kind of content rather than somebody's handle. A
// link starting with one of these is a post, and a post is exactly what an auto
// service must not be pointed at.
const IG_RESERVED = new Set([
  'p', 'reel', 'reels', 'tv', 'stories', 'story', 'explore', 's', 'direct',
  'accounts', 'about', 'developer', 'legal', 'privacy', 'terms', 'challenge',
]);
const YT_RESERVED = new Set(['watch', 'shorts', 'playlist', 'results', 'feed', 'embed', 'live']);
const TG_RESERVED = new Set(['s', 'joinchat', 'addstickers', 'proxy', 'socks', 'share']);

const clean = (v) => String(v || '').trim();
const stripAt = (v) => clean(v).replace(/^@+/, '');

/** `youtube.com/@handle`, `/channel/UC…`, `/c/Name`, `/user/name`. */
function youtubeTarget(path) {
  const seg = path.split('/').filter(Boolean);
  if (!seg.length) return null;
  if (seg[0].startsWith('@')) return stripAt(seg[0]) || null;
  if (['channel', 'c', 'user'].includes(seg[0].toLowerCase())) return seg[1] || null;
  if (YT_RESERVED.has(seg[0].toLowerCase())) return null;
  // A bare vanity path is a channel on youtube.com.
  return seg[0];
}

/**
 * The account an auto service should be pointed at, or null when the link is a
 * post rather than a profile.
 *
 * Null is the whole point: it is what lets a caller refuse the order instead of
 * sending the provider a username it invented from a post URL.
 */
export function autoTargetFrom(link, platform = null) {
  const raw = clean(link);
  if (!raw) return null;

  // A bare handle, which is what someone pastes when asked for a profile.
  if (!/[./]/.test(raw.replace(/^@+/, ''))) {
    const handle = stripAt(raw);
    return /^[A-Za-z0-9._-]{1,64}$/.test(handle) ? handle : null;
  }

  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  const path = url.pathname;
  const seg = path.split('/').filter(Boolean);
  const first = seg[0] ? decodeURIComponent(seg[0]) : '';
  const plat = clean(platform).toLowerCase();

  if (host.endsWith('instagram.com')) {
    if (!first || IG_RESERVED.has(first.toLowerCase())) return null;
    return stripAt(first) || null;
  }
  if (host.endsWith('tiktok.com')) {
    // Only the @handle form names an account; /video/… is a post.
    if (!first.startsWith('@')) return null;
    if (seg[1] && seg[1].toLowerCase() === 'video') return null;
    return stripAt(first) || null;
  }
  if (host.endsWith('youtube.com') || host === 'youtu.be') {
    if (host === 'youtu.be') return null; // always a single video
    return youtubeTarget(path);
  }
  if (host === 't.me' || host.endsWith('telegram.me') || host.endsWith('telegram.dog')) {
    if (!first || TG_RESERVED.has(first.toLowerCase())) return null;
    // t.me/channel/1234 is one message in a channel, not the channel.
    if (seg[1] && /^\d+$/.test(seg[1])) return null;
    return stripAt(first) || null;
  }

  // An unrecognised host on a platform we do have auto services for is not
  // something to guess at.
  if (['instagram', 'tiktok', 'youtube', 'telegram'].includes(plat)) return null;
  return null;
}

/** What to ask for, per platform, when an auto service needs a target. */
export function autoTargetLabel(platform) {
  switch (clean(platform).toLowerCase()) {
    case 'telegram': return 'Channel link';
    case 'youtube': return 'Channel link';
    default: return 'Profile link';
  }
}

/** Why an order was refused, in words a customer can act on. */
export function autoTargetError(platform) {
  const what = clean(platform).toLowerCase() === 'telegram' ? 'channel'
    : clean(platform).toLowerCase() === 'youtube' ? 'channel'
    : 'profile';
  return `This is an auto service: it delivers to your future posts, so it needs your ${what} link, not a link to one post.`;
}
