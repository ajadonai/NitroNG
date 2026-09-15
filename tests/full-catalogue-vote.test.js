import { beforeEach, describe, expect, it, vi } from 'vitest';

// The full list carries no Nitro testing and no delivery history, so the vote
// is the only figure on it that means anything. That makes who may cast one the
// whole design: someone who has actually ordered the service, once, changeable.

const mockPrisma = {
  resellerServiceMap: { findUnique: vi.fn() },
  order: { findFirst: vi.fn() },
  serviceVote: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), groupBy: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
const getCurrentUser = vi.fn();
vi.mock('@/lib/auth', () => ({ getCurrentUser }));

const { POST } = await import('@/app/api/catalogue/full/vote/route');

const call = async (body) => {
  const res = await POST(new Request('http://x/api/catalogue/full/vote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: 'u1' });
  mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ serviceId: 's9', retiredAt: null });
  mockPrisma.order.findFirst.mockResolvedValue({ id: 'o1' });
  mockPrisma.serviceVote.findUnique.mockResolvedValue(null);
  mockPrisma.serviceVote.groupBy.mockResolvedValue([{ serviceId: 's9', _count: { _all: 3 }, _sum: { value: 1 } }]);
});

describe('who may rate a full-list service', () => {
  it('turns away anyone not signed in', async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await call({ id: 2440, vote: 'up' })).status).toBe(401);
    expect(mockPrisma.serviceVote.create).not.toHaveBeenCalled();
  });

  it('turns away someone who has never ordered it', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    const r = await call({ id: 2440, vote: 'up' });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('Order it first, then you can rate it');
    expect(mockPrisma.serviceVote.create).not.toHaveBeenCalled();
  });

  it('refuses a retired or unknown service ID', async () => {
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue({ serviceId: 's9', retiredAt: new Date() });
    expect((await call({ id: 2440, vote: 'up' })).status).toBe(400);
    mockPrisma.resellerServiceMap.findUnique.mockResolvedValue(null);
    expect((await call({ id: 9999, vote: 'up' })).status).toBe(400);
  });

  it('refuses anything that is not a thumb', async () => {
    for (const bad of [undefined, null, 'maybe', 1, '', 'UP']) {
      expect((await call({ id: 2440, vote: bad })).status, `accepted ${JSON.stringify(bad)}`).toBe(400);
    }
    expect((await call({ id: 'abc', vote: 'up' })).status).toBe(400);
  });
});

describe('casting, changing and clearing', () => {
  it('records a first vote and answers with the new tally', async () => {
    const r = await call({ id: 2440, vote: 'up' });
    expect(r.status).toBe(200);
    expect(mockPrisma.serviceVote.create).toHaveBeenCalledWith({ data: { userId: 'u1', serviceId: 's9', value: 1 } });
    // 3 votes summing to 1 is two up and one down.
    expect(r.body).toEqual({ id: 2440, up: 2, down: 1, mine: 'up' });
  });

  it('changes a mind rather than stacking a second row', async () => {
    mockPrisma.serviceVote.findUnique.mockResolvedValue({ id: 'v1', value: 1 });
    const r = await call({ id: 2440, vote: 'down' });
    expect(mockPrisma.serviceVote.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { value: -1 } });
    expect(mockPrisma.serviceVote.create).not.toHaveBeenCalled();
    expect(r.body.mine).toBe('down');
  });

  it('clears the vote when the same thumb is sent again', async () => {
    // The thumb you already hold is the toggle — there is no separate undo.
    mockPrisma.serviceVote.findUnique.mockResolvedValue({ id: 'v1', value: -1 });
    const r = await call({ id: 2440, vote: 'down' });
    expect(mockPrisma.serviceVote.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
    expect(r.body.mine).toBe(null);
  });

  it('reads an empty tally as no votes, not as a crash', async () => {
    mockPrisma.serviceVote.groupBy.mockResolvedValue([]);
    const r = await call({ id: 2440, vote: 'up' });
    expect(r.body).toEqual({ id: 2440, up: 0, down: 0, mine: 'up' });
  });
});
