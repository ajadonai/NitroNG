#!/usr/bin/env node
// Focused refill audit: find tiers where Nitro promises refill but provider doesn't deliver it
// Also find tiers where provider HAS refill but Nitro doesn't advertise it (missed opportunity)
// Usage: node scripts/refill-audit.mjs

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

function parseProviderRefill(name) {
  const n = name.toLowerCase();
  // Explicit "No Refill" or "Refill: No"
  if (/no\s*refill|refill\s*:\s*no|non[- ]?refill/i.test(n)) return { has: false, type: 'none' };
  // Lifetime
  if (/lifetime\s*(guarantee|refill)|refill\s*:\s*lifetime|lifetime\s*guaranteed/i.test(n)) return { has: true, type: 'lifetime' };
  // N-day refill
  const dayMatch = n.match(/(\d+)\s*days?\s*(?:auto\s*)?refill|refill\s*:\s*(\d+)\s*d/i);
  if (dayMatch) return { has: true, type: `${dayMatch[1] || dayMatch[2]}d` };
  // Generic refill mention (without "No" before it)
  if (/refill/i.test(n)) {
    // Check the word before "refill" isn't "no"
    const parts = n.split(/refill/i);
    const before = parts[0].trim().split(/\s+/).pop();
    if (before !== 'no' && before !== 'non') return { has: true, type: 'yes' };
  }
  // "Guaranteed" without "refill" — this is a retention guarantee, not refill
  if (/guaranteed|guarantee/i.test(n) && !/refill/i.test(n)) return { has: false, type: 'guaranteed-no-refill' };
  return { has: false, type: 'unknown' };
}

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

  let output = '# Refill Audit\n\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;

  const falseRefill = []; // Nitro says refill, provider says no
  const missedRefill = []; // Provider has refill, Nitro doesn't advertise
  const allTierRefillStatus = []; // Everything for reference

  for (const g of groups) {
    for (const t of g.tiers) {
      if (!t.service) continue;
      const s = t.service;
      const providerRefill = parseProviderRefill(s.name);

      const row = {
        group: g.name,
        tier: t.tier,
        nigerian: g.nigerian,
        nitroRefill: t.refill,
        providerRefill: providerRefill,
        provider: s.provider,
        apiId: s.apiId,
        serviceName: s.name,
        serviceRefillFlag: s.refill,
        sellPer1k: t.sellPer1k,
      };

      allTierRefillStatus.push(row);

      // Nitro tier says refill=true but provider service clearly says "No Refill"
      if (t.refill && !providerRefill.has && providerRefill.type === 'none') {
        falseRefill.push(row);
      }

      // Also check: Nitro tier refill=true but service.refill=false
      if (t.refill && !s.refill && !providerRefill.has) {
        if (!falseRefill.includes(row)) falseRefill.push(row);
      }

      // Provider has refill but Nitro tier doesn't advertise it
      if (!t.refill && providerRefill.has) {
        missedRefill.push(row);
      }
    }
  }

  // ═══ FALSE REFILL: Nitro promises, provider doesn't deliver ═══
  output += `## False Refill — We Promise Refill, Provider Doesn't (${falseRefill.length})\n\n`;
  output += 'These are the most critical. Customers pay premium prices expecting refill.\n\n';
  if (falseRefill.length > 0) {
    output += '| Group | Tier | Provider/ID | Service Name | Provider Says |\n';
    output += '|-------|------|-------------|-------------|---------------|\n';
    for (const r of falseRefill) {
      output += `| ${r.group}${r.nigerian ? ' 🇳🇬' : ''} | ${r.tier} | ${r.provider}/${r.apiId} | ${r.serviceName.slice(0, 75)} | ${r.providerRefill.type} |\n`;
    }
  } else {
    output += '_None found._\n';
  }

  // ═══ MISSED REFILL: Provider delivers refill, we don't advertise ═══
  output += `\n---\n\n## Missed Refill — Provider Has Refill, We Don't Advertise (${missedRefill.length})\n\n`;
  output += 'We could turn on the refill badge for these tiers (free quality upgrade in customers eyes).\n\n';
  if (missedRefill.length > 0) {
    output += '| Group | Tier | Provider/ID | Service Name | Provider Refill Type |\n';
    output += '|-------|------|-------------|-------------|---------------------|\n';
    for (const r of missedRefill) {
      output += `| ${r.group}${r.nigerian ? ' 🇳🇬' : ''} | ${r.tier} | ${r.provider}/${r.apiId} | ${r.serviceName.slice(0, 75)} | ${r.providerRefill.type} |\n`;
    }
  } else {
    output += '_None found._\n';
  }

  // ═══ Full reference: every tier's refill status ═══
  output += `\n---\n\n## Full Reference — All Tiers Refill Status (${allTierRefillStatus.length})\n\n`;
  output += '| Group | Tier | Nitro Refill | Service Refill Flag | Provider Name Says | Match? |\n';
  output += '|-------|------|-------------|--------------------|--------------------|--------|\n';
  for (const r of allTierRefillStatus) {
    const match = (r.nitroRefill === r.providerRefill.has) ? '✅' :
                  (r.nitroRefill && !r.providerRefill.has) ? '❌ FALSE' :
                  (!r.nitroRefill && r.providerRefill.has) ? '💡 MISSED' : '—';
    output += `| ${r.group}${r.nigerian ? ' 🇳🇬' : ''} | ${r.tier} | ${r.nitroRefill ? 'Yes' : 'No'} | ${r.serviceRefillFlag ? 'Yes' : 'No'} | ${r.providerRefill.type} | ${match} |\n`;
  }

  output += `\n---\n\n## Summary\n\n`;
  output += `| Issue | Count |\n|-------|-------|\n`;
  output += `| ❌ False refill (we promise, provider doesn't) | ${falseRefill.length} |\n`;
  output += `| 💡 Missed refill (provider has, we don't advertise) | ${missedRefill.length} |\n`;
  output += `| ✅ Correctly matched | ${allTierRefillStatus.length - falseRefill.length - missedRefill.length} |\n`;

  fs.writeFileSync('docs/refill-audit.md', output);
  console.log(`Written to docs/refill-audit.md`);
  console.log(`❌ ${falseRefill.length} false refill | 💡 ${missedRefill.length} missed refill | ✅ ${allTierRefillStatus.length - falseRefill.length - missedRefill.length} correct`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
