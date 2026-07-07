import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { deductBalance, trackBonusConsumption, restoreBonusForRefund, grantWinbackCredit, expireBonusCredits, getBonusInfo } = await import('@/lib/bonus-credit');

function makeTx() {
  const state = {
    balance: 0,
    bonusCredits: [],
    creditUsages: [],
    transactions: [],
    users: [],
    settings: [],
  };

  const tx = {
    $executeRaw: vi.fn(async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('balance = balance -')) {
        const amount = values[0];
        if (state.balance < amount) return 0;
        state.balance -= amount;
        return 1;
      }
      if (sql.includes('balance = balance +')) {
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

beforeEach(() => { vi.clearAllMocks(); });

describe('deductBalance', () => {
  it('deducts from sufficient balance', async () => {
    const { tx, state } = makeTx();
    state.balance = 10000;
    await deductBalance(tx, 'user1', 5000);
    expect(state.balance).toBe(5000);
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
    expect(tx.bonusCredit.update).not.toHaveBeenCalled();
    expect(state.creditUsages).toHaveLength(0);
  });

  it('handles orders with no bonus consumption', async () => {
    const { tx, state } = makeTx();
    state.creditUsages = [];

    await restoreBonusForRefund(tx, 'order1');

    expect(tx.bonusCredit.update).not.toHaveBeenCalled();
    expect(tx.orderCreditUsage.deleteMany).not.toHaveBeenCalled();
  });
});

describe('expireBonusCredits', () => {
  it('expires past-due credits and writes audit transaction', async () => {
    const db = makeTx().tx;
    const pastDue = new Date(Date.now() - 86400000);
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
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { balance: { increment: 50000 } },
    }));
    expect(db.bonusCredit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'u1', source: 'winback', amountGranted: 50000, amountRemaining: 50000,
      }),
    }));
    expect(db.transaction.create).toHaveBeenCalled();
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
