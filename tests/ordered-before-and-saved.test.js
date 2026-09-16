import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTR_SHORT } from '@/lib/service-attrs';
import { serviceAttributes } from '@/lib/reseller-format';

const mockPrisma = {
  order: { groupBy: vi.fn() },
  serviceTier: { findMany: vi.fn() },
  resellerServiceMap: { findMany: vi.fn(), findUnique: vi.fn() },
  serviceFavourite: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
const getCurrentUser = vi.fn();
vi.mock('@/lib/auth', () => ({ getCurrentUser }));

const { GET } = await import('@/app/api/orders/mine/route');
const { POST } = await import('@/app/api/catalogue/full/save/route');

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
const call = async () => { const r = await GET(); return { status: r.status, body: await r.json() }; };
const save = async (body) => {
  const r = await POST(new Request('http://x/api/catalogue/full/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: r.status, body: await r.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: 'u1' });
  mockPrisma.order.groupBy.mockResolvedValue([]);
  mockPrisma.serviceTier.findMany.mockResolvedValue([]);
  mockPrisma.resellerServiceMap.findMany.mockResolvedValue([]);
  mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ serviceId: 's9', retiredAt: null });
  mockPrisma.serviceFavourite.findMany.mockResolvedValue([]);
});

/**
 * "Take me back to the one I used" gets two answers because the two lists do
 * not have the same problem. Nitro picks is nineteen services holding 10,315 of
 * the 10,488 orders — history answers it there on day one. The full list is 934
 * services with 109 orders — only a saved star answers it there today.
 */
describe('ordered before', () => {
  it('keys full-list history by the public ID the row shows', async () => {
    mockPrisma.order.groupBy.mockResolvedValue([{ serviceId: 's9', _count: { _all: 2 } }]);
    mockPrisma.resellerServiceMap.findMany.mockResolvedValue([{ apiId: 3624, serviceId: 's9' }]);
    const r = await call();
    expect(r.body.services['3624'].times).toBe(2);
    // Never the internal id, which no customer has ever seen.
    expect(Object.keys(r.body.services)).not.toContain('s9');
  });

  it('asks only about full-list orders, never the curated ones', () => {
    // Picks carried this briefly and should not have: nineteen services fit on
    // one screen, so "find it again" is not a problem there.
    const route = read('app/api/orders/mine/route.js');
    expect(route).toMatch(/tierId: null/);
    expect(route, 'no tier grouping, no group folding').not.toMatch(/by: \['tierId'\]|groupId/);
  });

  it('counts, and does not date', () => {
    // "last week" does not change what anybody orders; "you bought this twice"
    // says the one useful thing.
    const route = read('app/api/orders/mine/route.js');
    expect(route).not.toMatch(/_max|createdAt: true|lastAt/);
    expect(read('components/full-list.jsx')).not.toMatch(/agoLabel|lastAt/);
    expect(read('components/new-order.jsx')).not.toMatch(/agoLabel/);
  });

  it('answers empty for somebody who has never ordered', async () => {
    const r = await call();
    expect(r.body).toEqual({ services: {}, saved: [] });
  });

  it('turns away anyone not signed in', async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });
});

