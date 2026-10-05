import { describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  PrismaClient: class { async $disconnect() {} },
}));

const { normalizeNgPhone } = await import('@/scripts/meta-audience-sync.mjs');

/**
 * Meta matches a phone only in E.164 digits. A stored 080… goes up
 * unconverted, matches nobody, and nothing reports a problem — the audience
 * just comes back smaller than it should be. The retargeting spec names this
 * as the single biggest lever on match rate, so the conversion is pinned.
 */
describe('normalizeNgPhone', () => {
  it('converts the local 0-prefixed shape, which is how most are stored', () => {
    expect(normalizeNgPhone('08031234567')).toBe('2348031234567');
    expect(normalizeNgPhone('07011234567')).toBe('2347011234567');
    expect(normalizeNgPhone('09011234567')).toBe('2349011234567');
  });

  it('strips the punctuation numbers actually arrive with', () => {
    expect(normalizeNgPhone('+234 803 123 4567')).toBe('2348031234567');
    expect(normalizeNgPhone('0803-123-4567')).toBe('2348031234567');
    expect(normalizeNgPhone(' 234803 123 4567 ')).toBe('2348031234567');
    expect(normalizeNgPhone('00234 803 123 4567')).toBe('2348031234567');
  });

  it('accepts the bare 10-digit shape', () => {
    expect(normalizeNgPhone('8031234567')).toBe('2348031234567');
  });

  it('leaves an already-correct number alone', () => {
    expect(normalizeNgPhone('2348031234567')).toBe('2348031234567');
  });

  // Dropping is deliberate: a number that cannot be converted with confidence
  // is omitted from the PHONE column rather than guessed at, and the row still
  // uploads on its email. A wrong hash is worse than a blank one — it is an
  // identifier that matches a stranger or nobody.
  it('drops anything it cannot convert with confidence', () => {
    expect(normalizeNgPhone('+44 7911 123456')).toBeNull(); // foreign code
    expect(normalizeNgPhone('0912345')).toBeNull();         // too short
    expect(normalizeNgPhone('080312345678901')).toBeNull(); // too long
    expect(normalizeNgPhone('06031234567')).toBeNull();     // not an NG mobile prefix
    expect(normalizeNgPhone('')).toBeNull();
    expect(normalizeNgPhone(null)).toBeNull();
    expect(normalizeNgPhone('not a phone')).toBeNull();
  });

  it('always yields 234 followed by ten digits, or nothing', () => {
    for (const raw of ['08031234567', '8031234567', '+2348031234567', '0803 123 4567']) {
      expect(normalizeNgPhone(raw), raw).toMatch(/^234[789]\d{9}$/);
    }
  });
});
