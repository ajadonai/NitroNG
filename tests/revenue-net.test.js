import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRevenue, refundOrderCode, DEAD_STATES } from '@/lib/revenue';

const db = {
  order: { aggregate: vi.fn(), findMany: vi.fn() },
  transaction: { findMany: vi.fn() },
};
const money = (charge, cost, count = 1) => ({ _sum: { charge, cost }, _count: count });

beforeEach(() => {
  vi.clearAllMocks();
  db.order.aggregate.mockImplementation(({ where }) =>
    Promise.resolve(where.status?.in ? money(null, 0) : money(1000000, 400000, 10)));
  db.order.findMany.mockResolvedValue([]);
  db.transaction.findMany.mockResolvedValue([]);
});

describe('refundOrderCode', () => {
  it('reads every reference shape we have written', () => {
    expect(refundOrderCode({ reference: 'REF-NTR-7919' })).toBe('NTR-7919');
    expect(refundOrderCode({ reference: 'ADM-REF-NTR-7919' })).toBe('NTR-7919');
    expect(refundOrderCode({ reference: 'SPLIT-FIX-NTR-2776-REF' })).toBe('NTR-2776');
  });
  it('falls back to the order code in the note', () => {
    expect(refundOrderCode({ reference: '', note: 'Refund for NTR-1127 (admin cancelled)' })).toBe('NTR-1127');
    expect(refundOrderCode({ reference: null, note: 'NTR-2914 drip 4 cancelled' })).toBe('NTR-2914');
  });
  it('returns null when there is nothing to match', () => {
    expect(refundOrderCode({ reference: 'DEP-123', note: 'wallet top-up reversal' })).toBeNull();
    expect(refundOrderCode({})).toBeNull();
  });
});

describe('getRevenue', () => {
  it('nets refunds off gross and reports both margins', async () => {
    db.transaction.findMany.mockResolvedValue([{ amount: 100000, reference: 'REF-NTR-1', note: '' }]);
    db.order.findMany.mockResolvedValue([{ orderId: 'NTR-1', status: 'Partial' }]);
    const r = await getRevenue({ db });
    expect(r.gross).toBe(10000);
    expect(r.refunds).toBe(1000);
    expect(r.net).toBe(9000);
    expect(r.grossMargin).toBeCloseTo(60, 5);
    expect(r.netMargin).toBeCloseTo(((9000 - 4000) / 9000) * 100, 5);
  });

  it('does not subtract a refund on a cancelled order: that charge was never revenue', async () => {
    db.transaction.findMany.mockResolvedValue([
      { amount: 500000, reference: 'REF-NTR-9001', note: '' },
      { amount: 100000, reference: 'REF-NTR-9002', note: '' },
    ]);
    db.order.findMany.mockResolvedValue([
      { orderId: 'NTR-9001', status: 'Cancelled' },
      { orderId: 'NTR-9002', status: 'Completed' },
    ]);
    const r = await getRevenue({ db });
    expect(r.refunds).toBe(1000);       // only the live one
    expect(r.refundCount).toBe(1);
    expect(r.net).toBe(9000);
  });

  it.each(DEAD_STATES)('ignores refunds against %s orders', async (status) => {
    db.transaction.findMany.mockResolvedValue([{ amount: 500000, reference: 'REF-NTR-9003', note: '' }]);
    db.order.findMany.mockResolvedValue([{ orderId: 'NTR-9003', status }]);
    const r = await getRevenue({ db });
    expect(r.refunds).toBe(0);
    expect(r.net).toBe(r.gross);
  });

  it('subtracts a refund it cannot match, and says so', async () => {
    db.transaction.findMany.mockResolvedValue([{ amount: 100000, reference: 'MYSTERY', note: 'goodwill' }]);
    const r = await getRevenue({ db });
    expect(r.refunds).toBe(1000);
    expect(r.unmatchedRefunds).toBe(1);
  });

  it('counts provider cost on orders that died after dispatch, and only those', async () => {
    db.order.aggregate.mockImplementation(({ where }) => {
      if (where.status?.in) {
        expect(where.apiOrderId).toEqual({ not: null });
        return Promise.resolve(money(null, 50000));
      }
      return Promise.resolve(money(1000000, 400000, 10));
    });
    const r = await getRevenue({ db });
    expect(r.costWasted).toBe(500);
    expect(r.netMargin).toBeCloseTo(((10000 - 4000 - 500) / 10000) * 100, 5);
  });

  it('asks only for Completed refunds', async () => {
    await getRevenue({ db });
    expect(db.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'Completed', type: { in: ['refund', 'Refund'] } }),
    }));
  });
});
