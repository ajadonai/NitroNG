/**
 * Auto-links a platform's first mention in a blog post's body to the page
 * that sells it — "Nigerian creators looking to promote a new release can
 * compare Audiomack promotion, Boomplay promotion, and Spotify services",
 * each phrase linking out, without anyone hand-editing seventy posts.
 *
 * Deliberately scoped to editorial blog content, not Help articles (someone
 * reading "how to copy your Instagram link" does not want a sales link mid
 * sentence) and not the service-type intros in lib/service-type-meta.js
 * (those already hand-place their own links with more care than a scan of
 * bare platform names could match).
 *
 * ── Rules, in the order they matter ──
 * 1. Never touch text already inside an `<a>` — most platform mentions in
 *    existing posts already link somewhere on purpose, and doubling that is
 *    worse than leaving it alone.
 * 2. Never touch a heading. `addHeadingIds` in blog-rendering.js already
 *    depends on `<h2>…</h2>` matching a single regex; a link injected inside
 *    one would not break it, but a platform name mid-heading reads as an
 *    accident, not a feature.
 * 3. Longest term wins. "Instagram Followers" is tried before bare
 *    "Instagram", so a post that already names the specific service gets the
 *    specific page rather than the general hub.
 * 4. One link per target URL per post. A post that says "Instagram" six times
 *    gets one link on the first mention, not six — the thing this exists to
 *    avoid is a paragraph that reads like a keyword-stuffed directory.
 * 5. A term already sitting on the page it would link to is skipped — no
 *    self-links, even though nothing in blog content should ever collide with
 *    a /services/ URL today.
 */
import SERVICE_TYPE_META from '@/lib/service-type-meta';

// Every platform that has its own /services/{slug} page. This is the same
// list as PLATFORM_ORDER in app/services/[platform]/page.jsx, kept here as a
// second copy because that file is a route, not a lib, and importing route
// modules into shared code is the wrong direction for the dependency to run.
// If a platform page is added or removed there, mirror it here — nothing
// breaks if this drifts (a stale entry just stops matching, or a new platform
// simply is not linked yet), but a term is only worth adding once its page
// actually exists.
const PLATFORM_PAGES = {
  Instagram: 'instagram', TikTok: 'tiktok', YouTube: 'youtube', Facebook: 'facebook',
  Telegram: 'telegram', Spotify: 'spotify', Snapchat: 'snapchat', LinkedIn: 'linkedin',
  Twitch: 'twitch', Discord: 'discord', WhatsApp: 'whatsapp', Audiomack: 'audiomack',
  Boomplay: 'boomplay', Threads: 'threads', Kick: 'kick', SoundCloud: 'soundcloud',
  Bluesky: 'bluesky', Deezer: 'deezer',
  // "X" alone is too short and too common a letter to ever safely match inside
  // prose (it would fire on "X factor", "10x", table cells, anything). The
  // brand is written both ways in copy, so only the two unambiguous spellings
  // are linkable.
  'X (Twitter)': 'x', 'Twitter/X': 'x', 'Google Reviews': 'google',
};

function buildTermMap() {
  const terms = new Map(); // term (exact case as written) -> url

  // Type-level terms first, from the richer, more specific catalogue —
  // "TikTok Views" beats bare "TikTok" once both are candidates. The key
  // itself is "platform/type" and is already the two path segments the URL
  // needs, so there is nothing to look back up.
  for (const [key, meta] of Object.entries(SERVICE_TYPE_META)) {
    if (!meta.platformName || !meta.typeLabel) continue;
    terms.set(`${meta.platformName} ${meta.typeLabel}`, `/services/${key}`);
  }
  for (const [name, slug] of Object.entries(PLATFORM_PAGES)) {
    if (!terms.has(name)) terms.set(name, `/services/${slug}`);
  }

  // Longest term first, so a specific match is attempted before a shorter one
  // that would otherwise consume the same words.
  return [...terms.entries()].sort((a, b) => b[0].length - a[0].length);
}

let cachedTerms = null;
const terms = () => (cachedTerms ??= buildTermMap());

const MAX_LINKS_PER_POST = 4;

/**
 * Links the first mention of each recognised platform or service phrase in
 * `html` to the page that sells it, up to MAX_LINKS_PER_POST insertions.
 * Idempotent-ish in practice: run twice and the second pass finds nothing new
 * to link, because everything it already linked now sits inside an `<a>`.
 */
export function linkifyPlatformMentions(html, { currentUrl = null } = {}) {
  if (!html) return html;

  const usedUrls = new Set(currentUrl ? [currentUrl] : []);
  // Seeded with every href already on the page, not just the ones this pass
  // adds. Found live on a real post: a hand-written link already pointed at
  // /services/spotify further down, and an earlier bare "Spotify" mention got
  // auto-linked to the same page — technically two different anchors rather
  // than one doubled-up tag, but exactly the "same URL twice" outcome rule 5
  // above says not to produce, just arrived at from the other direction.
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)) usedUrls.add(m[1]);

  let linksLeft = MAX_LINKS_PER_POST;
  let out = '';

  // Walk tag-by-tag so a term is only ever matched in the text nodes between
  // tags — the same shape linkifyEmails in blog-rendering.js already uses, and
  // for the same reason: a regex over the whole HTML string cannot otherwise
  // tell "text inside this paragraph" from "text inside this attribute".
  const tagOrTextRe = /<a\b[^>]*>[\s\S]*?<\/a>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>|<[^>]+>|[^<]+/gi;
  let match;
  while ((match = tagOrTextRe.exec(html))) {
    const chunk = match[0];
    // Already a link, or a whole heading: copy through untouched.
    if (/^<a\b/i.test(chunk) || /^<h[1-6]\b/i.test(chunk) || /^</.test(chunk)) {
      out += chunk;
      continue;
    }
    // A bare text run between tags — the only place a term may be inserted.
    out += linkinsText(chunk);
  }
  return out;

  function linkinsText(text) {
    if (linksLeft <= 0) return text;
    for (const [term, url] of terms()) {
      if (linksLeft <= 0) break;
      if (usedUrls.has(url)) continue;
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      const hit = text.match(re);
      if (!hit) continue;
      usedUrls.add(url);
      linksLeft--;
      const before = text.slice(0, hit.index);
      const after = text.slice(hit.index + hit[0].length);
      // Recurse on the tail only: the matched term itself is done, and
      // anything before it cannot contain a longer/earlier match we skipped
      // past, since terms are tried longest-first across the whole chunk.
      return `${before}<a href="${url}">${hit[0]}</a>${linkinsText(after)}`;
    }
    return text;
  }
}
