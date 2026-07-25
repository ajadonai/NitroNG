import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { deductBalance, trackBonusConsumption, restoreBonusForRefund, grantWinbackCredit, expireBonusCredits, getBonusInfo } = await import('@/lib/bonus-credit');
const { applyWelcomeBonus } = await import('@/lib/welcome-bonus');

function makeTx() {
  const state = {
    balance: 0,
    account: { id: 'u1', status: 'Active', deletedAt: null, anonymizedAt: null },
    bonusCredits: [],
    creditUsages: [],
    transactions: [],
    users: [],
    settings: [],
  };

  const tx = {
    $queryRaw: vi.fn(async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('FROM users') && sql.includes('FOR UPDATE')) {
        const userId = values[0];
        if (state.account?.id !== userId) return [];
        return [{
          id: state.account.id,
          status: state.account.status,
          anonymizedAt: state.account.anonymizedAt,
        }];
      }
      return [];
    }),
    $executeRaw: vi.fn(async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('balance = balance -')) {
        const amount = values[0];
        if (state.balance < amount) return 0;
        state.balance -= amount;
        return 1;
      }
      if (sql.includes('balance = balance +')) {
        const amount = values[0];
        const userId = values[1];
        if (
          state.account?.id !== userId
          || state.account.status !== 'Active'
          || state.account.deletedAt
          || state.account.anonymizedAt
        ) return 0;
        state.balance += amount;
        return 1;
      }
      return 1;
    }),
    bonusCredit: {
      findMany: vi.fn(async () => state.bonusCredits.filter(c => c.amountRemaining > 0 && !c.expiredAt).sort((a, b) => a.expiresAt - b.expiresAt)),
      create: vi.fn(async ({ data }) => { const row = { id: `bc_${Date.now()}`, ...data }; state.bonusCredits.push(row); return row; }),
      update: vi.fn(async ({ where, data }) => {
        const c = state.bonusCredits.find(x => x.id === where.id);
        if (c && data.amountRemaining?.decrement) c.amountRemaining -= data.amountRemaining.decrement;
        if (c && data.amountRemaining?.increment) c.amountRemaining += data.amountRemaining.increment;
        if (c && data.expiredAt !== undefined) c.expiredAt = data.expiredAt;
        if (c && data.amountRemaining === 0) c.amountRemaining = 0;
        return c;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const c = state.bonusCredits.find(x => (
          x.id === where.id
          && x.userId === where.userId
          && (!Object.hasOwn(where, 'expiredAt') || x.expiredAt === where.expiredAt)
        ));
        if (!c) return { count: 0 };
        if (data.amountRemaining?.increment) c.amountRemaining += data.amountRemaining.increment;
        return { count: 1 };
      }),
    },
    orderCreditUsage: {
      createMany: vi.fn(async ({ data }) => { state.creditUsages.push(...data); }),
      findMany: vi.fn(async ({ where, include }) => {
        return state.creditUsages
          .filter(u => u.orderId === where.orderId)
          .map(u => include?.bonusCredit ? { ...u, bonusCredit: state.bonusCredits.find(c => c.id === u.bonusCreditId) } : u);
      }),
      deleteMany: vi.fn(async ({ where }) => {
        state.creditUsages = state.creditUsages.filter(u => u.orderId !== where.orderId);
      }),
    },
    user: {
      findUnique: vi.fn(async () => ({ balance: state.balance })),
      update: vi.fn(async ({ data }) => {
        if (data.balance?.increment) state.balance += data.balance.increment;
      }),
    },
    transaction: {
      create: vi.fn(async ({ data }) => { state.transactions.push(data); return data; }),
    },
    setting: {
      findUnique: vi.fn(async () => null),
    },
  };

  return { tx, state };
}

