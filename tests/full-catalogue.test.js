import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FULL_WHERE, buildAll, categoriesForPlatform, isKnownPlatform, platformOf, refillOf,
  isPerItemPackage, isUnlimited, looksLikeProviderText, typeOf,
} from '@/lib/full-catalogue';
import { attrKind, LOCATION_KEYS, matchesLocation } from '@/lib/service-attrs';
import { serviceAttributes } from '@/lib/reseller-format';

// The full list shows 9,748 provider services Nitro never chose, never tested
// and never wrote the names for. Three things therefore have to hold, and they
// are what this file pins:
//
//   1. No provider name, emoji grade or pipe field reaches a customer.
//   2. Nothing is quoted at a price we would not honour — no stale row, no
//      per-item package priced as if it were per 1,000.
//   3. The same service does not appear twice under the same name.

const usdRate = 1529;
// Every fixture here is one platform's service, so a thin wrapper keeps the
// assertions about a flat list of rows while buildAll groups the whole
// catalogue by tile.
const one = (services, opts) => {
  const b = buildAll(services, opts);
  const rows = [...b.byPlatform.values()].flat();
  return { ...b, rows, counts: [...b.counts.values()][0] || { all: 0 } };
};
const svcBase = () => ({ ...svc() });
const svc = (over = {}) => ({
  id: `s${over.apiId ?? 1}`,
  name: 'Instagram Followers [HQ Profile] [Refill: 30 Days] [Instant Start]',
  category: 'Instagram',
  costPer1k: 100n,        // ₦152.90 at cost
  sellPer1k: 350100n,     // ₦3,501 retail
  min: 100, max: 100000, refill: true, dripfeed: false, apiType: 'Default',
  resellerMap: { apiId: over.apiId ?? 2440, retiredAt: null },
  ...over,
});

describe('the full list fence', () => {
  it('only admits services Nitro could actually place', () => {
    // Every clause earns its place: a jap row has no working supply line, an
    // unlisted one is gone from the provider, a zero cost is an unpriced
    // import, a row with tiers is already on the curated menu, and one with no
    // reseller map has no public ID to order by.
    expect(FULL_WHERE).toEqual({
      provider: { in: ['mtp', 'dao'] },
      providerListedAt: { not: null },
      costPer1k: { gt: 0 },
      tiers: { none: {} },
      resellerMap: { isNot: null },
    });
  });

  it('keys the list by the platform tiles New Order already has', () => {
    // 113 provider categories, about eighty of which are not platforms at all
    // ("Vip", "Cheapest", "🔵"). Junk cannot surface because nothing asks for it.
    expect(categoriesForPlatform('instagram')).toEqual(['Instagram']);
    expect(categoriesForPlatform('twitter')).toEqual(['Twitter/X']);
    expect(categoriesForPlatform('onlyfans')).toEqual(['OnlyFans', 'Onlyfans']);
    expect(isKnownPlatform('vip')).toBe(false);
    expect(isKnownPlatform('cheapest')).toBe(false);
    // A tile with no provider category answers with an empty list, not undefined.
    expect(categoriesForPlatform('tidal')).toEqual([]);
    expect(isKnownPlatform('tidal')).toBe(true);
  });
});

describe('what a customer is shown', () => {
  it('labels a row in Nitro words and drops the provider name', () => {
    const { rows } = one([svc()], { usdRate });
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Instagram Followers');
    expect(rows[0].attrs).toEqual(['30-day refill', 'Instant', 'High quality']);
    // Nothing the provider wrote survives anywhere on the row.
    for (const value of [rows[0].label, ...rows[0].attrs]) {
      expect(looksLikeProviderText(value), `provider text in "${value}"`).toBe(false);
    }
    expect(JSON.stringify(rows[0])).not.toContain('[Refill:');
    expect(JSON.stringify(rows[0])).not.toContain('HQ Profile');
  });

  it('catches the tells a provider name carries', () => {
    expect(looksLikeProviderText('🔵 Instagram Followers')).toBe(true);
    expect(looksLikeProviderText('Instagram Likes | Refill: 30D')).toBe(true);
    expect(looksLikeProviderText('Instagram Followers')).toBe(false);
  });

  it('prices at retail, and in naira', () => {
    const { rows } = one([svc()], { usdRate });
    expect(rows[0].price).toBe(3501);
  });

  it("applies a reseller's own terms to the same list", () => {
    const { rows } = one([svc()], { usdRate, priceOf: (kobo) => kobo * 0.8 });
    expect(rows[0].price).toBeCloseTo(2800.8, 5);
  });

  it('gives the row the public ID, never the internal one', () => {
    const { rows } = one([svc()], { usdRate });
    expect(rows[0].id).toBe(2440);
  });
});

