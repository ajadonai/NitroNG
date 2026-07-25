#!/usr/bin/env node
// Quality-focused audit: find tiers where what we PROMISE doesn't match what the provider DELIVERS
// Usage: node scripts/quality-audit.mjs

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

function providerHasRefill(serviceName) {
  const n = serviceName.toLowerCase();
  if (/no\s*refill|refill:\s*no|non.?refill/i.test(n)) return false;
  if (/lifetime\s*(guarantee|refill)|refill:\s*lifetime/i.test(n)) return 'lifetime';
  if (/(\d+)\s*day\s*refill|refill:\s*(\d+)d/i.test(n)) {
    const match = n.match(/(\d+)\s*day\s*refill|refill:\s*(\d+)d/i);
    return `${match[1] || match[2]}d`;
  }
  if (/refill/i.test(n) && !/no/i.test(n.split('refill')[0].slice(-5))) return 'yes';
  return false;
}

function providerQualitySignals(name) {
  const n = name.toLowerCase();
  const signals = [];
  if (/uhq|ultra.?high/i.test(n)) signals.push('UHQ');
  else if (/\bhq\b|high.?quality/i.test(n)) signals.push('HQ');
  if (/real\b/i.test(n)) signals.push('Real');
  if (/bot|fake|lq\b|low.?quality/i.test(n)) signals.push('LQ');
  if (/non.?drop|low.?drop/i.test(n)) signals.push('Low-drop');
  if (/guaranteed|guarantee/i.test(n)) signals.push('Guaranteed');
  if (/old.?account/i.test(n)) signals.push('Old-accounts');
  return signals;
}

function classifyPlatform(name, groupPlatform) {
  const combined = (name + ' ' + groupPlatform).toLowerCase();
  if (/instagram|ig\b/.test(combined)) return 'instagram';
  if (/tiktok/.test(combined)) return 'tiktok';
  if (/youtube|yt\b/.test(combined)) return 'youtube';
  if (/facebook|fb\b/.test(combined)) return 'facebook';
  if (/twitter|\bx\b/.test(combined)) return 'twitter';
  if (/telegram/.test(combined)) return 'telegram';
  if (/spotify/.test(combined)) return 'spotify';
  if (/snapchat/.test(combined)) return 'snapchat';
  if (/discord/.test(combined)) return 'discord';
  if (/linkedin/.test(combined)) return 'linkedin';
  if (/threads/.test(combined)) return 'threads';
  return combined.split(/\s/)[0];
}

