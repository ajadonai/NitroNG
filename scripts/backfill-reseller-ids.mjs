// Mints reseller IDs for anything a reseller can see that has none. The
// sync-services cron does this automatically; this is the manual door.
// Dry run by default.
//
//   node scripts/backfill-reseller-ids.mjs            # counts only
//   node scripts/backfill-reseller-ids.mjs --write    # mint
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const write = process.argv.includes('--write');
const FULL_WHERE = { provider: { in: ['mtp', 'dao'] }, providerListedAt: { not: null }, costPer1k: { gt: 0 }, tiers: { none: {} } };

const tiers = await prisma.serviceTier.findMany({ where: { enabled: true, group: { enabled: true }, service: { isNot: null }, resellerMap: null }, select: { id: true } });
const services = await prisma.service.findMany({ where: { ...FULL_WHERE, resellerMap: null }, select: { id: true } });
console.log(`tiers without an ID: ${tiers.length} · full-catalogue services without an ID: ${services.length}`);
if (!write) { console.log('dry run; pass --write to mint'); }
else {
  if (tiers.length) await prisma.resellerServiceMap.createMany({ data: tiers.map(t => ({ tierId: t.id })), skipDuplicates: true });
  if (services.length) await prisma.resellerServiceMap.createMany({ data: services.map(s => ({ serviceId: s.id })), skipDuplicates: true });
  console.log(`minted ${tiers.length + services.length}; map now holds ${await prisma.resellerServiceMap.count()} IDs`);
}
await prisma.$disconnect();
