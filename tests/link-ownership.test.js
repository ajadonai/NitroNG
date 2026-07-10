import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  acquisitionLink: { findUnique: vi.fn() },
  crewMember: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const { getTeamIds, verifyLinkOwnership } = await import('@/lib/link-ownership');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('link ownership verification', () => {
  it('allows chief to access their own link', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'chief1', createdByChiefId: 'chief1' });

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).not.toBeNull();
  });

  it("allows chief to access link assigned to crew member", async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'crew1', createdByChiefId: 'chief1' });

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).not.toBeNull();
  });

  it("blocks chief from accessing another chief's link", async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'chief2', createdByChiefId: 'chief2' });

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).toBeNull();
  });

  it("blocks chief from accessing link created by another chief even if assigned to shared crew", async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'crew1', createdByChiefId: 'chief2' });

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).toBeNull();
  });

  it('returns null for nonexistent links', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue(null);

    const result = await verifyLinkOwnership('nope', 'chief1');
    expect(result).toBeNull();
  });

  it('chief cannot assign links to another chief\'s member', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([{ id: 'crew1' }]);
    const teamIds = await getTeamIds('chief1');

    expect(teamIds.has('chief1')).toBe(true);
    expect(teamIds.has('crew1')).toBe(true);
    expect(teamIds.has('otherCrew')).toBe(false);
    expect(teamIds.has('chief2')).toBe(false);
  });
});

describe('hierarchy invariants', () => {
  it('chief self-assignment is included in team IDs', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([]);
    const teamIds = await getTeamIds('chief1');
    expect(teamIds.has('chief1')).toBe(true);
  });

  it('team IDs include all approved crew under a chief', async () => {
    mockPrisma.crewMember.findMany.mockResolvedValue([
      { id: 'c1' }, { id: 'c2' }, { id: 'c3' },
    ]);
    const teamIds = await getTeamIds('chief1');
    expect(teamIds.size).toBe(4);
    expect(teamIds.has('chief1')).toBe(true);
    expect(teamIds.has('c1')).toBe(true);
    expect(teamIds.has('c2')).toBe(true);
    expect(teamIds.has('c3')).toBe(true);
  });
});
