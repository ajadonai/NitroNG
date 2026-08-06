import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  awardPointsOnCompletion: vi.fn(),
}));

vi.mock('@/lib/drip-feed', () => ({
  getDripConfig: vi.fn(),
  rescheduleRemaining: vi.fn(),
}));

vi.mock('@/lib/nitro-rewards', () => ({
  awardPointsOnCompletion: (...args) => mocks.awardPointsOnCompletion(...args),
}));

const { applyDripRollup } = await import('@/lib/drip-completion');

const completedDispatches = [
  {
    status: 'completed',
    quantity: 500,
    remains: 0,
    startCount: 100,
    day: 1,
    batch: 1,
    lastError: null,
  },
];

function makeHarness(account) {
  const events = [];
  const orderFindUnique = vi.fn(async () => {
    events.push('owner-read');
    return { userId: 'user-1' };
  });
  const orderUpdateMany = vi.fn(async () => {
    events.push('parent-update');
    return { count: 1 };
  });
  const queryRaw = vi.fn(async (strings) => {
    const sql = strings.join(' ');
    if (sql.includes('FROM users')) {
      events.push('user-lock');
      return account ? [account] : [];
    }
    if (sql.includes('FROM "orders"')) {
      events.push('parent-lock');
      return [{ id: 'order-1', userId: 'user-1', status: 'Processing', deletedAt: null }];
    }
    if (sql.includes('FROM "drip_dispatches"')) {
      events.push('children-lock');
      return completedDispatches;
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  const tx = {
    order: {
      findUnique: orderFindUnique,
      updateMany: orderUpdateMany,
    },
    $queryRaw: queryRaw,
  };
  const prisma = {
    order: tx.order,
    $transaction: vi.fn(callback => callback(tx)),
  };

  return { events, orderFindUnique, orderUpdateMany, prisma, queryRaw, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.awardPointsOnCompletion.mockResolvedValue(0);
});

describe('applyDripRollup account-deletion serialization', () => {
  it.each(['Active', 'Suspended'])('locks an eligible %s owner before the parent and children', async (status) => {
    const harness = makeHarness({
      id: 'user-1',
      status,
      deletedAt: null,
      anonymizedAt: null,
    });

    const result = await applyDripRollup(
      harness.prisma,
      'order-1',
      completedDispatches,
      'Processing',
    );

    expect(result).toMatchObject({ status: 'Completed', remains: 0, startCount: 100 });
    expect(harness.events).toEqual([
      'owner-read',
      'user-lock',
      'parent-lock',
      'children-lock',
      'parent-update',
    ]);
    expect(mocks.awardPointsOnCompletion).toHaveBeenCalledWith('order-1', harness.tx);
  });

  it.each([
    ['PendingDeletion', {
      id: 'user-1',
      status: 'PendingDeletion',
      deletedAt: new Date('2026-08-06T00:00:00.000Z'),
      anonymizedAt: null,
    }],
    ['Deleted', {
      id: 'user-1',
      status: 'Deleted',
      deletedAt: new Date('2026-08-01T00:00:00.000Z'),
      anonymizedAt: null,
    }],
    ['anonymized', {
      id: 'user-1',
      status: 'Active',
      deletedAt: null,
      anonymizedAt: new Date('2026-08-01T00:00:00.000Z'),
    }],
  ])('does nothing for a %s account', async (_label, account) => {
    const harness = makeHarness(account);

    await expect(applyDripRollup(
      harness.prisma,
      'order-1',
      completedDispatches,
      'Processing',
    )).resolves.toBeNull();

    expect(harness.events).toEqual(['owner-read', 'user-lock']);
    expect(harness.orderUpdateMany).not.toHaveBeenCalled();
    expect(mocks.awardPointsOnCompletion).not.toHaveBeenCalled();
  });
});
