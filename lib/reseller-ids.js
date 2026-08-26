import prisma from '@/lib/prisma';

// What the full catalogue lists (mirrors the catalogue route and the API).
export const FULL_CATALOGUE_WHERE = {
  provider: { in: ['mtp', 'dao'] },
  providerListedAt: { not: null },
  costPer1k: { gt: 0 },
  tiers: { none: {} },
};

/**
 * Mints a permanent reseller ID for everything a reseller can see that does
 * not have one yet: every enabled curated tier, and every full-catalogue
 * service. Append-only; nothing is ever deleted or renumbered.
 */
export async function mintMissingResellerIds({ write = true, db = prisma } = {}) {
  const tiers = await db.serviceTier.findMany({
    where: { enabled: true, group: { enabled: true }, service: { isNot: null }, resellerMap: null },
    select: { id: true },
  });
  const services = await db.service.findMany({
    where: { ...FULL_CATALOGUE_WHERE, resellerMap: null },
    select: { id: true },
  });
  const result = { tiersMinted: 0, servicesMinted: 0, tiersMissing: tiers.length, servicesMissing: services.length };
  if (!write) return result;
  if (tiers.length) {
    await db.resellerServiceMap.createMany({ data: tiers.map(t => ({ tierId: t.id })), skipDuplicates: true });
    result.tiersMinted = tiers.length;
  }
  if (services.length) {
    await db.resellerServiceMap.createMany({ data: services.map(s => ({ serviceId: s.id })), skipDuplicates: true });
    result.servicesMinted = services.length;
  }
  return result;
}