function makeWelcomeBonusDb() {
  return {
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    transaction: { create: vi.fn(), count: vi.fn().mockResolvedValue(1) },
    alert: { create: vi.fn() },
    setting: { findMany: vi.fn() },
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('deductBalance', () => {
  it('deducts from sufficient balance', async () => {
    const { tx, state } = makeTx();
    state.balance = 10000;
    await deductBalance(tx, 'user1', 5000);
    expect(state.balance).toBe(5000);
    const sql = tx.$executeRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain("status = 'Active'");
    expect(sql).toContain('"anonymizedAt" IS NULL');
  });

  it('uses the same active-account fence for a zero wallet charge', async () => {
    const { tx, state } = makeTx();
    state.balance = 10000;

    await deductBalance(tx, 'user1', 0);

    expect(state.balance).toBe(10000);
    const sql = tx.$executeRaw.mock.calls[0][0].join(' ');
    expect(sql).toContain("status = 'Active'");
    expect(sql).toContain('balance >=');
  });

  it('throws INSUFFICIENT_BALANCE on insufficient funds', async () => {
    const { tx, state } = makeTx();
    state.balance = 1000;
    await expect(deductBalance(tx, 'user1', 5000)).rejects.toThrow('INSUFFICIENT_BALANCE');
  });
});

describe('trackBonusConsumption', () => {
  it('consumes soonest-expiry credit first', async () => {
    const { tx, state } = makeTx();
    const soon = new Date(Date.now() + 3 * 86400000);
    const later = new Date(Date.now() + 10 * 86400000);
    state.bonusCredits = [
      { id: 'bc1', userId: 'u1', amountRemaining: 2000, expiresAt: later, expiredAt: null },
      { id: 'bc2', userId: 'u1', amountRemaining: 3000, expiresAt: soon, expiredAt: null },
    ];

    await trackBonusConsumption(tx, 'u1', 'order1', 4000);

    expect(state.creditUsages).toHaveLength(2);
    expect(state.creditUsages[0]).toEqual(expect.objectContaining({ bonusCreditId: 'bc2', amount: 3000 }));
    expect(state.creditUsages[1]).toEqual(expect.objectContaining({ bonusCreditId: 'bc1', amount: 1000 }));
  });

  it('does nothing when no bonus credits exist', async () => {
    const { tx, state } = makeTx();
    state.bonusCredits = [];

    await trackBonusConsumption(tx, 'u1', 'order1', 5000);

    expect(state.creditUsages).toHaveLength(0);
    expect(tx.bonusCredit.update).not.toHaveBeenCalled();
  });

  it('consumes only up to charge amount', async () => {
    const { tx, state } = makeTx();
    state.bonusCredits = [
      { id: 'bc1', userId: 'u1', amountRemaining: 10000, expiresAt: new Date(Date.now() + 86400000), expiredAt: null },
    ];

    await trackBonusConsumption(tx, 'u1', 'order1', 3000);

    expect(state.creditUsages).toHaveLength(1);
    expect(state.creditUsages[0].amount).toBe(3000);
    expect(state.bonusCredits[0].amountRemaining).toBe(7000);
  });

  it('handles multiple orders consuming sequentially (bulk simulation)', async () => {
    const { tx, state } = makeTx();
    state.bonusCredits = [
      { id: 'bc1', userId: 'u1', amountRemaining: 5000, expiresAt: new Date(Date.now() + 86400000), expiredAt: null },
    ];

    await trackBonusConsumption(tx, 'u1', 'order1', 3000);
    await trackBonusConsumption(tx, 'u1', 'order2', 4000);

    expect(state.creditUsages).toHaveLength(2);
    expect(state.creditUsages[0]).toEqual(expect.objectContaining({ orderId: 'order1', amount: 3000 }));
    expect(state.creditUsages[1]).toEqual(expect.objectContaining({ orderId: 'order2', amount: 2000 }));
  });
});

describe('restoreBonusForRefund (user-initiated cancel)', () => {
  it('restores consumed credit to original BonusCredit row', async () => {
    const { tx, state } = makeTx();
    const expiresAt = new Date(Date.now() + 5 * 86400000);
    state.bonusCredits = [
      { id: 'bc1', userId: 'u1', amountRemaining: 2000, expiresAt, expiredAt: null },
    ];
    state.creditUsages = [
      { id: 'u1', orderId: 'order1', bonusCreditId: 'bc1', amount: 3000 },
    ];

    await restoreBonusForRefund(tx, 'order1');

    expect(state.bonusCredits[0].amountRemaining).toBe(5000);
    expect(state.creditUsages).toHaveLength(0);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.calls[0][0].join(' ')).toContain('FOR UPDATE');
  });

  it('does not restore expired credit', async () => {
    const { tx, state } = makeTx();
    state.bonusCredits = [
      { id: 'bc1', userId: 'u1', amountRemaining: 0, expiresAt: new Date(Date.now() - 86400000), expiredAt: new Date() },
    ];
    state.creditUsages = [
      { id: 'u1', orderId: 'order1', bonusCreditId: 'bc1', amount: 3000 },
    ];

    await restoreBonusForRefund(tx, 'order1');

    expect(state.bonusCredits[0].amountRemaining).toBe(0);
    expect(tx.bonusCredit.updateMany).not.toHaveBeenCalled();
    expect(state.creditUsages).toHaveLength(0);
  });

  it.each([
    ['deleted', { status: 'Deleted', anonymizedAt: null }],
    ['anonymized', { status: 'Active', anonymizedAt: new Date() }],
  ])('does not recreate credit after the account is %s', async (_label, accountState) => {
    const { tx, state } = makeTx();
    state.account = { ...state.account, ...accountState };
    state.bonusCredits = [
      { id: 'bc1', userId: 'u1', amountRemaining: 0, expiresAt: new Date(Date.now() + 86400000), expiredAt: null },
    ];
    state.creditUsages = [
      { id: 'usage1', orderId: 'order1', bonusCreditId: 'bc1', amount: 3000 },
    ];

    await restoreBonusForRefund(tx, 'order1');

    expect(state.bonusCredits[0].amountRemaining).toBe(0);
    expect(tx.bonusCredit.updateMany).not.toHaveBeenCalled();
    expect(state.creditUsages).toHaveLength(0);
  });

  it('allows restoration during the pre-anonymization deletion grace period', async () => {
    const { tx, state } = makeTx();
    state.account = { ...state.account, status: 'PendingDeletion', deletedAt: new Date(), anonymizedAt: null };
    state.bonusCredits = [
      { id: 'bc1', userId: 'u1', amountRemaining: 0, expiresAt: new Date(Date.now() + 86400000), expiredAt: null },
    ];
    state.creditUsages = [
      { id: 'usage1', orderId: 'order1', bonusCreditId: 'bc1', amount: 3000 },
    ];

    await restoreBonusForRefund(tx, 'order1');

    expect(state.bonusCredits[0].amountRemaining).toBe(3000);
  });

  it('handles orders with no bonus consumption', async () => {
    const { tx, state } = makeTx();
    state.creditUsages = [];

    await restoreBonusForRefund(tx, 'order1');

    expect(tx.bonusCredit.updateMany).not.toHaveBeenCalled();
    expect(tx.orderCreditUsage.deleteMany).not.toHaveBeenCalled();
  });
});

describe('expireBonusCredits', () => {
  it('expires past-due credits and writes audit transaction', async () => {
    const db = makeTx().tx;
    db.bonusCredit.findMany = vi.fn(async () => [
      { id: 'bc1', userId: 'u1', source: 'winback', amountRemaining: 5000, amountGranted: 5000, grantedAt: new Date(Date.now() - 8 * 86400000) },
    ]);
    db.user.findUnique = vi.fn(async () => ({ balance: 10000 }));
    db.$transaction = vi.fn(async (fn) => fn(db));

    const count = await expireBonusCredits(db);

    expect(count).toBe(1);
    expect(db.bonusCredit.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bc1' },
      data: expect.objectContaining({ amountRemaining: 0 }),
    }));
    expect(db.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'bonus_expired', amount: -5000 }),
    }));
  });

  it('caps deduction at current balance (never negative)', async () => {
    const db = makeTx().tx;
    db.bonusCredit.findMany = vi.fn(async () => [
      { id: 'bc1', userId: 'u1', source: 'winback', amountRemaining: 5000, amountGranted: 5000, grantedAt: new Date() },
    ]);
    db.user.findUnique = vi.fn(async () => ({ balance: 2000 }));
    db.$transaction = vi.fn(async (fn) => fn(db));

    await expireBonusCredits(db);

    expect(db.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: -2000 }),
    }));
  });
});

