import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const mockPrisma = {
  acquisitionLink: { findUnique: vi.fn() },
  crewMember: { findMany: vi.fn() },
};

vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

beforeEach(() => {
  vi.clearAllMocks();
});

// Replicate the ownership logic from the route
async function getTeamIds(chiefId) {
  const crew = await mockPrisma.crewMember.findMany({
    where: { leadId: chiefId, status: "approved" },
    select: { id: true },
  });
  return new Set([chiefId, ...crew.map(m => m.id)]);
}

async function verifyLinkOwnership(linkId, chiefId) {
  const link = await mockPrisma.acquisitionLink.findUnique({
    where: { id: linkId },
    select: { id: true, affiliateId: true },
  });
  if (!link) return null;
  const teamIds = await getTeamIds(chiefId);
  if (!teamIds.has(link.affiliateId)) return null;
  return link;
}

describe('link ownership verification', () => {
  it('allows chief to access their own link', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'chief1' });
    mockPrisma.crewMember.findMany.mockResolvedValue([]);

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).not.toBeNull();
  });

  it("allows chief to access their crew member's link", async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'crew1' });
    mockPrisma.crewMember.findMany.mockResolvedValue([{ id: 'crew1' }, { id: 'crew2' }]);

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).not.toBeNull();
  });

  it("blocks chief from accessing another chief's link", async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'chief2' });
    mockPrisma.crewMember.findMany.mockResolvedValue([{ id: 'crew1' }]); // chief1's crew

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).toBeNull();
  });

  it("blocks chief from accessing another chief's crew member's link", async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue({ id: 'link1', affiliateId: 'otherCrew' });
    mockPrisma.crewMember.findMany.mockResolvedValue([{ id: 'crew1' }]); // chief1's crew doesn't include otherCrew

    const result = await verifyLinkOwnership('link1', 'chief1');
    expect(result).toBeNull();
  });

  it('returns null for nonexistent links', async () => {
    mockPrisma.acquisitionLink.findUnique.mockResolvedValue(null);

    const result = await verifyLinkOwnership('nope', 'chief1');
    expect(result).toBeNull();
  });

  it('chief cannot assign links to another chief\'s member', async () => {
    // Team membership check: chief1's team is [chief1, crew1]
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
    expect(teamIds.size).toBe(4); // chief + 3 crew
    expect(teamIds.has('chief1')).toBe(true);
    expect(teamIds.has('c1')).toBe(true);
    expect(teamIds.has('c2')).toBe(true);
    expect(teamIds.has('c3')).toBe(true);
  });
});
