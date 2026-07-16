import { describe, expect, it } from 'vitest';
import {
  buildDepositCompletionNote,
  calculateCouponBonus,
  depositEffectKey,
  isReservedDepositEffectKey,
} from '@/lib/deposit-finalization';

const NOW = new Date('2026-07-16T12:00:00.000Z');

function activeCoupon(overrides = {}) {
  return {
    id: 'coupon-1',
    code: 'NITRO20',
    type: 'percent',
    value: 20,
    minOrder: 0,
    maxDeposit: 0,
    maxUses: 0,
    used: 0,
    expires: null,
    enabled: true,
    ...overrides,
  };
}

function occurrences(text, value) {
  return text.split(String(value)).length - 1;
}

describe('calculateCouponBonus properties', () => {
  it('rounds percentage bonuses to kobo and never calculates above maxDeposit', () => {
    const percentages = [1, 2.5, 7.25, 20, 33.333, 50, 100];
    const maxDepositsNaira = [0, 1_000, 2_500, 10_000];
    const depositAmountsKobo = [100_001, 199_999, 250_050, 500_099, 1_000_000, 5_000_001];

    for (const value of percentages) {
      for (const maxDeposit of maxDepositsNaira) {
        const coupon = activeCoupon({ value, maxDeposit });

        for (const depositAmountKobo of depositAmountsKobo) {
          const cappedBaseKobo = maxDeposit > 0
            ? Math.min(depositAmountKobo, maxDeposit * 100)
            : depositAmountKobo;
          const expected = Math.round(cappedBaseKobo * (value / 100));
          const actual = calculateCouponBonus(coupon, depositAmountKobo, NOW);

          expect(actual, `${value}% of ${depositAmountKobo} with cap ${maxDeposit}`).toBe(expected);
          expect(Number.isInteger(actual)).toBe(true);
          expect(actual).toBeLessThanOrEqual(Math.round(cappedBaseKobo * (value / 100)));
        }
      }
    }
  });

  it('keeps a capped percentage bonus constant for every deposit above the cap', () => {
    const coupon = activeCoupon({ value: 17.5, maxDeposit: 2_500 });
    const depositsAtOrAboveCap = [250_000, 250_001, 500_000, 1_000_000, 10_000_000];
    const bonuses = depositsAtOrAboveCap.map(amount => calculateCouponBonus(coupon, amount, NOW));

    expect(new Set(bonuses)).toEqual(new Set([Math.round(250_000 * 0.175)]));
  });

  it('keeps fixed bonuses independent of the deposit size', () => {
    const fixedValuesNaira = [1, 50, 500, 3_000];
    const depositAmountsKobo = [100_000, 250_001, 1_000_000, 25_000_000];

    for (const value of fixedValuesNaira) {
      const coupon = activeCoupon({ type: 'fixed', value, maxDeposit: 1_000 });
      const bonuses = depositAmountsKobo.map(amount => calculateCouponBonus(coupon, amount, NOW));

      expect(new Set(bonuses), `fixed ₦${value}`).toEqual(new Set([value * 100]));
    }
  });

  it('returns zero for disabled, expired, exhausted, and below-minimum coupons', () => {
    const ineligibleCoupons = [
      activeCoupon({ enabled: false }),
      activeCoupon({ expires: '2026-07-16T11:59:59.999Z' }),
      activeCoupon({ maxUses: 10, used: 10 }),
      activeCoupon({ maxUses: 10, used: 11 }),
      activeCoupon({ minOrder: 2_500 }),
    ];

    for (const coupon of ineligibleCoupons) {
      for (const depositAmountKobo of [1, 50_000, 249_999]) {
        expect(calculateCouponBonus(coupon, depositAmountKobo, NOW)).toBe(0);
      }
    }
  });

  it('accepts the exact minimum and treats an unlimited-use coupon as available', () => {
    const coupon = activeCoupon({ minOrder: 2_500, maxUses: 0, used: 99_999 });

    expect(calculateCouponBonus(coupon, 250_000, NOW)).toBe(50_000);
  });
});

describe('depositEffectKey properties', () => {
  it('is deterministic and collision-free across the supported effect identities', () => {
    const effects = [
      ['deposit', 'deposit-tx-1'],
      ['deposit', 'deposit-tx-2'],
      ['coupon', 'deposit-tx-1:coupon-1'],
      ['coupon', 'deposit-tx-1:coupon-2'],
      ['welcome', 'user-1'],
      ['welcome', 'user-2'],
      ['referral-invitee', 'invitee-1'],
      ['referral-referrer', 'invitee-1'],
    ];

    const keys = effects.map(([kind, identifier]) => {
      const first = depositEffectKey(kind, identifier);
      const second = depositEffectKey(kind, identifier);

      expect(first).toBe(second);
      expect(typeof first).toBe('string');
      expect(first.length).toBeGreaterThan(0);
      return first;
    });

    expect(new Set(keys).size).toBe(effects.length);
    expect(keys.every(isReservedDepositEffectKey)).toBe(true);
    expect(isReservedDepositEffectKey('8d726ae7-e5cd-4d30-b4df-f40d1d41b900')).toBe(false);
  });
});

describe('buildDepositCompletionNote properties', () => {
  it('preserves existing note metadata while appending completion metadata', () => {
    const original = 'Manual deposit [coupon:coupon-42] [user_confirmed:SENDER-9] [np:998877]';
    const metadata = {
      approvedBy: 'phase2-admin-unique',
      recoveredBy: 'phase2-recovery-unique',
      providerPaidAmount: 98_765.4321,
    };

    const completed = buildDepositCompletionNote(original, metadata);

    expect(completed).toContain(original);
    expect(completed).toContain(metadata.approvedBy);
    expect(completed).toContain(metadata.recoveredBy);
    expect(completed).toContain(String(metadata.providerPaidAmount));
  });

  it('is idempotent when the same completion metadata is applied repeatedly', () => {
    const metadata = {
      approvedBy: 'phase2-admin-idempotent',
      recoveredBy: 'phase2-recovery-idempotent',
      providerPaidAmount: 76_543.2109,
    };
    const once = buildDepositCompletionNote('Deposit [coupon:coupon-7]', metadata);
    const twice = buildDepositCompletionNote(once, metadata);
    const threeTimes = buildDepositCompletionNote(twice, metadata);

    expect(twice).toBe(once);
    expect(threeTimes).toBe(once);
    expect(occurrences(once, metadata.approvedBy)).toBe(1);
    expect(occurrences(once, metadata.recoveredBy)).toBe(1);
    expect(occurrences(once, metadata.providerPaidAmount)).toBe(1);
  });

  it('preserves metadata accumulated across separate completion steps', () => {
    const approvedBy = 'phase2-admin-step';
    const recoveredBy = 'phase2-recovery-step';
    const providerPaidAmount = 54_321.0123;
    const original = 'Crypto deposit [coupon:coupon-9] [np:123456]';

    const approved = buildDepositCompletionNote(original, { approvedBy });
    const recovered = buildDepositCompletionNote(approved, { recoveredBy });
    const paid = buildDepositCompletionNote(recovered, { providerPaidAmount });

    expect(paid).toContain(original);
    expect(paid).toContain(approvedBy);
    expect(paid).toContain(recoveredBy);
    expect(paid).toContain(String(providerPaidAmount));
    expect(buildDepositCompletionNote(paid, { approvedBy, recoveredBy, providerPaidAmount })).toBe(paid);
  });
});