describe('saved services', () => {
  it('does not ask anyone to have ordered it first', async () => {
    // The opposite of a vote, deliberately. A vote is a claim other customers
    // read so it has to be earned; keeping something is private and is most
    // useful for the service you have not bought yet.
    const r = await save({ id: 3624, on: true });
    expect(r.status).toBe(200);
    expect(mockPrisma.serviceFavourite.upsert).toHaveBeenCalled();
    expect(mockPrisma.order.groupBy).not.toHaveBeenCalled();
  });

  it('treats saving twice as saving once', async () => {
    await save({ id: 3624, on: true });
    const arg = mockPrisma.serviceFavourite.upsert.mock.calls[0][0];
    expect(arg.update).toEqual({});
    expect(arg.where).toEqual({ userId_serviceId: { userId: 'u1', serviceId: 's9' } });
  });

  it('removes it on the way back', async () => {
    const r = await save({ id: 3624, on: false });
    expect(r.body).toEqual({ id: 3624, saved: false });
    expect(mockPrisma.serviceFavourite.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', serviceId: 's9' } });
  });

  it('refuses a retired service, so a saved list cannot fill with ghosts', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ serviceId: 's9', retiredAt: new Date() });
    expect((await save({ id: 3624, on: true })).status).toBe(400);
  });

  it('refuses anything that is not an id and a boolean', async () => {
    for (const bad of [{ id: 'abc', on: true }, { id: 3624, on: 'yes' }, { id: 3624 }, {}]) {
      expect((await save(bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('turns away anyone not signed in', async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await save({ id: 3624, on: true })).status).toBe(401);
  });
});

describe('where each one is offered', () => {
  const full = read('components/full-list.jsx');
  const order = read('components/new-order.jsx');

  it('puts the star on the full list and nowhere else', () => {
    // Nineteen curated picks are already a shortlist; a shortlist of a
    // shortlist helps nobody. 934 is the problem the star exists for.
    expect(full).toMatch(/onToggleSaved\(row\.id, !saved\)/);
    const card = order.slice(order.indexOf('function ServiceCard('), order.indexOf('function compactPrice'));
    expect(card, 'the picks card should carry no star').not.toMatch(/onToggleSaved|polygon points="12 2 15\.09/);
  });

  it('shows ordered-before on the full list and not on the picks', () => {
    // 934 rows is a finding problem; 19 on one screen is not.
    expect(full).toMatch(/times > 0 &&/);
    expect(order, 'the picks card should carry no ordered marker').not.toMatch(/history\?\.times/);
  });

  it('hides a personal filter until it would return something', () => {
    // On day one a Saved tab is empty for every customer alive, and an option
    // that returns nothing is a dead end dressed as a choice.
    expect(full).toMatch(/const mineTabs = useMemo\(\(\) => MINE_ROW\.filter/);
    expect(full).toMatch(/savedSet\.has\(r\.id\) : history\[r\.id\]\?\.times > 0/);
  });

  it('keeps the star out of the row tap that opens an order', () => {
    expect(full).toMatch(/onClick=\{e => \{ e\.stopPropagation\(\); onToggleSaved/);
  });
});

/**
 * "Most liked" is the only endorsement the full list carries that does not come
 * from Nitro, so it gets a control of its own — under the same rule as the
 * others: it appears when it has something to say and not before.
 */
describe('the most liked filter', () => {
  const full = read('components/full-list.jsx');

  it('means the same thing the row already means by a green thumb', () => {
    // A filter and a badge disagreeing about what counts as liked is how people
    // stop trusting both.
    expect(full).toMatch(/export const WELL_LIKED = 80;/);
    expect(full).toMatch(/approvalOf\(r\) >= WELL_LIKED/);
    // The row's own green threshold, unchanged.
    expect(full).toMatch(/approval >= 80/);
  });

  it('is not offered while no service could clear the bar', () => {
    // No votes have been cast yet, so today this would be empty for everyone —
    // the same reason the Saved tab and the Best rated sort hide themselves.
    expect(full).toMatch(/const hasLiked = useMemo\(\(\) => all\.some\(r => approvalOf\(r\) >= WELL_LIKED\)/);
    expect(full).toMatch(/\{hasLiked && \(/);
    // And a stale selection cannot survive a platform that has nothing rated.
    expect(full).toMatch(/const likedOn = likedOnly && hasLiked;/);
  });

  it('counts as a filter, not a sort', () => {
    // It decides what is in the list. Best rated, which orders it, stays in the
    // sort — two controls, two jobs, the mistake "Refill first" was removed for.
    // It sits in NARROW, the named list of things that decide what is in the
    // list — which is also what lets a dropdown count itself out when working
    // out which of its own options are still reachable.
    expect(full).toMatch(/out\.push\(\["liked", r => approvalOf\(r\) >= WELL_LIKED\]\)/);
    expect(full).toMatch(/\{ key: "rated", label: msg\("Best rated"\), needsVotes: true \}/);
  });

  it('offers a way back out of it', () => {
    expect(full).toMatch(/\{likedOn && <button onClick=\{\(\) => setLikedOnly\(false\)\}/);
  });
});

/**
 * The mobile filters carry a mark, not just a word.
 *
 * "Saved" and "Ordered before" sat as plain text in their own row on a phone,
 * which is the one place they are not reinforced by anything else on screen.
 * The icons are the exact marks the rows already use — the star you tap to
 * save, the clock on the "Ordered 2×" badge — so the filter and the thing it
 * filters by read as one idea.
 */
describe('the saved and ordered filters are recognisable on a phone', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'components/full-list.jsx'), 'utf8');

  it('borrows the marks the rows already carry, rather than inventing any', () => {
    const map = src.slice(src.indexOf('const MINE_ICON = {'), src.indexOf('const MINE_ROW = ['));
    // The star on the save control.
    expect(map).toMatch(/polygon points="12 2 15\.09 8\.26 22 9\.27/);
    expect(src.slice(src.indexOf('function Row('))).toMatch(/polygon points="12 2 15\.09 8\.26 22 9\.27/);
    // The clock on the ordered-before badge.
    expect(map).toMatch(/polyline points="12 6 12 12 16 14"/);
  });

  it('puts them on both the phone row and the desktop strip', () => {
    // Phone-only was the first attempt, on the reasoning that these sit beside
    // eight icon-less type tabs. They do not: a divider separates them up
    // there, so they are their own group at both sizes.
    expect([...src.matchAll(/MINE_ICON\[m\.key\]/g)]).toHaveLength(2);
  });

  it('centres the desktop chip, since a glyph has no baseline to sit on', () => {
    const strip = src.slice(src.indexOf('{mineTabs.map(m => {'));
    expect(strip.slice(0, 900)).toMatch(/inline-flex items-center gap-1\.5/);
  });

  it('keeps both filters mapped, so neither can go plain again', () => {
    const map = src.slice(src.indexOf('const MINE_ICON = {'), src.indexOf('const MINE_ROW = ['));
    for (const key of ['ordered', 'saved']) expect(map).toContain(`${key}:`);
  });
});

/**
 * A dropdown may only offer what tapping it would actually leave.
 *
 * Both menus used to count the whole platform. With Followers and "under
 * ₦1,000" already on, the origin menu still offered Turkish because the
 * platform carried forty Turkish services somewhere — and tapping it emptied
 * the list. The counts are taken against every other active filter now, with
 * the facet's own filter left out, because counting Turkish against Turkish
 * only ever returns "all of them".
 */
describe('the filter menus offer only what is reachable', () => {
  const full = read('components/full-list.jsx');
  it('counts a facet against everything except itself', () => {
    expect(full).toMatch(/const facet = useCallback\(\(except\) => \{/);
    expect(full).toMatch(/NARROW\.filter\(\(\[k\]\) => k !== except\)/);
    // And the type applies, because a menu above a list of Followers has to
    // describe Followers — except during a search, which is platform-wide.
    expect(full).toMatch(/return q \|\| type === "all" \? l : l\.filter\(r => r\.type === type\);/);
  });

  it('counts the origin menu and the price menu off that, not off the platform', () => {
    expect(full).toMatch(/const rows = facet\("location"\);/);
    expect(full).toMatch(/const rows = facet\("price"\);/);
  });

  it('keeps a chosen option listed even when nothing is left under it', () => {
    // A select showing a value absent from its own options is worse than a
    // zero, and the empty state already offers the way back out.
    expect(full).toMatch(/\.filter\(\(\[k, c\]\) => c > 0 \|\| k === activeLocation\)/);
    expect(full).toMatch(/offeredBands\.filter\(b => b\.key === activePrice \|\|/);
  });

  it('still validates a stored choice against the platform, not the facet', () => {
    // Otherwise tapping a price band would silently reset the origin, because
    // the origin briefly stopped being offered.
    expect(full).toMatch(/const activeLocation = offeredLocations\.some/);
    expect(full).toMatch(/const activePrice = offeredBands\.some/);
  });
});

/**
 * One control over both grades. A provider writes the top grade three ways and
 * the ordinary one two; somebody filtering for quality does not want the best
 * services dropped because they picked the other word.
 */
describe('the quality filter', () => {
  const full = read('components/full-list.jsx');
  const attrs = read('lib/service-attrs.js');
  it('covers both grades from one list', () => {
    expect(attrs).toMatch(/export const QUALITY_ATTRS = \['Ultra high quality', 'High quality'\];/);
    expect(full).toMatch(/out\.push\(\["quality", r => isGraded\(r\.attrs\)\]\)/);
  });

  it('is not offered on a platform carrying no graded service', () => {
    expect(full).toMatch(/const hasQuality = useMemo\(\(\) => all\.some\(r => isGraded\(r\.attrs\)\), \[all\]\);/);
    expect(full).toMatch(/const qualityOn = qualityOnly && hasQuality;/);
    expect(full).toMatch(/\{hasQuality && \(/);
  });

  it('offers a way back out of it', () => {
    expect(full).toMatch(/\{qualityOn && <button onClick=\{\(\) => setQualityOnly\(false\)\}/);
  });
});

/**
 * The abbreviation belongs to the narrow screen, not to the vocabulary. The
 * reseller API sends "Ultra high quality"; a 360px row shows UHQ.
 */
describe('the grade badges', () => {
  const full = read('components/full-list.jsx');
  const attrs = read('lib/service-attrs.js');
  it('abbreviates in CSS rather than by measuring the viewport', () => {
    // The row is server-rendered. A width read on the client would hydrate
    // with whichever form the server guessed.
    expect(full).toMatch(/<span className="max-md:hidden">\{attr\}<\/span>/);
    expect(full).toMatch(/<span className="md:hidden" title=\{attr\}>\{short\}<\/span>/);
  });

  it('shortens only the three that do not fit', () => {
    expect(attrs).toMatch(/'Lifetime guarantee': 'Lifetime'/);
    expect(attrs).toMatch(/'Ultra high quality': 'UHQ'/);
    expect(attrs).toMatch(/'High quality': 'HQ'/);
  });

  it('leaves the full wording to the API and the wide screen', () => {
    // "Lifetime" on a phone is a trim, not a rename: serviceAttributes still
    // writes "Lifetime guarantee", which is what a reseller reads.
    expect(serviceAttributes('Spotify Plays | Lifetime Guaranteed')).toContain('Lifetime guarantee');
    expect(Object.keys(ATTR_SHORT)).toEqual(['Lifetime guarantee', 'Ultra high quality', 'High quality']);
  });
});
