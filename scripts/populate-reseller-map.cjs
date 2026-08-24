// Mints reseller-facing service IDs. Idempotent: the unique constraints on
// tierId/serviceId mean re-running maps only what is not yet mapped, so this can
// run again as the catalogue grows without renumbering anything.
//
// Curated tiers are mapped first so the flagship services take the low IDs.
// JAP is excluded outright — the provider is being dropped, and minting a
// permanent ID for a service scheduled to vanish just manufactures retirements.
// Runs in dry-run unless RESELLER_MAP_APPLY=yes. Not wrapped in the guarded-
// operation helper: that guard exists to keep destructive seeds off production,
// and refuses non-loopback databases outright — but this table only exists in
// production, and the operation is additive and idempotent (unique constraints
// on both target columns make re-runs map only the unmapped).
const FULL_PROVIDERS = ['mtp', 'dao'];

async function main({ prisma, dryRun, logger }) {
  // 1. Curated: every tier backed by a kept provider, in a stable, readable
  //    order (platform, group, tier) so the ID sequence is not arbitrary.
  const tiers = await prisma.serviceTier.findMany({
    where: { service: { provider: { in: FULL_PROVIDERS } } },
    select: { id: true, tier: true, group: { select: { name: true, platform: true } } },
  });
  tiers.sort((a, b) =>
    (a.group?.platform || '').localeCompare(b.group?.platform || '')
    || (a.group?.name || '').localeCompare(b.group?.name || '')
    || (a.tier || '').localeCompare(b.tier || ''));

  const mappedTiers = new Set(
    (await prisma.resellerServiceMap.findMany({ where: { tierId: { not: null } }, select: { tierId: true } }))
      .map(r => r.tierId),
  );
  const newTiers = tiers.filter(t => !mappedTiers.has(t.id));

  // 2. Full list: provider-listed, priceable, tierless services. Tiered services
  //    are curated-only by decision — listing them raw as well would undercut
  //    their own tiers at the Budget-equivalent price.
  const services = await prisma.service.findMany({
    where: {
      provider: { in: FULL_PROVIDERS },
      providerListedAt: { not: null },
      costPer1k: { gt: 0 },
      tiers: { none: {} },
    },
    select: { id: true, name: true, provider: true },
    orderBy: [{ category: 'asc' }, { apiId: 'asc' }],
  });
  const mappedServices = new Set(
    (await prisma.resellerServiceMap.findMany({ where: { serviceId: { not: null } }, select: { serviceId: true } }))
      .map(r => r.serviceId),
  );
  const newServices = services.filter(s => !mappedServices.has(s.id));

  logger.log(`curated tiers: ${tiers.length} total, ${newTiers.length} unmapped`);
  logger.log(`full-list services: ${services.length} eligible, ${newServices.length} unmapped`);

  if (dryRun) return { dryRun, wouldMapTiers: newTiers.length, wouldMapServices: newServices.length };

  // createMany preserves array order for autoincrement assignment, and
  // skipDuplicates makes a concurrent or repeated run harmless.
  if (newTiers.length) {
    await prisma.resellerServiceMap.createMany({
      data: newTiers.map(t => ({ tierId: t.id })),
      skipDuplicates: true,
    });
  }
  for (let i = 0; i < newServices.length; i += 1000) {
    await prisma.resellerServiceMap.createMany({
      data: newServices.slice(i, i + 1000).map(s => ({ serviceId: s.id })),
      skipDuplicates: true,
    });
  }

  const total = await prisma.resellerServiceMap.count();
  logger.log(`mapped ${newTiers.length} tiers + ${newServices.length} services; table now ${total} rows`);
  return { mappedTiers: newTiers.length, mappedServices: newServices.length, total };
}

if (require.main === module) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const dryRun = process.env.RESELLER_MAP_APPLY !== 'yes';
  console.log(`[populate-reseller-map] ${dryRun ? 'DRY-RUN (set RESELLER_MAP_APPLY=yes to write)' : 'APPLY'}`);
  main({ prisma, dryRun, logger: console })
    .then(r => { console.log(JSON.stringify(r)); return prisma.$disconnect(); })
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}

module.exports = { main };
