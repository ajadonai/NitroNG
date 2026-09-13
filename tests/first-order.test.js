import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  orderCount: vi.fn(),
  userFindUnique: vi.fn(),
  tgOutreachAlert: vi.fn(),
  sendOutreach: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: { order: { count: mocks.orderCount }, user: { findUnique: mocks.userFindUnique } },
}));
vi.mock('@/lib/telegram', () => ({ tgOutreachAlert: (...a) => mocks.tgOutreachAlert(...a) }));
vi.mock('@/lib/ify/outreach', () => ({ sendOutreach: (...a) => mocks.sendOutreach(...a) }));

const { checkFirstOrder } = await import('@/lib/first-order');
const grace = { name: 'Grace', email: 'g@example.test', phone: '+2348031234567', createdAt: new Date('2026-09-01T00:00:00Z') };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tgOutreachAlert.mockResolvedValue();
  mocks.sendOutreach.mockResolvedValue();
  mocks.userFindUnique.mockResolvedValue(grace);
});

describe('checkFirstOrder', () => {
  it('fires both outreach hooks on a first single order', async () => {
    mocks.orderCount.mockResolvedValue(1);
    await checkFirstOrder('u1', 'Instagram Followers');
    expect(mocks.tgOutreachAlert).toHaveBeenCalledWith(grace, 'firstOrder', { serviceName: 'Instagram Followers' });
    expect(mocks.sendOutreach).toHaveBeenCalledWith({ user: { id: 'u1', ...grace }, trigger: 'firstOrder', extra: { serviceName: 'Instagram Followers' } });
  });

  it('recognises a first purchase that was a cart — N rows created at once', async () => {
    // The old `count === 1` check missed every customer whose first order was bulk.
    mocks.orderCount.mockResolvedValue(3);
    await checkFirstOrder('u1', 'Bulk order', 3);
    expect(mocks.tgOutreachAlert).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on a repeat customer', async () => {
    mocks.orderCount.mockResolvedValue(2);
    await checkFirstOrder('u1', 'Anything');
    expect(mocks.tgOutreachAlert).not.toHaveBeenCalled();
    expect(mocks.sendOutreach).not.toHaveBeenCalled();
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it('stays quiet when the account is gone, and never throws', async () => {
    mocks.orderCount.mockResolvedValue(1);
    mocks.userFindUnique.mockResolvedValue(null);
    await expect(checkFirstOrder('u1', 'X')).resolves.toBeUndefined();
    expect(mocks.tgOutreachAlert).not.toHaveBeenCalled();
    mocks.orderCount.mockRejectedValue(new Error('db down'));
    await expect(checkFirstOrder('u1', 'X')).resolves.toBeUndefined();
  });
});
