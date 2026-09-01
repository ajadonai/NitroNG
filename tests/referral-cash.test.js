import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { summarizeEarnings, CASH_REF_DEFAULTS } from '../lib/referral-cash.js';

const NOW = new Date('2026-09-01T12:00:00Z');
const past = new Date('2026-08-20T12:00:00Z');
const future = new Date('2026-09-05T12:00:00Z');

describe('summarizeEarnings', () => {
  it('splits held earnings by whether the hold has passed and ignores voided ones', () => {
    const sums = summarizeEarnings([
      { status: 'held', amount: 50000, releasesAt: past },
      { status: 'held', amount: 50000, releasesAt: future },
      { status: 'requested', amount: 50000, releasesAt: past },
      { status: 'paid', amount: 50000, releasesAt: past },
      { status: 'credited', amount: 60000, releasesAt: past },
      { status: 'voided', amount: 50000, releasesAt: past },
    ], NOW);
    expect(sums).toEqual({ available: 50000, held: 50000, requested: 50000, paidOut: 110000 });
  });
});

// ── The payout API, against a mocked database ──

const prisma = {
  $transaction: vi.fn(fn => fn(prisma)),
  setting: { findMany: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  referralEarning: { findMany: vi.fn(), updateMany: vi.fn() },
  referralPayout: { findMany: vi.fn(), create: vi.fn() },
  transaction: { create: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: 'u1' }) }));
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn() } }));

const { POST } = await import('@/app/api/referrals/cash/route');
const call = body => POST(new Request('http://localhost/api/referrals/cash', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));
const enabledSettings = [{ key: 'cash_referrals_enabled', value: 'true' }];

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(fn => fn(prisma));
  prisma.setting.findMany.mockResolvedValue(enabledSettings);
  prisma.referralPayout.create.mockResolvedValue({ id: 'po1' });
  prisma.transaction.create.mockResolvedValue({});
  prisma.user.update.mockResolvedValue({});
});

describe('cash referral payouts', () => {
  it('refuses everything while the flag is off', async () => {
    prisma.setting.findMany.mockResolvedValue([]);
    const res = await call({ action: 'payout', bankName: 'Opay', bankAccountNo: '8123344471', bankAccountName: 'K A' });
    expect(res.status).toBe(403);
  });

  it('refuses a cash-out below the minimum', async () => {
    prisma.referralEarning.findMany.mockResolvedValue([{ id: 'e1', amount: 350000 }]);
    const res = await call({ action: 'payout', bankName: 'Opay', bankAccountNo: '8123344471', bankAccountName: 'K A' });
    expect(res.status).toBe(400);
    const d = await res.json();
    expect(d.error).toContain('₦5,000');
    expect(prisma.referralPayout.create).not.toHaveBeenCalled();
  });

  it('locks the earnings to the payout when over the line', async () => {
    prisma.referralEarning.findMany.mockResolvedValue([
      { id: 'e1', amount: 300000 }, { id: 'e2', amount: 250000 },
    ]);
    prisma.referralEarning.updateMany.mockResolvedValue({ count: 2 });
    const res = await call({ action: 'payout', bankName: 'Opay', bankAccountNo: '8123344471', bankAccountName: 'Kehinde A' });
    expect(res.status).toBe(200);
    expect(prisma.referralPayout.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'u1', amount: 550000 }),
    }));
    expect(prisma.referralEarning.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'requested', payoutId: 'po1' },
    }));
  });

  it('converts to wallet at the premium rate', async () => {
    prisma.referralEarning.findMany.mockResolvedValue([{ id: 'e1', amount: 100000 }]);
    prisma.referralEarning.updateMany.mockResolvedValue({ count: 1 });
    const res = await call({ action: 'credit-wallet' });
    expect(res.status).toBe(200);
    const d = await res.json();
    // ₦1,000 earned at the ₦500 cash rate converts at ₦600 → ₦1,200 credited.
    expect(d.credit).toBe(Math.round(100000 * CASH_REF_DEFAULTS.walletAmount / CASH_REF_DEFAULTS.amount));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { balance: { increment: d.credit } },
    }));
  });
});

describe('deposit hook', () => {
  it('branches the referrer credit on the cash flag and never touches the invitee side', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/deposit-finalization.js'), 'utf8');
    expect(src).toContain("cashReferralSettings(db)");
    expect(src).toContain('cash.enabled ? 0 : referrerBonus');
    expect(src).toContain('referralEarning.create');
    expect(src).toContain('effectiveInviteeBonus');
  });
});
