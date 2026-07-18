import prisma from '@/lib/prisma';
import { isActiveCrewMember } from '@/lib/affiliate-eligibility';

/**
 * Resolve a signup slug to frozen attribution IDs.
 * Returns { memberId, linkId } if the link is valid, enabled, and not archived.
 * Returns { memberId: null, linkId: null } otherwise.
 */
export async function resolveSignupAttribution(slug) {
  if (!slug) return { memberId: null, linkId: null };
  const link = await prisma.acquisitionLink.findUnique({
    where: { slug },
    select: {
      id: true,
      affiliateId: true,
      enabled: true,
      archivedAt: true,
      affiliate: { select: { status: true, deletedAt: true } },
    },
  });
  if (link?.affiliateId && link.enabled && !link.archivedAt && isActiveCrewMember(link.affiliate)) {
    return { memberId: link.affiliateId, linkId: link.id };
  }
  return { memberId: null, linkId: null };
}

export async function getTeamIds(chiefId) {
  const crew = await prisma.crewMember.findMany({
    where: { leadId: chiefId, status: "approved", deletedAt: null },
    select: { id: true },
  });
  return new Set([chiefId, ...crew.map(m => m.id)]);
}

export async function verifyLinkOwnership(linkId, chiefId) {
  const link = await prisma.acquisitionLink.findUnique({
    where: { id: linkId },
    select: { id: true, affiliateId: true, createdByChiefId: true },
  });
  if (!link) return null;
  return link.createdByChiefId === chiefId ? link : null;
}