function classifyType(name) {
  const n = name.toLowerCase();
  if (/comment/.test(n)) return 'comments';
  if (/follower|subscriber|member/.test(n)) return 'followers';
  if (/like|reaction/.test(n)) return 'likes';
  if (/view|watch|stream|play/.test(n)) return 'views';
  if (/share|repost|retweet|bookmark|save/.test(n)) return 'engagement';
  return 'other';
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

  const allServices = await prisma.service.findMany();

  let output = '# Quality Audit — Promise vs Reality\n\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;

  // ═══ SECTION 1: Refill mismatches ═══
  const refillMismatches = [];
  const wrongServices = [];
  const tierQualityMismatches = [];

  for (const g of groups) {
    for (const t of g.tiers) {
      if (!t.service) continue;
      const s = t.service;

      // Check platform mismatch (wrong service entirely)
      const groupPlat = classifyPlatform(g.name, g.platform);
      const servicePlat = classifyPlatform(s.name, s.category);
      if (groupPlat !== servicePlat && groupPlat !== 'unknown' && servicePlat !== 'unknown') {
        wrongServices.push({
          group: g.name, tier: t.tier, nigerian: g.nigerian,
          tierRefill: t.refill, tierSell: t.sellPer1k,
          provider: s.provider, apiId: s.apiId, serviceName: s.name,
          issue: `Wrong platform: selling ${groupPlat} but linked to ${servicePlat} service`,
        });
        continue;
      }

      // Check refill mismatch
      const nitroSaysRefill = t.refill;
      const providerRefill = providerHasRefill(s.name);

      if (nitroSaysRefill && !providerRefill) {
        refillMismatches.push({
          group: g.name, tier: t.tier, nigerian: g.nigerian,
          tierSell: t.sellPer1k,
          provider: s.provider, apiId: s.apiId, serviceName: s.name,
          issue: 'Nitro says REFILL but provider service says NO REFILL',
        });
      }

      // Check: tier is "Premium" but service has no quality signals, or has LQ signals
      const quality = providerQualitySignals(s.name);
      if (t.tier === 'Premium' && quality.includes('LQ')) {
        tierQualityMismatches.push({
          group: g.name, tier: t.tier, nigerian: g.nigerian,
          tierSell: t.sellPer1k,
          provider: s.provider, apiId: s.apiId, serviceName: s.name,
          issue: `Premium tier but service is Low Quality: ${quality.join(', ')}`,
        });
      }

      // Check: tier is Premium but service has "No Refill" and no quality tags
      if (t.tier === 'Premium' && !providerRefill && quality.length === 0) {
        tierQualityMismatches.push({
          group: g.name, tier: t.tier, nigerian: g.nigerian,
          tierSell: t.sellPer1k,
          provider: s.provider, apiId: s.apiId, serviceName: s.name,
          issue: 'Premium tier but provider service has no refill and no quality signals',
        });
      }
    }
  }

  // ═══ SECTION 1: Wrong services ═══
  output += `## 1. Wrong Service Mapped (${wrongServices.length} tiers)\n\n`;
  output += 'These tiers link to a service for a completely different platform.\n\n';
  if (wrongServices.length > 0) {
    output += '| Group | Tier | Provider/ID | Actual Service | Issue |\n';
    output += '|-------|------|-------------|---------------|-------|\n';
    for (const m of wrongServices) {
      output += `| ${m.group}${m.nigerian ? ' 🇳🇬' : ''} | ${m.tier} | ${m.provider}/${m.apiId} | ${m.serviceName.slice(0, 70)} | ${m.issue} |\n`;
    }
  }
  output += '\n---\n\n';

  // ═══ SECTION 2: Refill mismatches ═══
  output += `## 2. Refill Mismatches (${refillMismatches.length} tiers)\n\n`;
  output += 'Nitro tells the customer this service has refill, but the provider service does NOT have refill.\n\n';
  if (refillMismatches.length > 0) {
    output += '| Group | Tier | Provider/ID | Provider Service Name | Sell/1k |\n';
    output += '|-------|------|-------------|----------------------|--------|\n';
    for (const m of refillMismatches) {
      output += `| ${m.group}${m.nigerian ? ' 🇳🇬' : ''} | ${m.tier} | ${m.provider}/${m.apiId} | ${m.serviceName.slice(0, 80)} | ₦${m.tierSell} |\n`;
    }

    // Now find refill alternatives for each mismatch
    output += '\n### Recommended fixes\n\n';
    for (const m of refillMismatches) {
      const groupPlat = classifyPlatform(m.group, '');
      const groupType = classifyType(m.group);
      const isNG = m.nigerian;

      // Find services from same platform + type that DO have refill
      const candidates = allServices.filter(alt => {
        if (alt.provider === m.provider && alt.apiId === m.apiId) return false;
        const altPlat = classifyPlatform(alt.name, alt.category);
        const altType = classifyType(alt.name);
        if (altPlat !== groupPlat) return false;
        if (altType !== groupType) return false;
        if (isNG && !/nigeria|🇳🇬/i.test(alt.name)) return false;
        if (!isNG && /nigeria|🇳🇬/i.test(alt.name)) return false;
        const altRefill = providerHasRefill(alt.name);
        if (!altRefill) return false;
        return true;
      }).sort((a, b) => {
        // Prefer: lifetime > 30d > any refill, then by cost
        const ra = providerHasRefill(a.name);
        const rb = providerHasRefill(b.name);
        const refillRank = { lifetime: 3, '365d': 3, '90d': 2, '60d': 2, '30d': 2, yes: 1 };
        const scoreA = refillRank[ra] || 1;
        const scoreB = refillRank[rb] || 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.costPer1k - b.costPer1k;
      });

      output += `**${m.group}${isNG ? ' 🇳🇬' : ''} (${m.tier})** — current: ${m.provider}/${m.apiId}\n`;
      if (candidates.length === 0) {
        output += '  _No refill alternatives found for this platform/type._\n\n';
      } else {
        const top = candidates.slice(0, 5);
        for (const c of top) {
          const refill = providerHasRefill(c.name);
          const qual = providerQualitySignals(c.name);
          output += `  → ${c.provider}/${c.apiId} — "${c.name.slice(0, 85)}" (₦${c.costPer1k}/1k, refill: ${refill}${qual.length ? ', ' + qual.join('/') : ''})\n`;
        }
        output += '\n';
      }
    }
  }
  output += '\n---\n\n';

  // ═══ SECTION 3: Premium tier quality issues ═══
  output += `## 3. Premium Tier Quality Concerns (${tierQualityMismatches.length} tiers)\n\n`;
  output += 'Premium tiers should have the strongest services. These have red flags.\n\n';
  if (tierQualityMismatches.length > 0) {
    output += '| Group | Tier | Provider/ID | Provider Service Name | Issue |\n';
    output += '|-------|------|-------------|----------------------|-------|\n';
    for (const m of tierQualityMismatches) {
      output += `| ${m.group}${m.nigerian ? ' 🇳🇬' : ''} | ${m.tier} | ${m.provider}/${m.apiId} | ${m.serviceName.slice(0, 70)} | ${m.issue} |\n`;
    }
  }

  // ═══ SECTION 4: Quick summary ═══
  output += '\n---\n\n## Summary\n\n';
  output += `| Issue Type | Count |\n|------------|-------|\n`;
  output += `| ❌ Wrong service (different platform) | ${wrongServices.length} |\n`;
  output += `| 🔄 Refill mismatch (promised but not delivered) | ${refillMismatches.length} |\n`;
  output += `| ⚠️ Premium tier quality concern | ${tierQualityMismatches.length} |\n`;
  output += `| **Total issues** | **${wrongServices.length + refillMismatches.length + tierQualityMismatches.length}** |\n`;

  fs.writeFileSync('docs/quality-audit.md', output);
  console.log(`Written to docs/quality-audit.md`);
  console.log(`❌ ${wrongServices.length} wrong | 🔄 ${refillMismatches.length} refill mismatches | ⚠️ ${tierQualityMismatches.length} quality concerns`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