describe('what is cut, and why', () => {
  it('hides a price at or below cost rather than quote it', () => {
    // The prices cron has not reached this row. Quoting ₦1.53 per 1K is a
    // number we would refuse at checkout, which is worse than not listing it.
    const stale = svc({ apiId: 9001, sellPer1k: 100n });
    const { rows, hiddenStale } = one([stale], { usdRate });
    expect(rows).toHaveLength(0);
    expect(hiddenStale).toBe(1);
  });

  it('hides a package priced per item, not per 1,000', () => {
    // "5 verified comments" at ₦2,700 is ₦2,700 — not ₦2,700 per 1K. The full
    // list quotes everything per 1K, so this row could only mislead.
    expect(isPerItemPackage({ min: 1, max: 5 })).toBe(true);
    expect(isPerItemPackage({ min: 1000, max: 1000 })).toBe(true);
    expect(isPerItemPackage({ min: 100, max: 100000 })).toBe(false);
    const { rows, hiddenPackage } = one([svc({ apiId: 9002, min: 1, max: 5 })], { usdRate });
    expect(rows).toHaveLength(0);
    expect(hiddenPackage).toBe(1);
  });

  it('collapses only rows the provider wrote identically', () => {
    // Same provider text, same price, same range: one product listed twice.
    const { rows, hiddenTwin } = one([
      svc({ apiId: 1, id: 's1' }),
      svc({ apiId: 2, id: 's2' }),
    ], { usdRate });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    expect(hiddenTwin).toBe(1);
  });

  it('keeps two services whose names merely clean up the same', () => {
    // This is the one that mattered. Labelling is lossy by design — it is what
    // makes provider names readable — so using the Nitro label as the
    // fingerprint hid 3,324 distinct services: DAO's Male and Female Nigerian
    // followers, three separate Facebook Reactions supply lines, every variant
    // the cleaner flattens. The provider's own text is the fingerprint now.
    // Two supply lines the cleaner cannot tell apart: the grade emoji and the
    // provider's own initials are exactly what it is built to strip.
    const { rows, hiddenTwin } = one([
      svc({ apiId: 1, id: 's1', name: '\u{1F535} Instagram Followers [HQ Profile] [Refill: 30 Days] [Instant Start]' }),
      svc({ apiId: 2, id: 's2', name: 'Instagram Followers [HQ Profile] [Refill: 30 Days] [Instant Start] MTP' }),
    ], { usdRate });
    expect(rows).toHaveLength(2);
    expect(hiddenTwin).toBe(0);
    // They do read the same, which is why the label alone could never tell them
    // apart — and why it must not be what decides.
    expect(rows[0].label).toBe(rows[1].label);
  });

  it('keeps two rows that differ in anything a customer would weigh', () => {
    const { rows } = one([
      svc({ apiId: 1, id: 's1' }),
      svc({ apiId: 2, id: 's2', sellPer1k: 480000n }),
      svc({ apiId: 3, id: 's3', max: 500000 }),
      svc({ apiId: 4, id: 's4', name: 'Instagram Followers [HQ Profile] [Refill: No] [Instant Start]', refill: false }),
    ], { usdRate });
    expect(rows.map(r => r.id)).toEqual([1, 3, 4, 2]);
  });

  it('skips a retired reseller mapping', () => {
    const { rows } = one([svc({ resellerMap: { apiId: 7, retiredAt: new Date() } })], { usdRate });
    expect(rows).toHaveLength(0);
  });

  it('orders cheapest first', () => {
    // Both comfortably above the ₦1,529 cost, so the stale guard leaves them.
    const { rows } = one([
      svc({ apiId: 1, id: 's1', sellPer1k: 900000n }),
      svc({ apiId: 2, id: 's2', sellPer1k: 200000n }),
    ], { usdRate });
    expect(rows.map(r => r.price)).toEqual([2000, 9000]);
  });
});