describe('grantWinbackCredit', () => {
  it('creates BonusCredit row and credits balance', async () => {
    const db = makeTx().tx;
    db.$transaction = vi.fn(async (fn) => fn(db));
    db.setting.findUnique = vi.fn(async () => null);

    const result = await grantWinbackCredit(db, 'u1', 50000, 7);

    expect(result).toBeDefined();
    expect(db.$executeRaw).toHaveBeenCalledOnce();
    const fenceSql = db.$executeRaw.mock.calls[0][0].join(' ');
    expect(fenceSql).toContain("status = 'Active'");
    expect(fenceSql).toContain('"deletedAt" IS NULL');
    expect(fenceSql).toContain('"anonymizedAt" IS NULL');
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.bonusCredit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'u1', source: 'winback', amountGranted: 50000, amountRemaining: 50000,
      }),
    }));
    expect(db.transaction.create).toHaveBeenCalled();
  });

  it.each([
    ['pending deletion', { status: 'PendingDeletion' }],
    ['deleted', { status: 'Deleted' }],
    ['suspended', { status: 'Suspended' }],
    ['a deletion timestamp', { deletedAt: new Date() }],
    ['anonymization', { anonymizedAt: new Date() }],
  ])('does not grant from a stale cron read after %s', async (_label, accountState) => {
    const { tx, state } = makeTx();
    state.account = { ...state.account, ...accountState };
    tx.$transaction = vi.fn(async (fn) => fn(tx));
    tx.setting.findUnique = vi.fn(async () => null);

    const result = await grantWinbackCredit(tx, 'u1', 50000, 7);

    expect(result).toBeNull();
    expect(tx.bonusCredit.create).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(state.balance).toBe(0);
  });
});

