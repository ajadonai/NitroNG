import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const enabledGroups = await prisma.serviceGroup.count({ where:{ enabled:true } });
const liveGroups = await prisma.serviceGroup.count({ where:{ enabled:true, tiers:{ some:{ enabled:true } } } });
const emptyEnabled = await prisma.serviceGroup.findMany({
  where:{ enabled:true, tiers:{ none:{ enabled:true } } },
  select:{ name:true, platform:true, tiers:{ select:{ tier:true, enabled:true, service:{ select:{ provider:true, providerListedAt:true } } } } },
});
console.log(`enabled groups: ${enabledGroups}, of which live (>=1 enabled tier): ${liveGroups}`);
console.log(`\nENABLED GROUPS WITH NO ENABLED TIER: ${emptyEnabled.length}`);
for (const g of emptyEnabled) {
  console.log(`  ${g.name} (${g.platform}) — ${g.tiers.length} tier(s): ${g.tiers.map(t=>`${t.tier}:${t.service.provider}${t.service.providerListedAt?'':' UNLISTED'}`).join(', ')||'none'}`);
}
const tiers = await prisma.serviceTier.count({ where:{ enabled:true, group:{ enabled:true } } });
console.log(`\nlive tiers: ${tiers}`);
const byProv = await prisma.serviceTier.groupBy({ by:[], where:{}, _count:true }).catch(()=>null);
const japAll = await prisma.serviceTier.count({ where:{ service:{ provider:'jap' } } });
const japOn  = await prisma.serviceTier.count({ where:{ enabled:true, service:{ provider:'jap' } } });
console.log(`jap tiers: ${japAll} total, ${japOn} enabled`);
await prisma.$disconnect();