describe('the type row', () => {
  it('reads the type off the Nitro label, which is the text the customer sees', () => {
    expect(typeOf('Instagram Followers')).toBe('followers');
    expect(typeOf('YouTube Subscribers')).toBe('followers');
    expect(typeOf('Instagram Custom Comments')).toBe('comments');
    expect(typeOf('Google Reviews')).toBe('comments');
    expect(typeOf('Instagram Reel Views')).toBe('views');
    expect(typeOf('Spotify Plays')).toBe('views');
    expect(typeOf('Instagram Reach + Impressions')).toBe('views');
    expect(typeOf('Instagram Likes')).toBe('likes');
    expect(typeOf('Instagram Saves')).toBe('likes');
    // Anything with no home lands in engagement rather than vanishing.
    expect(typeOf('Telegram Bot Start')).toBe('engagement');
    expect(typeOf('Instagram Mentions')).toBe('engagement');
    expect(typeOf('Instagram Story Link Click')).toBe('engagement');
  });

  it('keeps channel and group members out of followers', () => {
    // 472 services. Someone shopping for profile followers used to meet a
    // product that needs a channel link instead.
    expect(typeOf('Telegram Members')).toBe('members');
    expect(typeOf('Telegram Channel Members')).toBe('members');
    expect(typeOf('Telegram Group Members')).toBe('members');
    expect(typeOf('Facebook Group Members')).toBe('members');
    expect(typeOf('Instagram Channel Members')).toBe('members');
    expect(typeOf('Facebook Group Join Organic')).toBe('members');
    // Even when the name also says followers, because that is the combo's
    // headline product.
    expect(typeOf('Telegram Channel Members + Post Views + Followers')).toBe('members');
  });

  it('files one action under one type however the platform spells it', () => {
    // Reposts used to be likes and retweets engagement, so the same product
    // sat in two places depending on which network wrote the name.
    expect(typeOf('YouTube Shares')).toBe('shares');
    expect(typeOf('Instagram Reposts')).toBe('shares');
    expect(typeOf('X Retweets')).toBe('shares');
    expect(typeOf('Threads Reshare')).toBe('shares');
    expect(typeOf('Bluesky Quote Post')).toBe('shares');
    expect(typeOf('Audiomack Re-UP')).toBe('shares');
  });

  it('counts a follow as a follower however it is worded', () => {
    // Every one of these was in the catch-all: the word is "follow", not
    // "followers", and the old rule wanted the noun.
    expect(typeOf('Deezer Artist Follow')).toBe('followers');
    expect(typeOf('Quora.com Page Follow')).toBe('followers');
    expect(typeOf('Spotify Organic Page Follow')).toBe('followers');
    expect(typeOf('LinkedIn Nigerian Page Connect')).toBe('followers');
    expect(typeOf('Facebook Friends Request · USA')).toBe('followers');
    // And a provider typo still lands right.
    expect(typeOf('Facebook Followes 500K/D')).toBe('followers');
  });

  it('counts a star rating as a review', () => {
    expect(typeOf('Google 5 Star Ratings')).toBe('comments');
    expect(typeOf('Google 1-5 Star Ratings · USA')).toBe('comments');
    expect(typeOf('Bluesky Reply')).toBe('comments');
    // "Start" is not "star" — Telegram bot starts must not become reviews.
    expect(typeOf('Telegram Bot Start')).toBe('engagement');
    expect(typeOf('Telegram Bot Start 10K/Day')).toBe('engagement');
  });

  it('counts an upvote and a downvote as votes', () => {
    // The word-boundary in the old rule meant "upvotes" did not read as a
    // vote, so every Reddit and Quora vote service was in the catch-all.
    expect(typeOf('Reddit Upvotes')).toBe('likes');
    expect(typeOf('Quora.com Downvotes')).toBe('likes');
    expect(typeOf('X Poll Votes')).toBe('likes');
  });

  it('does not let a neighbouring word claim a service', () => {
    // A like on a comment is a like; a comment is a comment.
    expect(typeOf('YouTube Comment Likes')).toBe('likes');
    expect(typeOf('Facebook Comment Reactions')).toBe('likes');
    expect(typeOf('YouTube Comments')).toBe('comments');
    // A combo files under what it mostly delivers, not its last word.
    expect(typeOf('YouTube Live Stream Views + Likes + Comments')).toBe('views');
    expect(typeOf('Instagram Worldwide Profile Visits')).toBe('views');
  });

  it('counts every row into exactly one type', () => {
    const { rows, counts } = one([
      svc({ apiId: 1, id: 's1', name: 'Instagram Followers' }),
      svc({ apiId: 2, id: 's2', name: 'Instagram Likes' }),
      svc({ apiId: 3, id: 's3', name: 'Instagram Custom Comments' }),
      svc({ apiId: 4, id: 's4', name: 'Instagram Reel Views' }),
      svc({ apiId: 5, id: 's5', name: 'Instagram Channel Members' }),
      svc({ apiId: 6, id: 's6', name: 'Instagram Reposts' }),
      svc({ apiId: 7, id: 's7', name: 'Instagram Mentions' }),
    ], { usdRate });
    expect(counts.all).toBe(rows.length);
    expect(counts).toEqual({ all: 7, followers: 1, members: 1, likes: 1, views: 1, comments: 1, shares: 1, engagement: 1 });
  });

  it('gives the row the same type the counts were built from', () => {
    // A row and its group can never disagree: both read the Nitro label.
    const { rows, counts } = one([
      svc({ apiId: 1, id: 's1', name: 'Telegram Channel Members' }),
    ], { usdRate });
    expect(rows[0].type).toBe('members');
    expect(counts.members).toBe(1);
  });
});

describe('the unlimited maximum', () => {
  it('reads a provider ceiling as "no limit" rather than a number to show', () => {
    // 2,147,483,647 is a signed 32-bit ceiling, not a quantity anyone can order.
    expect(isUnlimited(2147483647)).toBe(true);
    expect(isUnlimited(100_000_000)).toBe(true);
    expect(isUnlimited(1_000_000)).toBe(false);
    const { rows } = one([svc({ max: 2147483647 })], { usdRate });
    expect(rows[0].unlimited).toBe(true);
  });
});

