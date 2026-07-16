import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  trackDeposit: vi.fn(),
  tgPayment: vi.fn(),
  tgBonusWithheld: vi.fn(),
  sendEmail: vi.fn(),
  walletCreditEmail: vi.fn(() => '<html>deposit</html>'),
  referralBonusEmail: vi.fn(() => '<html>referral</html>'),
  getWhatsAppChannelUrl: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/meta-capi', () => ({ trackDeposit: mocks.trackDeposit }));
vi.mock('@/lib/telegram', () => ({
  tgPayment: mocks.tgPayment,
  tgBonusWithheld: mocks.tgBonusWithheld,
}));
vi.mock('@/lib/email', () => ({
  sendEmail: mocks.sendEmail,
  walletCreditEmail: mocks.walletCreditEmail,
  referralBonusEmail: mocks.referralBonusEmail,
}));
vi.mock('@/lib/settings', () => ({ getWhatsAppChannelUrl: mocks.getWhatsAppChannelUrl }));
vi.mock('@/lib/logger', () => ({ log: { warn: mocks.warn } }));

const { notifyDepositFinalized } = await import('@/lib/deposit-notifications');

function result(overrides = {}) {
  return {
    finalized: true,
    depositAmount: 500_000,
    couponBonus: 50_000,
    welcomeBonus: 120_000,
    inviteeBonus: 0,
    transaction: { reference: 'NTR-ONE', method: 'flutterwave' },
    user: {
      id: 'user-1', email: 'user@example.test', name: 'Test User', phone: '+2348000000000',
      balance: 670_000, lastIp: '1.2.3.4', lastUa: 'Vitest', lastFbp: 'fbp', lastFbc: 'fbc',
    },
    referralPaid: false,
    referrerBonus: 0,
    referrer: null,
    welcomeWithheld: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.trackDeposit.mockResolvedValue(undefined);
  mocks.sendEmail.mockResolvedValue({ success: true });
  mocks.getWhatsAppChannelUrl.mockResolvedValue('https://example.test/channel');
});

describe('notifyDepositFinalized', () => {
  it('does not notify for a duplicate finalisation loser', async () => {
    const summary = await notifyDepositFinalized(result({ finalized: false }));

    expect(summary).toEqual({ attempted: 0, failed: [], skipped: true });
    expect(mocks.trackDeposit).not.toHaveBeenCalled();
    expect(mocks.tgPayment).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('uses one consistent notification set after a successful financial commit', async () => {
    const summary = await notifyDepositFinalized(result(), { channel: 'Flutterwave' });

    expect(summary.failed).toEqual([]);
    expect(mocks.trackDeposit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', reference: 'NTR-ONE', amountKobo: 500_000,
    }));
    expect(mocks.tgPayment).toHaveBeenCalledWith('Test User', 500_000, 170_000, 'Flutterwave', undefined);
    expect(mocks.walletCreditEmail).toHaveBeenCalledWith('Test User', 5_000, null, expect.objectContaining({
      kind: 'deposit', bonus: 1_200, newBalance: 6_700, method: 'Flutterwave',
    }));
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('attempts the referrer email and withheld-bonus alert through the same post-commit boundary', async () => {
    await notifyDepositFinalized(result({
      referralPaid: true,
      referrerBonus: 70_000,
      referrer: { email: 'referrer@example.test', name: 'Referrer' },
      welcomeWithheld: {
        name: 'Test User', email: 'user@example.test', ip: '1.2.3.4',
        priorClaims: 2, windowDays: 60, depositAmount: 500_000, bonus: 120_000,
      },
    }));

    expect(mocks.referralBonusEmail).toHaveBeenCalledWith('Referrer', 700);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.tgBonusWithheld).toHaveBeenCalledWith(
      'Test User', 'user@example.test', '1.2.3.4', 2, 60, 500_000, 120_000,
    );
  });

  it('contains every notification failure and never changes the completed result', async () => {
    mocks.trackDeposit.mockRejectedValue(new Error('Meta unavailable'));
    mocks.tgPayment.mockImplementation(() => { throw new Error('Telegram unavailable'); });
    mocks.getWhatsAppChannelUrl.mockRejectedValue(new Error('Settings unavailable'));

    const completed = result();
    const summary = await notifyDepositFinalized(completed);

    expect(completed.finalized).toBe(true);
    expect(completed.transaction.reference).toBe('NTR-ONE');
    expect(summary.failed.sort()).toEqual(['deposit-email', 'meta', 'telegram']);
    expect(mocks.warn).toHaveBeenCalledTimes(3);
  });
});
