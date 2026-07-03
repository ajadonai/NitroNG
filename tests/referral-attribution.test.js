import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  user: { findUnique: vi.fn() },
  acquisitionLink: { findUnique: vi.fn() },
  crewMember: { findUnique: vi.fn() },
  affiliateCommission: { findFirst: vi.fn(), create: vi.fn() },
  setting: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/crew-bot', () => ({ crewSignup: vi.fn(), crewFirstPurchase: vi.fn(), crewRepeatBuyer: vi.fn() }));

const { createCommission } = await import('@/lib/commissions');
const { resolveSignupAttribution } = await import('@/lib/link-ownership');

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.setting.findMany.mockResolvedValue([]);
});

const MEMBER = { id: 'member1', status: 'approved', commissionRate: 30, leadId: null, role: 'crew', email: 'crew@test.local' };
const BEFORE_FREEZE = new Date('2026-06-01T00:00:00Z');
const AFTER_FREEZE = new Date('2026-07-15T00:00:00Z');

describe('immutable referral attribution', () => {
  it('uses frozen member/link IDs when present', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      signupSource: 'old-slug',
      email: 'user@test.local',
      referredByMemberId: 'member1',
      referredByLinkId: 'link1',
      createdAt: AFTER_FREEZE,
    });
    mockPrisma.crewMember.findUnique.mockResolvedValue(MEMBER);
    mockPrisma.affiliateCommission.findFirst.mockResolvedValue(null);
    mockPrisma.affiliateCommission.create.mockImplementation(({ data }) => data);

    await createCommission('order1', 'user1', 200000, 100000);

    // Should NOT look up the link by slug
    expect(mockPrisma.acquisitionLink.findUnique).not.toHaveBeenCalled();
    // Should use frozen member
    expect(mockPrisma.crewMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'member1' } })
    );
  });

  it('does not fall back to live lookup for post-freeze users with null frozen IDs', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      signupSource: 'some-slug',
      email: 'user@test.local',
      referredByMemberId: null,
      referredByLinkId: null,
      createdAt: AFTER_FREEZE,
    });

    const result = await createCommission('order1', 'user1', 200000, 100000);

    expect(result).toBeNull();
    expect(mockPrisma.acquisitionLink.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to live lookup for pre-freeze legacy users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      signupSource: 'legacy-slug',
      email: 'user@test.local',
      referredByMemberId: null,
      referredByLinkId: null,
      createdAt: BEFORE_FREEZE,
    });
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: 'member1', enabled: true,
    });
    mockPrisma.crewMember.findUnique.mockResolvedValue(MEMBER);
    mockPrisma.affiliateCommission.findFirst.mockResolvedValue(null);
    mockPrisma.affiliateCommission.create.mockImplementation(({ data }) => data);

    await createCommission('order1', 'user1', 200000, 100000);

    expect(mockPrisma.acquisitionLink.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'legacy-slug' } })
    );
  });

  it('link reassignment does not affect frozen users', async () => {
    // User signed up via member1, link later reassigned to member2
    mockPrisma.user.findUnique.mockResolvedValue({
      signupSource: 'shared-slug',
      email: 'user@test.local',
      referredByMemberId: 'member1',
      referredByLinkId: 'link1',
      createdAt: AFTER_FREEZE,
    });
    mockPrisma.crewMember.findUnique.mockResolvedValue(MEMBER);
    mockPrisma.affiliateCommission.findFirst.mockResolvedValue(null);
    mockPrisma.affiliateCommission.create.mockImplementation(({ data }) => data);

    await createCommission('order1', 'user1', 200000, 100000);

    // Credits member1 (frozen), not whatever the link currently points to
    expect(mockPrisma.crewMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'member1' } })
    );
  });

  it('disabled link at signup produces null frozen IDs — no commission ever', async () => {
    // Simulates: user signed up with disabled link → null frozen IDs, post-freeze date
    mockPrisma.user.findUnique.mockResolvedValue({
      signupSource: 'disabled-slug',
      email: 'user@test.local',
      referredByMemberId: null,
      referredByLinkId: null,
      createdAt: AFTER_FREEZE,
    });

    const result = await createCommission('order1', 'user1', 200000, 100000);

    expect(result).toBeNull();
    // Must NOT attempt live lookup that could misattribute after reassignment
    expect(mockPrisma.acquisitionLink.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.crewMember.findUnique).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────
// resolveSignupAttribution (shared by both signup routes)
// ──────────────────────────────────────
describe('resolveSignupAttribution', () => {
  it('returns member and link IDs for a valid enabled link', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: 'member1', enabled: true, archivedAt: null,
    });

    const result = await resolveSignupAttribution('valid-slug');

    expect(result).toEqual({ memberId: 'member1', linkId: 'link1' });
  });

  it('returns nulls for a disabled link', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: 'member1', enabled: false, archivedAt: null,
    });

    const result = await resolveSignupAttribution('disabled-slug');

    expect(result).toEqual({ memberId: null, linkId: null });
  });

  it('returns nulls for an archived link', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: 'member1', enabled: true, archivedAt: new Date(),
    });

    const result = await resolveSignupAttribution('archived-slug');

    expect(result).toEqual({ memberId: null, linkId: null });
  });

  it('returns nulls for a nonexistent slug', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue(null);

    const result = await resolveSignupAttribution('nonexistent');

    expect(result).toEqual({ memberId: null, linkId: null });
  });

  it('returns nulls for null/empty slug', async () => {
    expect(await resolveSignupAttribution(null)).toEqual({ memberId: null, linkId: null });
    expect(await resolveSignupAttribution('')).toEqual({ memberId: null, linkId: null });
  });

  it('returns nulls for a link with no affiliate assigned', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({
      id: 'link1', affiliateId: null, enabled: true, archivedAt: null,
    });

    const result = await resolveSignupAttribution('unassigned-slug');

    expect(result).toEqual({ memberId: null, linkId: null });
  });
});
