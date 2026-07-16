import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/logger', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { finalizeDeposit } = await import('@/lib/deposit-finalization');

function matches(row, where = {}) {
  if (where.OR && !where.OR.some(branch => matches(row, branch))) return false;
  for (const [key, expected] of Object.entries(where)) {
    if (key === 'OR') continue;
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('in' in expected && !expected.in.includes(actual)) return false;
      if ('not' in expected && actual === expected.not) return false;
      if ('contains' in expected && !(actual || '').includes(expected.contains)) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function createPaymentDb({ deposits, users, coupons = [], settings = {} }) {
  const state = {
    transactions: deposits.map(row => ({ type: 'deposit', status: 'Pending', note: '', ...row })),
    users: users.map(row => ({
      balance: 0,
      firstDepositBonusPaid: false,
      referredBy: null,
      signupIp: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...row,
    })),
    coupons: structuredClone(coupons),
    settings: { ...settings },
  };

  let effectSequence = 0;
  const tx = {
    transaction: {
      findUnique: vi.fn(async ({ where }) => {
        const row = state.transactions.find(item => matches(item, where));
        return row ? { ...row } : null;
      }),
      findFirst: vi.fn(async ({ where }) => {
        const row = state.transactions.find(item => matches(item, where));
        return row ? { ...row } : null;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const rows = state.transactions.filter(item => matches(item, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      }),
      create: vi.fn(async ({ data }) => {
        if (data.idempotencyKey && state.transactions.some(row =>
          row.userId === data.userId && row.idempotencyKey === data.idempotencyKey
        )) {
          const error = new Error('Unique constraint failed');
          error.code = 'P2002';
          throw error;
        }
        const row = { id: `effect-${++effectSequence}`, status: 'Completed', note: '', ...data };
        state.transactions.push(row);
        return { ...row };
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }) => {
        const row = state.users.find(item => matches(item, where));
        return row ? { ...row } : null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = state.users.find(item => matches(item, where));
        if (!row) throw new Error('User not found');
        if (data.balance?.increment) row.balance += data.balance.increment;
        for (const [key, value] of Object.entries(data)) {
          if (key !== 'balance') row[key] = value;
        }
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const rows = state.users.filter(item => matches(item, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      }),
      count: vi.fn(async ({ where }) => state.users.filter(item => {
        if (!matches(item, { signupIp: where.signupIp, firstDepositBonusPaid: where.firstDepositBonusPaid })) return false;
        if (where.id?.not && item.id === where.id.not) return false;
        if (where.createdAt?.gte && item.createdAt < where.createdAt.gte) return false;
        return true;
      }).length),
    },
    setting: {
      findMany: vi.fn(async ({ where }) => where.key.in
        .filter(key => Object.hasOwn(state.settings, key))
        .map(key => ({ key, value: String(state.settings[key]) }))),
      update: vi.fn(async ({ where, data }) => {
        if (where.key === 'coupons') state.coupons = JSON.parse(data.value);
        else state.settings[where.key] = data.value;
        return { key: where.key, value: data.value };
      }),
    },
    $queryRaw: vi.fn(async () => [{ value: JSON.stringify(state.coupons) }]),
  };

  const db = {
    $transaction: vi.fn(async callback => callback(tx)),
  };

  return { db, state, tx };
}

function deposit(id, overrides = {}) {
  return {
    id,
    userId: 'user-1',
    amount: 500_000,
    reference: `NTR-${id}`,
    method: 'flutterwave',
    ...overrides,
  };
}

function user(id, overrides = {}) {
  return { id, email: `${id}@example.test`, name: id, referralCode: `REF-${id}`, ...overrides };
}

beforeEach(() => vi.clearAllMocks());

describe('finalizeDeposit', () => {
  it('commits principal, capped coupon and welcome credit as one financial result', async () => {
    const { db, state } = createPaymentDb({
      deposits: [deposit('one', { note: 'Flutterwave deposit [coupon:coupon-1]' })],
      users: [user('user-1', { signupIp: '1.2.3.4', balance: 1_000 })],
      coupons: [{
        id: 'coupon-1', code: 'SAVE10', type: 'percent', value: 10,
        maxDeposit: 3_000, maxUses: 10, used: 0, enabled: true,
      }],
    });

    const result = await finalizeDeposit({
      prismaClient: db,
      transactionId: 'one',
      paidAmountKobo: 500_000,
      now: new Date('2026-07-16T12:00:00Z'),
    });

    expect(result).toMatchObject({
      finalized: true,
      depositAmount: 500_000,
      couponBonus: 30_000,
      welcomeBonus: 120_000,
      inviteeBonus: 0,
      totalUserCredit: 650_000,
    });
    expect(state.users[0].balance).toBe(651_000);
    expect(state.users[0].firstDepositBonusPaid).toBe(true);
    expect(state.coupons[0].used).toBe(1);
    expect(state.transactions.find(row => row.id === 'one').status).toBe('Completed');
    expect(state.transactions.filter(row => row.type === 'bonus')).toHaveLength(2);
    expect(state.transactions.filter(row => row.type === 'bonus').every(row => row.idempotencyKey)).toBe(true);
  });

  it('pays a qualifying referral once and suppresses the welcome bonus for referred users', async () => {
    const { db, state } = createPaymentDb({
      deposits: [deposit('referred')],
      users: [
        user('user-1', { referredBy: 'REF-referrer', signupIp: '1.1.1.1' }),
        user('referrer', { referralCode: 'REF-referrer', signupIp: '2.2.2.2' }),
      ],
      settings: {
        ref_enabled: 'true',
        ref_min_deposit: '250000',
        ref_referrer_bonus: '70000',
        ref_invitee_bonus: '30000',
      },
    });

    const result = await finalizeDeposit({
      prismaClient: db,
      transactionId: 'referred',
      paidAmountKobo: 500_000,
    });

    expect(result).toMatchObject({
      finalized: true,
      welcomeBonus: 0,
      referrerBonus: 70_000,
      inviteeBonus: 30_000,
      totalUserCredit: 530_000,
    });
    expect(state.users.find(row => row.id === 'user-1').balance).toBe(530_000);
    expect(state.users.find(row => row.id === 'referrer').balance).toBe(70_000);
    const referralRows = state.transactions.filter(row => row.type === 'referral');
    expect(referralRows).toHaveLength(2);
    expect(new Set(referralRows.map(row => row.idempotencyKey)).size).toBe(2);
  });

  it('credits one deposit only once when every entry point races to finalise it', async () => {
    const { db, state } = createPaymentDb({
      deposits: [deposit('race')],
      users: [
        user('user-1', { firstDepositBonusPaid: true, referredBy: 'REF-race-referrer', signupIp: '3.3.3.3' }),
        user('race-referrer', { referralCode: 'REF-race-referrer', signupIp: '4.4.4.4' }),
      ],
      settings: {
        ref_enabled: 'true',
        ref_min_deposit: '250000',
        ref_referrer_bonus: '50000',
        ref_invitee_bonus: '50000',
      },
    });
    const sources = ['webhook', 'verify', 'crypto-webhook', 'crypto-poll', 'cron', 'admin', 'telegram'];

    const results = await Promise.all(sources.map(source => finalizeDeposit({
      prismaClient: db,
      transactionId: 'race',
      paidAmountKobo: 500_000,
      recoveredBy: source,
    })));

    expect(results.filter(result => result.finalized)).toHaveLength(1);
    expect(results.filter(result => result.reason === 'already_completed')).toHaveLength(sources.length - 1);
    expect(state.users.find(row => row.id === 'user-1').balance).toBe(550_000);
    expect(state.users.find(row => row.id === 'race-referrer').balance).toBe(50_000);
    expect(state.transactions.filter(row => row.type === 'referral')).toHaveLength(2);
    expect(state.transactions.filter(row => row.id === 'race')).toHaveLength(1);
  });

  it('produces the same financial result for every production entry point', async () => {
    const entryPoints = [
      ['flutterwave-webhook', {}],
      ['flutterwave-verify', {}],
      ['crypto-webhook', { providerPaidAmount: '312.45' }],
      ['crypto-poll', {}],
      ['cron', { recoveredBy: 'cron' }],
      ['admin', { approvedBy: 'Admin' }],
      ['telegram', { approvedBy: 'Admin (TG)' }],
    ];
    const outcomes = [];

    for (const [source, metadata] of entryPoints) {
      const { db, state } = createPaymentDb({
        deposits: [deposit(source, { note: 'Deposit [coupon:consistent]' })],
        users: [user('user-1', { signupIp: null })],
        coupons: [{ id: 'consistent', code: 'SAME', type: 'percent', value: 10, used: 0, maxUses: 100 }],
      });
      const finalized = await finalizeDeposit({
        prismaClient: db,
        transactionId: source,
        paidAmountKobo: 500_000,
        ...metadata,
      });
      outcomes.push({
        source,
        principal: finalized.depositAmount,
        coupon: finalized.couponBonus,
        welcome: finalized.welcomeBonus,
        referral: finalized.inviteeBonus,
        total: finalized.totalUserCredit,
        balance: state.users[0].balance,
        couponUses: state.coupons[0].used,
      });
    }

    const financialShapes = outcomes.map(outcome => JSON.stringify({
      principal: outcome.principal,
      coupon: outcome.coupon,
      welcome: outcome.welcome,
      referral: outcome.referral,
      total: outcome.total,
      balance: outcome.balance,
      couponUses: outcome.couponUses,
    }));
    expect(new Set(financialShapes).size, JSON.stringify(outcomes, null, 2)).toBe(1);
  });

  it('uses a coupon only once per user while still finalising later deposits', async () => {
    const { db, state } = createPaymentDb({
      deposits: [
        deposit('coupon-a', { amount: 200_000, note: '[coupon:once]' }),
        deposit('coupon-b', { amount: 300_000, note: '[coupon:once]' }),
      ],
      users: [user('user-1', { firstDepositBonusPaid: true })],
      coupons: [{ id: 'once', code: 'ONCE', type: 'fixed', value: 500, used: 0, maxUses: 100 }],
    });

    const first = await finalizeDeposit({ prismaClient: db, transactionId: 'coupon-a', paidAmountKobo: 200_000 });
    const second = await finalizeDeposit({ prismaClient: db, transactionId: 'coupon-b', paidAmountKobo: 300_000 });

    expect(first.couponBonus).toBe(50_000);
    expect(second.couponBonus).toBe(0);
    expect(second.finalized).toBe(true);
    expect(state.users[0].balance).toBe(550_000);
    expect(state.coupons[0].used).toBe(1);
    expect(state.transactions.filter(row => row.idempotencyKey === 'payment:coupon:once')).toHaveLength(1);
  });

  it('rechecks new-user coupon eligibility inside the financial transaction', async () => {
    const { db, state } = createPaymentDb({
      deposits: [
        deposit('prior', { amount: 100_000, status: 'Completed' }),
        deposit('new-user-only', { amount: 300_000, note: '[coupon:new-only]' }),
      ],
      users: [user('user-1', { firstDepositBonusPaid: true })],
      coupons: [{
        id: 'new-only', code: 'NEWONLY', type: 'percent', value: 20,
        used: 0, maxUses: 100, newUsersOnly: true,
      }],
    });

    const result = await finalizeDeposit({
      prismaClient: db,
      transactionId: 'new-user-only',
      paidAmountKobo: 300_000,
    });

    expect(result).toMatchObject({ finalized: true, couponBonus: 0, totalUserCredit: 300_000 });
    expect(state.users[0].balance).toBe(300_000);
    expect(state.coupons[0].used).toBe(0);
  });

  it('withholds same-IP referral rewards without affecting the deposit principal', async () => {
    const { db, state } = createPaymentDb({
      deposits: [deposit('same-ip')],
      users: [
        user('user-1', { referredBy: 'REF-same-ip-referrer', signupIp: '5.5.5.5' }),
        user('same-ip-referrer', { referralCode: 'REF-same-ip-referrer', signupIp: '5.5.5.5' }),
      ],
      settings: { ref_enabled: 'true', ref_min_deposit: '250000' },
    });

    const result = await finalizeDeposit({
      prismaClient: db,
      transactionId: 'same-ip',
      paidAmountKobo: 500_000,
    });

    expect(result).toMatchObject({
      finalized: true,
      referralPaid: false,
      referralWithheldReason: 'same_ip',
      totalUserCredit: 500_000,
    });
    expect(state.users.find(row => row.id === 'user-1').balance).toBe(500_000);
    expect(state.users.find(row => row.id === 'same-ip-referrer').balance).toBe(0);
    expect(state.transactions.filter(row => row.type === 'referral')).toHaveLength(0);
  });

  it('rejects an amount mismatch without changing status or balance', async () => {
    const { db, state } = createPaymentDb({
      deposits: [deposit('mismatch')],
      users: [user('user-1', { firstDepositBonusPaid: true })],
    });

    const result = await finalizeDeposit({
      prismaClient: db,
      transactionId: 'mismatch',
      paidAmountKobo: 499_999,
    });

    expect(result).toMatchObject({ finalized: false, reason: 'amount_mismatch', expectedAmount: 500_000 });
    expect(state.transactions[0].status).toBe('Pending');
    expect(state.users[0].balance).toBe(0);
  });
});