describe('what colour a fact gets', () => {
  it('sorts every attribute the formatter can write into a family', () => {
    // A closed set: serviceAttributes writes all of these and nothing else, so
    // a row colours by meaning rather than printing five kinds of fact in one
    // grey. If a new attribute is added there, it lands in "other" until it is
    // given a home here — visible, never dropped.
    expect(attrKind('Lifetime guarantee')).toBe('refill');
    expect(attrKind('30-day refill')).toBe('refill');
    expect(attrKind('365-day refill')).toBe('refill');
    expect(attrKind('No refill')).toBe('refill');
    expect(attrKind('Non-drop')).toBe('refill');

    expect(attrKind('Instant start')).toBe('speed');
    expect(attrKind('Starts in 1 hour')).toBe('speed');
    expect(attrKind('5-50K/day')).toBe('speed');

    expect(attrKind('High quality')).toBe('quality');
    expect(attrKind('Real')).toBe('quality');
    expect(attrKind('Premium accounts')).toBe('quality');
    expect(attrKind('Royalties eligible')).toBe('quality');

    expect(attrKind('Nigerian')).toBe('location');
    expect(attrKind('Worldwide')).toBe('location');
    expect(attrKind('USA')).toBe('location');
    expect(attrKind('Indian')).toBe('location');

    expect(attrKind('Drop 5%')).toBe('other');
    expect(attrKind('')).toBe('other');
    expect(attrKind(undefined)).toBe('other');
  });

  it('does not let a refill duration be mistaken for a speed', () => {
    // "365-day refill" holds a number and a time unit, the same shape a rate
    // limit has. Refill is tested first for exactly this reason.
    expect(attrKind('365-day refill')).toBe('refill');
    expect(attrKind('1-year refill')).toBe('refill');
  });
});

