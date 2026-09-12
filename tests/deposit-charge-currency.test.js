import { describe, expect, it } from 'vitest';
import { chargeCurrencyForCountry, foreignChargeAmount } from '@/lib/currency';

// International Nitro step 3: the charge currency follows the signup country,
// the naira credit never changes, and the foreign figure is derived once at the
// padded deposit rate. These are the pure rules the initialise route leans on.
const FX = { depositRate: 1529, usdRates: { GHS: 12.5, KES: 129, GBP: 0.74 } };

describe('charge currency by country', () => {
  it('maps the five signup countries and falls back to naira', () => {
    expect(chargeCurrencyForCountry('GH')).toBe('GHS');
    expect(chargeCurrencyForCountry('KE')).toBe('KES');
    expect(chargeCurrencyForCountry('gb')).toBe('GBP');
    expect(chargeCurrencyForCountry('US')).toBe('USD');
    expect(chargeCurrencyForCountry('NG')).toBe('NGN');
    expect(chargeCurrencyForCountry(undefined)).toBe('NGN');
    expect(chargeCurrencyForCountry('ZZ')).toBe('NGN');
  });
});

describe('foreign charge amount', () => {
  it('ceils to the cent so rounding never favours the payer over the wallet', () => {
    // ₦5,000 at 1529/12.5 = ₦122.32 per cedi → 40.876… → 40.88, not 40.87
    expect(foreignChargeAmount(500_000, 'GHS', FX)).toBe(40.88);
    // dollars: ₦5,000 / 1529 = 3.2701… → 3.28
    expect(foreignChargeAmount(500_000, 'USD', FX)).toBe(3.28);
  });

  it('is null for naira, for a missing rate, and for a nonsense amount — never zero', () => {
    expect(foreignChargeAmount(500_000, 'NGN', FX)).toBeNull();
    expect(foreignChargeAmount(500_000, 'GHS', { depositRate: 1529, usdRates: {} })).toBeNull();
    expect(foreignChargeAmount(500_000, 'GHS', {})).toBeNull();
    expect(foreignChargeAmount(0, 'GHS', FX)).toBeNull();
    expect(foreignChargeAmount('x', 'GHS', FX)).toBeNull();
  });
});
