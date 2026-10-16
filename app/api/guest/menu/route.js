import { log } from '@/lib/logger';
import { getServiceCatalogue } from '@/lib/service-catalog';
import { getActivePromotion } from '@/lib/promotions';
import { guestCheckoutOpen } from '@/lib/guest-checkout';

// The essentials the landing order card offers, as agreed in the guest
// checkout mockup: [what the card calls it, the catalogue group it orders].
// Everything else stays in the full app. Matched on the group's name, so a
// renamed group drops out of the card rather than ordering the wrong thing.
const MENU = {
  global: {
    Instagram: [['Instagram Followers', 'Instagram Followers'], ['Instagram Likes', 'Instagram Likes'], ['Instagram Comments', 'Instagram Comments'], ['Instagram Views', 'Instagram Reel/Video Views']],
    TikTok: [['TikTok Followers', 'TikTok Followers'], ['TikTok Likes', 'TikTok Likes'], ['TikTok Comments', 'TikTok Comments'], ['TikTok Views', 'TikTok Video Views']],
    YouTube: [['YouTube Subscribers', 'YouTube Subscribers'], ['YouTube Likes', 'YouTube Likes'], ['YouTube Comments', 'YouTube Custom Comments'], ['YouTube Views', 'YouTube Views']],
    'Twitter/X': [['X Followers', 'X/Twitter Followers'], ['X Likes', 'X/Twitter Likes'], ['X Reposts', 'X/Twitter Retweets'], ['X Views', 'X/Twitter Tweet Views']],
    Facebook: [['Facebook Followers', 'Facebook Profile Followers'], ['Facebook Likes', 'Facebook Post Likes'], ['Facebook Views', 'Facebook Video Views']],
    Telegram: [['Telegram Members', 'Telegram Channel Members'], ['Telegram Post Views', 'Telegram Post Views'], ['Telegram Reactions', 'Telegram Reactions (Positive)']],
  },
  nigerian: {
    Instagram: [['Instagram Followers', 'Instagram Followers 🇳🇬'], ['Instagram Likes', 'Instagram Likes 🇳🇬'], ['Instagram Comments', 'Instagram Comments 🇳🇬'], ['Instagram Reposts', 'Instagram Reposts 🇳🇬']],
    TikTok: [['TikTok Followers', 'TikTok Followers 🇳🇬'], ['TikTok Likes', 'TikTok Likes 🇳🇬'], ['TikTok Comments', 'TikTok Comments 🇳🇬'], ['TikTok Views', 'TikTok Video Views 🇳🇬']],
    YouTube: [['YouTube Subscribers', 'YouTube Subscribers 🇳🇬'], ['YouTube Likes', 'YouTube Likes 🇳🇬'], ['YouTube Comments', 'YouTube Comments 🇳🇬'], ['YouTube Views', 'YouTube Views 🇳🇬']],
    'Twitter/X': [['X Followers', 'X/Twitter Followers 🇳🇬'], ['X Likes', 'X/Twitter Likes 🇳🇬'], ['X Reposts', 'X/Twitter Retweets 🇳🇬'], ['X Comments', 'X/Twitter Comments 🇳🇬'], ['X Views', 'X/Twitter Views 🇳🇬']],
    Facebook: [['Facebook Followers', 'Facebook Followers 🇳🇬'], ['Facebook Likes', 'Facebook Post Likes 🇳🇬'], ['Facebook Comments', 'Facebook Comments 🇳🇬'], ['Facebook Shares', 'Facebook Shares 🇳🇬'], ['Facebook Views', 'Facebook Views 🇳🇬']],
  },
};
const PLATFORMS = Object.keys(MENU.global);

/** What a tier needs typed beyond a link and a number, from its service's API type. */
function textNeeded(apiType = '') {
  const t = apiType.toLowerCase();
  if (t.includes('custom comment') || t.includes('comment replies')) return 'comments';
  if (t.includes('mention') || t === 'poll' || t === 'seo') return 'unsupported';
  return null;
}

/**
 * GET /api/guest/menu — the catalogue as the guest order card shows it:
 * prices in kobo per 1,000 and the live promotion, so the card can show the
 * exact figure the quote will charge. No provider, service or cost data.
 */
export async function GET() {
  if (!await guestCheckoutOpen()) return Response.json({ error: 'Not available' }, { status: 404 });
  try {
    const catalogue = await getServiceCatalogue();
    const byKey = new Map(catalogue.groups.map(g => [`${g.platform}|${g.nigerian}|${g.name}`, g]));
    const picked = Object.entries(MENU).flatMap(([market, platforms]) => Object.entries(platforms).flatMap(([platform, items]) =>
      items.map(([label, name]) => ({ label, g: byKey.get(`${platform}|${market === 'nigerian'}|${name}`) })).filter(x => x.g)));
    const groups = picked
      // Option groups (poll votes) need a picker the card does not have.
      .filter(({ g }) => !g.tiers.some(t => t.tags?.includes('options')))
      .map(({ label, g }) => ({
        id: g.id,
        name: label,
        platform: g.platform,
        nigerian: g.nigerian,
        profile: g.type === 'followers',
        tiers: g.tiers
          .filter(t => t.price > 0 && textNeeded(t.apiType) !== 'unsupported')
          .map(t => ({ id: t.id, tier: t.tier, perK: Math.round(t.price * 100), min: t.min, max: t.max, comments: textNeeded(t.apiType) === 'comments' })),
      }))
      .filter(g => g.tiers.length > 0);
    const active = await getActivePromotion().catch(() => null);
    const promo = active ? { pct: active.promotion.discountPercent, cap: active.promotion.maxDiscountPerOrder || 0 } : null;
    return Response.json({ platforms: PLATFORMS, groups, promo }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    log.error('Guest menu', err.message);
    return Response.json({ error: 'Could not load the services' }, { status: 500 });
  }
}