describe('getBonusInfo', () => {
  it('returns null when no active bonus credits', async () => {
    const db = { bonusCredit: { findMany: vi.fn(async () => []) } };
    const result = await getBonusInfo(db, 'u1');
    expect(result).toBeNull();
  });

  it('returns total and soonest expiry', async () => {
    const soon = new Date(Date.now() + 3 * 86400000);
    const later = new Date(Date.now() + 10 * 86400000);
    const db = {
      bonusCredit: {
        findMany: vi.fn(async () => [
          { amountRemaining: 2000, expiresAt: soon },
          { amountRemaining: 3000, expiresAt: later },
        ]),
      },
    };
    const result = await getBonusInfo(db, 'u1');
    expect(result.amount).toBe(5000);
    expect(result.expiresAt).toBe(soon.toISOString());
  });
});

describe('applyWelcomeBonus', () => {
  it('pays bonus when under IP cap', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: null, signupIp: '1.2.3.4' });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.setting.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(1);
    db.user.update.mockResolvedValue({});
    db.transaction.create.mockResolvedValue({});

    const result = await applyWelcomeBonus(db, 'user1', 250000);

    expect(result).toBe(50000);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user1' },
      data: { balance: { increment: 50000 } },
    }));
    expect(db.transaction.create).toHaveBeenCalled();
    expect(db.alert.create).not.toHaveBeenCalled();
  });

  it('withholds bonus when at IP cap (no alert record)', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: null, signupIp: '1.2.3.4', name: 'Test', email: 'test@x.com' });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.setting.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(2);

    const result = await applyWelcomeBonus(db, 'user3', 500000);

    expect(result).toBe(0);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.transaction.create).not.toHaveBeenCalled();
    expect(db.alert.create).not.toHaveBeenCalled();
  });

  it('pays normally when signupIp is unknown', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: null, signupIp: 'unknown' });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.user.update.mockResolvedValue({});
    db.transaction.create.mockResolvedValue({});

    const result = await applyWelcomeBonus(db, 'user4', 1000000);

    expect(result).toBe(300000);
    expect(db.user.count).not.toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalled();
  });

  it('pays normally when signupIp is null', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: null, signupIp: null });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.user.update.mockResolvedValue({});
    db.transaction.create.mockResolvedValue({});

    const result = await applyWelcomeBonus(db, 'user5', 500000);

    expect(result).toBe(120000);
    expect(db.user.count).not.toHaveBeenCalled();
  });

  it('allows bonus again when prior claims are outside the window', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: null, signupIp: '1.2.3.4' });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.setting.findMany.mockResolvedValue([
      { key: 'welcome_bonus_ip_window_days', value: '30' },
    ]);
    db.user.count.mockResolvedValue(0);
    db.user.update.mockResolvedValue({});
    db.transaction.create.mockResolvedValue({});

    const result = await applyWelcomeBonus(db, 'user6', 250000);

    expect(result).toBe(50000);
    expect(db.user.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        signupIp: '1.2.3.4',
        id: { not: 'user6' },
        createdAt: { gte: expect.any(Date) },
      }),
    }));
  });

  it('returns 0 for referred users', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: 'someReferrer', signupIp: '5.6.7.8' });
    db.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await applyWelcomeBonus(db, 'user7', 1000000);

    expect(result).toBe(0);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.user.count).not.toHaveBeenCalled();
  });

  it('returns 0 for sub-₦2,500 deposits but burns the flag', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: null, signupIp: '1.2.3.4' });
    db.user.updateMany.mockResolvedValue({ count: 1 });

    const result = await applyWelcomeBonus(db, 'user8', 200000);

    expect(result).toBe(0);
    expect(db.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { firstDepositBonusPaid: true } }),
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('returns 0 for second deposits', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: true, referredBy: null, signupIp: '1.2.3.4' });

    const result = await applyWelcomeBonus(db, 'user9', 500000);

    expect(result).toBe(0);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('respects custom cap from settings', async () => {
    const db = makeWelcomeBonusDb();
    db.user.findUnique.mockResolvedValue({ firstDepositBonusPaid: false, referredBy: null, signupIp: '1.2.3.4' });
    db.user.updateMany.mockResolvedValue({ count: 1 });
    db.setting.findMany.mockResolvedValue([
      { key: 'welcome_bonus_ip_cap', value: '5' },
    ]);
    db.user.count.mockResolvedValue(4);
    db.user.update.mockResolvedValue({});
    db.transaction.create.mockResolvedValue({});

    const result = await applyWelcomeBonus(db, 'user10', 250000);

    expect(result).toBe(50000);
  });
});