describe('the server lib stays off the client', () => {
  it('is never imported by a component', () => {
    // It was, for one eight-line function, and Turbopack refused to instantiate
    // it in the browser. The real cost was quieter: the Prisma where clause, the
    // row builder, the label formatter and its whole allowlist would have
    // shipped to every visitor who reaches New Order. attrKind lives in
    // lib/service-attrs, which imports nothing, for exactly this reason.
    const dir = path.join(process.cwd(), 'components');
    const offenders = fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsx') || f.endsWith('.js'))
      .filter(f => /from\s+["'][^"']*\/full-catalogue["']/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    expect(offenders, `these pull the server catalogue lib into the client bundle: ${offenders.join(', ')}`).toEqual([]);
  });

  it('keeps the attribute classifier dependency-free', () => {
    // One import here and the whole point is lost again.
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/service-attrs.js'), 'utf8');
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});

// The full list's sorts, which are the component's own (lib holds no ordering).
// Mirrored here because the rating order makes judgement calls — where unrated
// rows go, and what breaks a tie — that are easy to change by accident.
describe('the full list sorts', () => {
  const VOTES_NEEDED = 3;
  const approvalOf = (row) => {
    const total = (row.up || 0) + (row.down || 0);
    return total < VOTES_NEEDED ? null : Math.round((100 * row.up) / total);
  };
  const sortRows = (rows, sort) => {
    const l = rows.slice();
    if (sort === 'dear') l.sort((a, b) => b.price - a.price || a.id - b.id);
    else if (sort === 'max') l.sort((a, b) => b.max - a.max || a.price - b.price);
    else if (sort === 'min') l.sort((a, b) => a.min - b.min || a.price - b.price);
    else if (sort === 'rated') l.sort((a, b) => {
      const ra = approvalOf(a), rb = approvalOf(b);
      if (ra == null && rb == null) return a.price - b.price;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return rb - ra || (b.up + b.down) - (a.up + a.down) || a.price - b.price;
    });
    else l.sort((a, b) => a.price - b.price || a.id - b.id);
    return l;
  };
  const row = (id, over = {}) => ({ id, price: 1000, min: 100, max: 10000, up: 0, down: 0, ...over });

  it('puts the smallest minimum first, for anyone testing a service', () => {
    const l = sortRows([row(1, { min: 1000 }), row(2, { min: 10 }), row(3, { min: 100 })], 'min');
    expect(l.map(r => r.min)).toEqual([10, 100, 1000]);
  });

  it('sends unrated rows to the back in price order, not to the bottom as bad', () => {
    // Silence is not a low score. An unrated row is unknown, and it keeps its
    // price ordering among the other unknowns.
    const l = sortRows([
      row(1, { price: 500 }),                      // unrated, cheapest
      row(2, { price: 900, up: 9, down: 1 }),      // 90%
      row(3, { price: 300 }),                      // unrated, cheaper still
      row(4, { price: 800, up: 5, down: 5 }),      // 50%
    ], 'rated');
    expect(l.map(r => r.id)).toEqual([2, 4, 3, 1]);
  });

  it('ignores a rating nobody has really given', () => {
    // Two votes is under the threshold, so the row ranks as unrated however
    // flattering the two are.
    const l = sortRows([row(1, { up: 2, down: 0, price: 900 }), row(2, { up: 3, down: 1, price: 800 })], 'rated');
    expect(l.map(r => r.id)).toEqual([2, 1]);
  });

  it('breaks an equal rating with the number of people behind it', () => {
    // Fifteen people at 80% is a firmer number than five at 80%.
    const l = sortRows([row(1, { up: 4, down: 1 }), row(2, { up: 12, down: 3 })], 'rated');
    expect(l.map(r => r.id)).toEqual([2, 1]);
    expect(approvalOf(l[0])).toBe(approvalOf(l[1]));
  });

  it('still orders by price when nothing is rated at all', () => {
    const l = sortRows([row(1, { price: 900 }), row(2, { price: 100 })], 'rated');
    expect(l.map(r => r.price)).toEqual([100, 900]);
  });
});

describe('where the accounts come from', () => {
  it('reads an origin off the label, not only the attributes', () => {
    // Only "Nigerian" and "Worldwide" are attributes — serviceAttributes has no
    // rule for USA, Indian or Turkish, so those exist in the name and nowhere
    // else. The filter matches label and attributes together for that reason.
    expect(matchesLocation('Instagram USA Followers', 'usa')).toBe(true);
    expect(matchesLocation('Instagram Indian Custom Comments', 'indian')).toBe(true);
    expect(matchesLocation('Instagram Nigerian Likes', 'nigerian')).toBe(true);
    expect(matchesLocation('Instagram Worldwide Shares', 'worldwide')).toBe(true);
    expect(matchesLocation('Instagram UAE Followers', 'arab')).toBe(true);
  });

  it('accepts the several ways a provider writes one country', () => {
    for (const s of ['Instagram USA Likes', 'Instagram United States Likes', 'Instagram American Likes', 'Likes from US Profiles']) {
      expect(matchesLocation(s, 'usa'), s).toBe(true);
    }
    for (const s of ['Instagram UK Followers', 'Instagram United Kingdom Followers', 'British Followers']) {
      expect(matchesLocation(s, 'uk'), s).toBe(true);
    }
    expect(matchesLocation('Instagram Global Views', 'worldwide')).toBe(true);
  });

  it('does not claim a service that says nothing about origin', () => {
    expect(LOCATION_KEYS.some(k => matchesLocation('Instagram Followers', k))).toBe(false);
    expect(LOCATION_KEYS.some(k => matchesLocation('YouTube Likes', k))).toBe(false);
  });

  it('does not let one origin swallow another', () => {
    // "Asian" and "American" share letters; "Nigerian" and "Indian" both end in
    // -ian. Each has to claim only its own.
    expect(matchesLocation('Instagram American Followers', 'asian')).toBe(false);
    expect(matchesLocation('Instagram Nigerian Followers', 'indian')).toBe(false);
    expect(matchesLocation('Instagram Indian Followers', 'nigerian')).toBe(false);
    expect(matchesLocation('Instagram Nigerian Followers', 'african')).toBe(false);
  });

  it('answers false for an origin it does not know', () => {
    expect(matchesLocation('Instagram Followers', 'martian')).toBe(false);
    expect(matchesLocation(undefined, 'usa')).toBe(false);
  });
});

describe('which tile a service lands on', () => {
  it('reads the name first, because the provider category cannot be trusted', () => {
    // The bug this fixes: 2,655 live services sat under "Other", "Vip",
    // "Cheapest", "Private" and a blue-circle emoji across both providers, and
    // every one was unreachable however plainly its name said Instagram.
    expect(platformOf('Instagram Followers [HQ Profiles] [Instant Start]', 'Other')).toBe('instagram');
    expect(platformOf('TikTok Likes', 'Vip')).toBe('tiktok');
    expect(platformOf('Telegram Members', 'Cheapest')).toBe('telegram');
    expect(platformOf('Spotify Plays', '🔵')).toBe('spotify');
  });

  it('falls back to the category when the name names no platform', () => {
    expect(platformOf('Followers 100K/Day', 'Instagram')).toBe('instagram');
    expect(platformOf('Post Reactions', 'Facebook')).toBe('facebook');
  });

  it('places the two tiles the storefront cleaner has no pattern for', () => {
    // Otherwise Google reviews filed under a junk category reach no tile.
    expect(platformOf('Google Custom Reviews | Turkey | 30 Day Refill', 'Provided')).toBe('google');
    expect(platformOf('Trustpilot Reviews', '🔵')).toBe('trustpilot');
  });

  it('reads a platform named as a traffic source as web traffic', () => {
    // "USA Traffic from Instagram" is website traffic — Instagram is where the
    // visitor comes from, not the thing being grown. 95 orderable rows say this
    // and 30 of them were sitting on a social tile, so a customer opening
    // Instagram to buy followers found website traffic among them.
    expect(platformOf('USA Traffic from Instagram [USA 🇺🇸]', 'USA')).toBe('webtraffic');
    expect(platformOf('Website Traffic From Google [WW]', 'Web')).toBe('webtraffic');
    expect(platformOf('Worldwide Traffic from Mixed Social Networks', 'Worldwide')).toBe('webtraffic');
    // And the 65 that named no platform at all reached no tile before this, so
    // they were orderable and unreachable.
    expect(platformOf('🇯🇵 Crypto Niche Traffic from Japan', 'Cryptocurrency')).toBe('webtraffic');
  });

  it('still reads a platform that merely mentions traffic as that platform', () => {
    // The rule is about a source, not the word. These are really LinkedIn and
    // really YouTube, and blunting them to web traffic would be the same bug
    // pointing the other way.
    expect(platformOf('LinkedIn Post Clicks [Organic Traffic]', 'LinkedIn')).toBe('linkedin');
    expect(platformOf('YouTube Views [High Retention Traffic]', 'YouTube')).toBe('youtube');
  });

  it('declines to guess when a name says two platforms', () => {
    // A combo or a mislabel. Guessing the owner is worse than the fallback.
    expect(platformOf('Instagram and TikTok Bundle', 'Other')).toBe(null);
  });

  it('leaves a platform Nitro does not sell off every tile', () => {
    // 685 of these — Chzzk, Rubika, VK, Trovo, PandaTV, GitHub, CoinMarketCap.
    // There is no tile for them, so they belong nowhere rather than somewhere.
    expect(platformOf('VK Live Stream Views [1 Day]', 'VK')).toBe(null);
    expect(platformOf('GitHub Profile Followers', 'Github')).toBe(null);
    expect(platformOf('Chzzk.Naver.com Live Stream Views', 'Chzzk.Naver.com')).toBe(null);
  });
});

describe('Nitro is the seller, not a middleman', () => {
  it('never tells a customer there is a provider behind us', () => {
    // CLAUDE.md forbids exposing provider names. Saying "the provider" exposes
    // something worse than a name: that there is one. The full list's honest
    // distinction is tested versus not yet tested, which is true, is the real
    // difference, and says nothing about where the supply comes from.
    //
    // Only user-facing strings count — the ones inside tr() and msg(). Code
    // comments and variable names describe the supply chain freely.
    const FACING = /\b(?:tr|msg)\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
    const offenders = [];
    for (const file of ['components/full-list.jsx', 'components/new-order.jsx', 'components/order-form.jsx', 'components/order-help.jsx']) {
      const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const m of src.matchAll(FACING)) {
        if (/\bprovider/i.test(m[2])) offenders.push(`${file}: ${m[2].slice(0, 60)}`);
      }
    }
    expect(offenders, `these say "provider" to a customer:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});

// Refill is the most valuable fact on a full-list row and the least reliably
// written. Only 2-4% of services carry the provider's refill=true flag — that
// column is whether the API supports a refill *action*, not what the listing
// promises — so the promise is read off the name, and every spelling counts.
describe('reading the refill promise off a name', () => {
  const attrs = (name) => serviceAttributes(name);

  it('accepts the day shorthand, which 1,389 live services use', () => {
    // "[Refill: 30D]" is as common as "[Refill: 30 Days]". Wanting the whole
    // word made every one of them show as having no refill at all.
    expect(attrs('TikTok Video Share [Max: 100K] [Refill: 30D] 100K/Day')).toContain('30-day refill');
    expect(attrs('Facebook Video Views [Refill: 365D]')).toContain('365-day refill');
    expect(attrs('YouTube Subscribers [Refill: 30 Days] [Low Drop]')).toContain('30-day refill');
  });

  it('accepts the number first and the word after', () => {
    // "30 Days Refill" — a stray space in `day s?` meant the plural never
    // matched, so only the singular "30 Day Refill" was ever read.
    expect(attrs('Google Custom Reviews | USA | 30 Days Refill | Max 100')).toContain('30-day refill');
    expect(attrs('Instagram Likes | 7 Day Refill')).toContain('7-day refill');
  });

  it('accepts lifetime written with or without the space', () => {
    expect(attrs('Snapchat Followers | Lifetime Guaranteed | Speed 500-1K')).toContain('Lifetime guarantee');
    expect(attrs('Audiomack Plays | Germany | Life Time Guarantee | High Quality')).toContain('Lifetime guarantee');
  });

  it('accepts non-drop written either way', () => {
    expect(attrs('Instagram Followers [Non Drop] [Instant Start]')).toContain('Non-drop');
    expect(attrs('Threads Likes [High Quality] [No Drop] [Instant]')).toContain('Non-drop');
  });

  it('does not read a quality claim as a refill promise', () => {
    // "Real User Guarantee" guarantees who the accounts are, not that drops get
    // replaced. 203 services say it and none of them promise a refill.
    const a = attrs('TikTok English Comments | Real User Guarantee | Low Drop | Max 1K');
    expect(a.some(x => /refill|lifetime/i.test(x))).toBe(false);
  });

  it('still reads a plain no-refill listing as no refill', () => {
    expect(attrs('Instagram Followers [HQ Profiles] [Refill: No] [Instant Start]')).toContain('No refill');
    expect(attrs('Instagram Followers [No Refill]')).toContain('No refill');
  });
});

describe('the refill badge and the refill filter agree', () => {
  it('reads the listing, and falls back to the flag only when the name is silent', () => {
    expect(refillOf('Instagram Followers [Refill: 30D]', 'Instagram', false)).toEqual({ refill: true, refillLabel: '30-day refill' });
    expect(refillOf('Snapchat Followers | Lifetime Guaranteed', 'Snapchat', false)).toEqual({ refill: true, refillLabel: 'Lifetime guarantee' });
    expect(refillOf('Instagram Followers [Refill: No]', 'Instagram', true)).toEqual({ refill: false, refillLabel: 'No refill' });
    // Nothing in the name: the provider flag is all there is.
    expect(refillOf('Instagram Followers', 'Instagram', true)).toEqual({ refill: true, refillLabel: null });
    expect(refillOf('Instagram Followers', 'Instagram', false)).toEqual({ refill: false, refillLabel: null });
  });

  it('does not count non-drop as a refill', () => {
    // It promises the numbers should not fall, not that they are replaced if
    // they do. Someone filtering for a refill wants the replacement.
    expect(refillOf('Instagram Followers [Non Drop]', 'Instagram', false)).toEqual({ refill: false, refillLabel: 'Non-drop' });
    expect(refillOf('Threads Likes [No Drop] [Instant]', 'Threads', false).refill).toBe(false);
  });

  it('never lets a row say one thing and filter as another', () => {
    // The bug Trip found on #9364: the listing said no refill, the provider
    // flag said true, the badge read the name and the filter read the flag.
    const rows = [
      { name: 'Instagram Followers [Refill: No] [Instant Start]', refill: true },
      { name: 'Instagram Followers [Refill: 30D]', refill: false },
      { name: 'Instagram Followers', refill: true },
      { name: 'Instagram Followers [Non Drop]', refill: true },
    ];
    for (const r of rows) {
      const { refill, refillLabel } = refillOf(r.name, 'Instagram', r.refill);
      const badgeSaysRefill = refillLabel
        ? !/^no refill$/i.test(refillLabel) && !/non-?drop/i.test(refillLabel)
        : refill;
      expect(badgeSaysRefill, `badge and filter disagree on "${r.name}"`).toBe(refill);
    }
  });
});

describe('the raw catalogue query stays honest', () => {
  const src = () => fs.readFileSync(path.join(process.cwd(), 'app/api/catalogue/full/route.js'), 'utf8');

  it('mirrors FULL_WHERE clause for clause', () => {
    // Raw SQL is not type-checked, so a migration that renames a column or a
    // change to the fence would go unnoticed. This is the mechanism: the SQL
    // has to keep saying what FULL_WHERE says.
    const sql = src();
    expect(sql).toMatch(/s\.provider IN \('mtp', 'dao'\)/);
    expect(sql).toMatch(/s\.platform = /);            // provider
    expect(sql).toMatch(/s\."providerListedAt" IS NOT NULL/);          // providerListedAt
    expect(sql).toMatch(/s\."costPer1k" > 0/);                         // costPer1k
    expect(sql).toMatch(/NOT EXISTS \(SELECT 1 FROM service_tiers/);   // tiers: none
    expect(sql).toMatch(/JOIN reseller_service_map/);                  // resellerMap
    expect(sql).toMatch(/m\."retiredAt" IS NULL/);
    // And the fence it mirrors is still the one the reseller route shares.
    expect(Object.keys(FULL_WHERE).sort()).toEqual(
      ['costPer1k', 'providerListedAt', 'provider', 'resellerMap', 'tiers'].sort(),
    );
  });

  it('casts the BigInt columns, which cannot be serialised raw', () => {
    expect(src()).toMatch(/s\."sellPer1k"::text AS "sellPer1k"/);
    expect(src()).toMatch(/s\."costPer1k"::text AS "costPer1k"/);
    // Number() reads the text form identically, so buildAll needs no change.
    const { rows } = one([{ ...svcBase(), sellPer1k: '350100', costPer1k: '100' }], { usdRate });
    expect(rows[0].price).toBe(3501);
  });

  it('parameterises the one value it interpolates', () => {
    const sql = src().slice(src().indexOf('const sqlFor'), src().indexOf('const nest'));
    // Prisma.sql turns ${} into a bind parameter, so the platform never reaches
    // Postgres as text. It is the only interpolation, and it has already been
    // checked against the tile list before it gets here.
    expect(sql).toMatch(/Prisma\.sql`/);
    expect([...sql.matchAll(/\$\{/g)]).toHaveLength(1);
    expect(sql).toMatch(/WHERE s\.platform = \$\{platform\}/);
  });

  it('filters on the stored platform, and groups by the same value', () => {
    // The column is a cache of platformOf. buildAll prefers it when it is there
    // so a row can never be selected as one platform and grouped under another;
    // it computes from the name when it is absent, which is what every fixture
    // in this file exercises.
    const { rows } = one([{ ...svcBase(), platform: 'tiktok', name: 'Instagram Followers' }], { usdRate });
    expect(rows[0].platform).toBe('tiktok');
    const { rows: computed } = one([{ ...svcBase(), name: 'Instagram Followers' }], { usdRate });
    expect(computed[0].platform).toBe('instagram');
  });

  it('keeps the size clauses an optimisation, never a second rule', () => {
    // The SQL trims ~1,000 rows off the wire, but buildAll still applies
    // isPerItemPackage to everything that arrives. A drift between them can
    // cost bandwidth; it can never change what a customer sees.
    const sql = src();
    expect(sql).toMatch(/s\.max > 20/);
    expect(sql).toMatch(/NOT \(s\.min = s\.max AND s\.max <= 1000\)/);
    // Proof the JS rule still runs: a package that slips past SQL is still cut.
    const { rows, hiddenPackage } = one([{ ...svcBase(), min: 500, max: 500 }], { usdRate });
    expect(rows).toHaveLength(0);
    expect(hiddenPackage).toBe(1);
  });
});

/**
 * What a full list row is allowed to say.
 *
 * A row is for choosing between neighbours; the form is for confirming. So the
 * row carries only what separates one row from the next, and the order range
 * lives in the form, where it already builds the quantity presets and the
 * out-of-range message.
 */
describe('the full list row stays a choosing surface', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'components/full-list.jsx'), 'utf8');
  const row = src.slice(src.indexOf('function Row('), src.indexOf('export default function FullList'));

  it('does not repeat the order range the form already carries', () => {
    // presetsFor(minQty, maxQty) and the "Minimum: N" message are both built
    // from it in order-form, so a chip here was saying it twice.
    expect(row).not.toMatch(/row\.min\.toLocaleString\(\)/);
    expect(row).not.toMatch(/formatMax\(/);
  });

  it('leaves the delivery rate off the row', () => {
    // Trip's call: a throughput claim on a list that says plainly it has tested
    // nothing, and it never changed what anybody ordered.
    expect(row).toMatch(/!\/\\\/day\/i\.test\(a\)/);
  });

  it('keeps refill, and ranks location above everything else left', () => {
    // Refill is the most valuable thing a row without a guarantee can say.
    // Location separates lookalike rows more often than "High quality" does.
    expect(row).toMatch(/RANK = \{ location: 0, quality: 1, speed: 2/);
    expect(row).toMatch(/attrKind\(a\) !== "refill"/);
    expect(row).toMatch(/\.slice\(0, 2\)/);
  });

  it('gives the name the whole first line, with the ID leading the one below', () => {
    const first = row.slice(row.indexOf('{row.label}') - 300, row.indexOf('{row.label}'));
    expect(first, 'the ID must not share the name line').not.toMatch(/#\{row\.id\}/);
    expect(row).toMatch(/#\{row\.id\}/);
  });
});

/**
 * The four controls in the list strip colour when they are doing something,
 * and each takes the colour of what it acts on, so the strip is readable at a
 * glance rather than needing to be read.
 */
describe('the list strip says which controls are on', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'components/full-list.jsx'), 'utf8');

  it('colours the sort once it is off its default', () => {
    // It has no "off" the way Anywhere and Any price do, which is why it had no
    // colour at all — but Cheapest is where the list starts, so anything else
    // is a choice somebody made and should look like one.
    expect(src).toMatch(/const sortChanged = activeSort !== "cheap";/);
    expect(src).toMatch(/borderColor: sortChanged \? t\.accent/);
    // Including the two icons inside it, or half the control lights up.
    expect([...src.matchAll(/color: sortChanged \? t\.accentInk/g)].length).toBeGreaterThanOrEqual(3);
  });

  it('gives each control the colour of what it acts on', () => {
    // Refill green, location blue, price amber, and the accent for sort —
    // because ordering is not a property of a service, it is something we do.
    expect(src).toMatch(/refillOnly \? \(dark \? "#6ee7b7" : "#059669"\)/);
    expect(src).toMatch(/activeLocation !== "any" \? \(dark \? "#7aa2f7" : "#1d5fa5"\)/);
    expect(src).toMatch(/band \? \(dark \? "#e0a458" : "#b45309"\)/);
  });

  it('says most expensive, not dearest', () => {
    // "Dearest" is British for costly and reads as a letter greeting to a
    // Nigerian customer. The Pidgin translation already said "Most expensive",
    // so the English was the odd one out.
    expect(src).toMatch(/msg\("Most expensive"\)/);
    expect(src).not.toMatch(/Dearest/);
  });
});
