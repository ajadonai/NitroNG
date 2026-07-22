#!/usr/bin/env node
// Check tier.refill vs service.refill (from provider API) — the DB-level mismatch
// Usage: node scripts/refill-db-audit.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.serviceGroup.findMany({
    orderBy: [{ platform: 'asc' }, { sortOrder: 'asc' }],
    include: {
      tiers: {
        orderBy: { sortOrder: 'asc' },
        include: { service: true },
      },
    },
  });

  console.log('Tiers where Nitro says REFILL but provider API says NO REFILL:\n');
  console.log('Group | Tier | Provider/ID | Nitro Refill | Service DB Refill | Service Name');
  console.log('─'.repeat(140));

  let count = 0;
  const rows = [];

  for (const g of groups) {
    for (const t of g.tiers) {
      if (!t.service) continue;
      const s = t.service;

      if (t.refill && !s.refill) {
        count++;
        const row = `${g.name}${g.nigerian ? ' 🇳🇬' : ''} | ${t.tier} | ${s.provider}/${s.apiId} | YES | NO | ${s.name.slice(0, 80)}`;
        console.log(row);
        rows.push({ group: g.name, tier: t.tier, nigerian: g.nigerian, provider: s.provider, apiId: s.apiId, name: s.name, refill: s.refill });
      }
    }
  }

  console.log(`\n─── ${count} mismatches found ───\n`);

  // Also show the reverse: provider says refill but Nitro doesn't
  console.log('\nTiers where provider API says REFILL but Nitro says NO REFILL:\n');
  let count2 = 0;
  for (const g of groups) {
    for (const t of g.tiers) {
      if (!t.service) continue;
      if (!t.refill && t.service.refill) {
        count2++;
        console.log(`${g.name}${g.nigerian ? ' 🇳🇬' : ''} | ${t.tier} | ${t.service.provider}/${t.service.apiId} | NO | YES | ${t.service.name.slice(0, 80)}`);
      }
    }
  }
  console.log(`\n─── ${count2} missed opportunities ───`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
