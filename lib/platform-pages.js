/**
 * Which platforms have a public /services/<slug> page, in one place.
 *
 * This used to be written twice: a PLATFORM_SLUGS map inside app/sitemap.js
 * saying which database platform names get a URL, and a PLATFORM_META object
 * inside app/services/[platform]/page.jsx holding the copy for each slug. Two
 * lists, no link between them, and they drifted — Spotify had a finished page
 * with an h1, a meta description and eleven live groups behind it, and was
 * missing from the sitemap, so nothing ever crawled it.
 *
 * The keys are the platform strings as the database stores them, which is why
 * TikTok appears twice: live groups carry both "TikTok" and "tiktok" and both
 * have to resolve. The values are the URL slugs, and every one of them must
 * have a PLATFORM_META entry or the page 404s — tests/platform-page-parity
 * asserts exactly that in both directions.
 *
 * Adding a platform here without writing its page is worse than leaving it
 * out: a sitemap that promises a URL and serves a 404 is a crawl budget spent
 * on nothing.
 */
export const PLATFORM_SLUGS = {
  Instagram: 'instagram',
  tiktok: 'tiktok',
  TikTok: 'tiktok',
  YouTube: 'youtube',
  'Twitter/X': 'x',
  Facebook: 'facebook',
  Telegram: 'telegram',
  Spotify: 'spotify',
  Snapchat: 'snapchat',
  LinkedIn: 'linkedin',
  Twitch: 'twitch',
  Discord: 'discord',
};

/** The distinct slugs, which is what the pages are keyed by. */
export const PLATFORM_PAGE_SLUGS = [...new Set(Object.values(PLATFORM_SLUGS))];
