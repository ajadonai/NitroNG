import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real lib/prisma.js patches BigInt serialization globally; the prisma
// mock below bypasses that module, so the route would 500 on BigInt fields.
BigInt.prototype.toJSON = function () { return Number(this); };

const logActivity = vi.fn();
const prisma = {
  $transaction: vi.fn(arg => typeof arg === 'function' ? arg(prisma) : Promise.all(arg)),
  serviceTier: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  priceChange: {
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  setting: { findMany: vi.fn().mockResolvedValue([]) },
};

vi.mock('next/cache', () => ({ unstable_cache: fn => fn, revalidateTag: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('@/lib/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ admin: { name: 'Owner' }, error: null }),
  logActivity,
}));

const { POST } = await import('@/app/api/admin/service-groups/route');

function mutation(body) {
  return POST(new Request('http://localhost/api/admin/service-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(arg => typeof arg === 'function' ? arg(prisma) : Promise.all(arg));
  prisma.serviceTier.update.mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data }));
});

describe('swap-tier-order', () => {
  it('swaps two tiers that share a sortOrder by renumbering the whole group', async () => {
    // The pre-ordering world: every tier sits at sortOrder 0, so the old
    // swap-the-numbers approach moved nothing. The fix renumbers by display
    // order and swaps positions.
    prisma.serviceTier.findUnique
      .mockResolvedValueOnce({ id: 'a', groupId: 'g1' })
      .mockResolvedValueOnce({ id: 'b', groupId: 'g1' });
    prisma.serviceTier.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    const res = await mutation({ action: 'swap-tier-order', tierA: 'a', tierB: 'b' });
    expect(res.status).toBe(200);

    const writes = prisma.serviceTier.update.mock.calls.map(([arg]) => [arg.where.id, arg.data.sortOrder]);
    expect(writes).toEqual([['b', 0], ['a', 1], ['c', 2]]);
  });

  it('refuses to swap tiers from different groups', async () => {
    prisma.serviceTier.findUnique
      .mockResolvedValueOnce({ id: 'a', groupId: 'g1' })
      .mockResolvedValueOnce({ id: 'b', groupId: 'g2' });

    const res = await mutation({ action: 'swap-tier-order', tierA: 'a', tierB: 'b' });
    expect(res.status).toBe(400);
    expect(prisma.serviceTier.update).not.toHaveBeenCalled();
  });
});

describe('recalculate-prices honours pins', () => {
  it('never touches a pinned tier and says how many it held', async () => {
    // The nightly sync always skipped pins; the button silently overwrote
    // them — five live pinned prices were flattened before this guard.
    prisma.setting.findMany.mockResolvedValue([]);
    prisma.serviceTier.findMany.mockResolvedValue([
      { id: 'pinned', tier: 'Premium', sellPer1k: 800000n, pricePinned: true, service: { costPer1k: 100, provider: 'mtp' }, group: { nigerian: false, name: 'G', platform: 'P' } },
      { id: 'free', tier: 'Budget', sellPer1k: 1n, pricePinned: false, service: { costPer1k: 100, provider: 'mtp' }, group: { nigerian: false, name: 'G', platform: 'P' } },
    ]);

    const res = await mutation({ action: 'recalculate-prices' });
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.pinnedHeld).toBe(1);
    const touched = prisma.serviceTier.update.mock.calls.map(([arg]) => arg.where.id);
    expect(touched).not.toContain('pinned');
    expect(touched).toContain('free');
  });
});

describe('price change recording', () => {
  it('records a price change when a tier price is edited by hand', async () => {
    prisma.serviceTier.findUnique.mockResolvedValueOnce({
      sellPer1k: 500000n,
      tier: 'Standard',
      group: { name: 'Instagram Followers', platform: 'Instagram' },
      service: { provider: 'mtp', costPer1k: 120n },
    });
    prisma.serviceTier.update.mockResolvedValueOnce({ id: 'tier-1', tier: 'Standard', sellPer1k: 600000n });

    const res = await mutation({ action: 'update-tier', tierIdToUpdate: 'tier-1', sellPer1k: 600000 });
    expect(res.status).toBe(200);
    expect(prisma.priceChange.createMany).toHaveBeenCalledTimes(1);
    const rows = prisma.priceChange.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tierId: 'tier-1',
      groupName: 'Instagram Followers',
      platform: 'Instagram',
      oldSell: 500000,
      newSell: 600000,
      source: 'manual',
      actor: 'Owner',
    });
  });

  it('does not record when the edit leaves the price unchanged', async () => {
    prisma.serviceTier.findUnique.mockResolvedValueOnce({
      sellPer1k: 500000n,
      tier: 'Standard',
      group: { name: 'Instagram Followers', platform: 'Instagram' },
      service: null,
    });
    prisma.serviceTier.update.mockResolvedValueOnce({ id: 'tier-1', tier: 'Standard', sellPer1k: 500000n });

    const res = await mutation({ action: 'update-tier', tierIdToUpdate: 'tier-1', sellPer1k: 500000 });
    expect(res.status).toBe(200);
    expect(prisma.priceChange.createMany).not.toHaveBeenCalled();
  });
});
