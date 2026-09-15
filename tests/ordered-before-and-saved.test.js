import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(full).toMatch(/if \(likedOn\) l = l\.filter/);
    expect(full).toMatch(/\{ key: "rated", label: msg\("Best rated"\), needsVotes: true \}/);
  });

  it('offers a way back out of it', () => {
    expect(full).toMatch(/\{likedOn && <button onClick=\{\(\) => setLikedOnly\(false\)\}/);
  });
});
