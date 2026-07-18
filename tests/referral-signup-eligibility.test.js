import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const signupRoutes = [
  ['password signup', readFileSync('app/api/auth/signup/route.js', 'utf8')],
  ['Google signup', readFileSync('app/api/auth/google/callback/route.js', 'utf8')],
];

describe.each(signupRoutes)('%s referral eligibility', (_label, source) => {
  it('stores referral attribution only after a fully eligible referrer lookup', () => {
    const referralStart = source.indexOf('// Check if referral code is valid') >= 0
      ? source.indexOf('// Check if referral code is valid')
      : source.indexOf('// Validate referral');
    const referralEnd = source.indexOf('// Extract IP + ToS version', referralStart);
    const referralBlock = source.slice(referralStart, referralEnd);

    expect(referralStart).toBeGreaterThan(-1);
    expect(referralEnd).toBeGreaterThan(referralStart);
    expect(referralBlock).toContain('prisma.user.findFirst');
    expect(referralBlock).toContain('referralCode,');
    expect(referralBlock).toContain("status: 'Active'");
    expect(referralBlock).toContain('emailVerified: true');
    expect(referralBlock).toContain('deletedAt: null');
    expect(referralBlock.indexOf('prisma.user.findFirst'))
      .toBeLessThan(referralBlock.indexOf('referredBy = referralCode'));
    expect(referralBlock).not.toContain('prisma.user.findUnique({ where: { referralCode } })');
  });
});
