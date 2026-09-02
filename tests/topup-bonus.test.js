import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RUNGS,
  applyTopupBonus,
  countedMonthTotal,
  crossedRungs,
  getTopupProgress,
  lagosMonth,
  topupBonusSettings,
} from '@/lib/topup-bonus';

vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn() } }));

function mockDb({ settings = [], reseller = null, firstDeposit = null, monthSum = 0, existingKeys = [] } = {}) {
  return {
    setting: { findMany: vi.fn().mockResolvedValue(settings) },
    resellerProfile: { findUnique: vi.fn().mockResolvedValue(reseller) },
    transaction: {
      findFirst: vi.fn().mockResolvedValue(firstDeposit),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: monthSum } }),
      findMany: vi.fn().mockResolvedValue(existingKeys.map(k => ({ idempotencyKey: k, amount: 150000 }))),
      create: vi.fn().mockResolvedValue({}),
    },
    user: { update: vi.fn().mockResolvedValue({}) },
    bonusCredit: { create: vi.fn().mockResolvedValue({}) },
  };
}

const ENABLED = [{ key: 'topup_bonus_enabled', value: 'true' }];

beforeEach(() => vi.clearAllMocks());

describe('lagosMonth', () => {
  it('buckets by Lagos time, not UTC', () => {
    // 23:30 Lagos on 31 Aug is 22:30 UTC — still August.
    expect(lagosMonth(new Date('2026-08-31T22:30:00Z')).key).toBe('2026-08');
    // 00:30 Lagos on 1 Sep is 23:30 UTC on 31 Aug — already September.
    expect(lagosMonth(new Date('2026-08-31T23:30:00Z')).key).toBe('2026-09');
  });

  it('month window is [start, end) in UTC shifted by the Lagos offset', () => {
    const m = lagosMonth(new Date('2026-09-15T12:00:00Z'));
    expect(m.start.toISOString()).toBe('2026-08-31T23:00:00.000Z');
    expect(m.end.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(m.name).toBe('September');
  });
});

describe('crossedRungs', () => {
  it('is exact at the boundaries', () => {
    expect(crossedRungs(2999900, DEFAULT_RUNGS)).toHaveLength(0);
    expect(crossedRungs(3000000, DEFAULT_RUNGS)).toHaveLength(1);
    expect(crossedRungs(9999900, DEFAULT_RUNGS)).toHaveLength(2);
    expect(crossedRungs(10000000, DEFAULT_RUNGS)).toHaveLength(3);
  });
});

describe('topupBonusSettings', () => {
  it('ships dark: disabled with default rungs when no settings exist', async () => {
    const cfg = await topupBonusSettings(mockDb());
    expect(cfg.enabled).toBe(false);
    expect(cfg.rungs).toEqual(DEFAULT_RUNGS);
    expect(cfg.expiryDays).toBe(30);
  });

  it('falls back to default rungs when the setting is malformed', async () => {
    const cfg = await topupBonusSettings(mockDb({
      settings: [...ENABLED, { key: 'topup_bonus_rungs', value: '[{"min":-5}]' }],
    }));
    expect(cfg.rungs).toEqual(DEFAULT_RUNGS);
  });
});

describe('countedMonthTotal', () => {
  it('excludes the first-ever completed deposit from the sum', async () => {
    const db = mockDb({ firstDeposit: { id: 'first-dep' }, monthSum: 4200000 });
    await countedMonthTotal(db, 'u1', lagosMonth());
    expect(db.transaction.aggregate.mock.calls[0][0].where.id).toEqual({ not: 'first-dep' });
  });
});

describe('applyTopupBonus', () => {
  it('does nothing while the flag is off', async () => {
    const db = mockDb({ monthSum: 20000000 });
    const res = await applyTopupBonus(db, 'u1');
    expect(res.amount).toBe(0);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('never pays a reseller', async () => {
    const db = mockDb({ settings: ENABLED, reseller: { id: 'rp' }, monthSum: 20000000 });
    const res = await applyTopupBonus(db, 'u1');
    expect(res.amount).toBe(0);
    expect(db.bonusCredit.create).not.toHaveBeenCalled();
  });

  it('pays each crossed rung once: balance, ledger row and keyed transaction', async () => {
    const now = new Date('2026-09-10T12:00:00Z');
    const db = mockDb({ settings: ENABLED, monthSum: 6500000 });
    const res = await applyTopupBonus(db, 'u1', { now });

    expect(res.amount).toBe(150000 + 270000);
    expect(res.unlocked.map(r => r.min)).toEqual([3000000, 6000000]);
    expect(db.user.update.mock.calls.map(([a]) => a.data.balance.increment)).toEqual([150000, 270000]);
    expect(db.bonusCredit.create.mock.calls.map(([a]) => a.data.source)).toEqual(['topup_month', 'topup_month']);
    expect(db.transaction.create.mock.calls.map(([a]) => a.data.idempotencyKey))
      .toEqual(['topup:2026-09:r3000000', 'topup:2026-09:r6000000']);
  });

  it('skips rungs already paid this month', async () => {
    const db = mockDb({ settings: ENABLED, monthSum: 6500000, existingKeys: ['topup:2026-09:r3000000'] });
    const res = await applyTopupBonus(db, 'u1', { now: new Date('2026-09-10T12:00:00Z') });
    expect(res.amount).toBe(270000);
    expect(db.transaction.create).toHaveBeenCalledTimes(1);
    expect(db.transaction.create.mock.calls[0][0].data.idempotencyKey).toBe('topup:2026-09:r6000000');
  });
});

describe('getTopupProgress', () => {
  it('is null when disabled and for resellers', async () => {
    expect(await getTopupProgress(mockDb({ monthSum: 5000000 }), 'u1')).toBeNull();
    expect(await getTopupProgress(mockDb({ settings: ENABLED, reseller: { id: 'rp' } }), 'u1')).toBeNull();
  });

  it('reports the climb: total, unlocked rungs and the next prize', async () => {
    const p = await getTopupProgress(
      mockDb({ settings: ENABLED, monthSum: 3700000, existingKeys: ['topup:2026-09:r3000000'] }),
      'u1',
      { now: new Date('2026-09-10T12:00:00Z') },
    );
    expect(p.total).toBe(3700000);
    expect(p.max).toBe(10000000);
    expect(p.rungs.map(r => r.unlocked)).toEqual([true, false, false]);
    expect(p.unlockedAmount).toBe(150000);
    expect(p.next).toEqual({ min: 6000000, prize: 270000, toGo: 2300000 });
  });
});
