#!/usr/bin/env node
// One-shot script: dump the full service catalogue (groups → tiers → provider services)
// Usage: node scripts/dump-catalogue.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.serviceGroup.findMany({
    orderBy: [{ platform: 'asc' }, { sortOrder: 'asc' }],
    include: {
      tiers: {
        orderBy: { sortOrder: 'asc' },
        include: {
          service: {
            select: {
              id: true, apiId: true, name: true, provider: true,
              costPer1k: true, sellPer1k: true, min: true, max: true,
              refill: true, avgTime: true, enabled: true,
            },
          },
        },
      },
    },
  });

  let output = '# Service Catalogue Dump\n\n';
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total groups: ${groups.length}\n`;
  output += `Total tiers: ${groups.reduce((s, g) => s + g.tiers.length, 0)}\n\n`;

  let currentPlatform = '';
  for (const g of groups) {
    if (g.platform !== currentPlatform) {
      currentPlatform = g.platform;
      output += `---\n\n## ${currentPlatform}\n\n`;
    }

    const flags = [];
    if (g.nigerian) flags.push('🇳🇬 Nigerian');
    if (!g.enabled) flags.push('DISABLED');
    output += `### ${g.name}${flags.length ? ` (${flags.join(', ')})` : ''}\n`;
    output += `Type: ${g.type}\n\n`;

    if (g.tiers.length === 0) {
      output += '_No tiers configured_\n\n';
      continue;
    }

    output += '| Tier | Provider | API ID | Service Name | Cost/1k | Sell/1k | Refill | Speed | Min | Max | Enabled |\n';
    output += '|------|----------|--------|-------------|---------|---------|--------|-------|-----|-----|--------|\n';

    for (const t of g.tiers) {
      const s = t.service;
      if (s) {
        output += `| ${t.tier} | ${s.provider} | ${s.apiId} | ${s.name} | ₦${s.costPer1k} | ₦${t.sellPer1k} | ${t.refill ? 'Yes' : 'No'} | ${t.speed} | ${s.min} | ${s.max} | ${t.enabled ? 'Yes' : 'No'} |\n`;
      } else {
        output += `| ${t.tier} | — | — | **NO SERVICE LINKED** | — | ₦${t.sellPer1k} | ${t.refill ? 'Yes' : 'No'} | ${t.speed} | — | — | ${t.enabled ? 'Yes' : 'No'} |\n`;
      }
    }
    output += '\n';
  }

  // Summary: tiers without services, disabled tiers, etc.
  const unlinked = groups.flatMap(g => g.tiers.filter(t => !t.service).map(t => ({ group: g.name, tier: t.tier })));
  const disabled = groups.flatMap(g => g.tiers.filter(t => !t.enabled).map(t => ({ group: g.name, tier: t.tier })));

  if (unlinked.length > 0) {
    output += '\n---\n\n## Warnings\n\n';
    output += `### Tiers with no service linked (${unlinked.length})\n\n`;
    for (const u of unlinked) output += `- ${u.group} → ${u.tier}\n`;
  }

  if (disabled.length > 0) {
    output += `\n### Disabled tiers (${disabled.length})\n\n`;
    for (const d of disabled) output += `- ${d.group} → ${d.tier}\n`;
  }

  const outPath = 'docs/catalogue-dump.md';
  const fs = await import('fs');
  fs.writeFileSync(outPath, output);
  console.log(`Written to ${outPath}`);
  console.log(`${groups.length} groups, ${groups.reduce((s, g) => s + g.tiers.length, 0)} tiers`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
