import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isActiveCrewMember } from '@/lib/affiliate-eligibility';

describe('affiliate deletion eligibility', () => {
  it('requires an approved, non-deleted member', () => {
    expect(isActiveCrewMember({ status: 'approved', deletedAt: null })).toBe(true);
    expect(isActiveCrewMember({ status: 'suspended', deletedAt: null })).toBe(false);
    expect(isActiveCrewMember({ status: 'approved', deletedAt: new Date() })).toBe(false);
    expect(isActiveCrewMember(null)).toBe(false);
  });

  it('blocks new member payout requests but preserves admin settlement of existing obligations', () => {
    const memberPayout = readFileSync('app/api/pit/payouts/route.js', 'utf8');
    const adminPayout = readFileSync('app/api/admin/crew/payouts/route.js', 'utf8');

    expect(memberPayout).toContain('SELECT id, "totalPaid", role, status, "deletedAt"');
    expect(memberPayout).toContain("lockedMember.status !== 'approved' || lockedMember.deletedAt");
    expect(adminPayout).toContain('This settles an obligation requested before account deletion');
    expect(adminPayout).not.toContain("reason: 'ineligible'");
  });

  it('does not allow a deleted Pit member to log back in', () => {
    const login = readFileSync('app/api/pit/auth/login/route.js', 'utf8');
    expect(login).toContain("member.deletedAt || member.status === 'deleted'");
    expect(login.indexOf("member.deletedAt || member.status === 'deleted'"))
      .toBeLessThan(login.indexOf('bcrypt.compare'));
  });
});
