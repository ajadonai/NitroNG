#!/usr/bin/env node
// Find real-refill alternatives for the 27 tiers where Nitro promises refill
// but the provider service says "Guaranteed" (not actual refill)
// Usage: node scripts/refill-alternatives.mjs

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

function parseRefillFromName(name) {
  const n = name.toLowerCase();
  if (/no\s*refill|refill\s*:\s*no|non[- ]?refill/i.test(n)) return { has: false, type: 'none' };
  if (/lifetime\s*(refill|auto\s*refill)|refill\s*:\s*lifetime/i.test(n)) return { has: true, type: 'lifetime' };
  const dayMatch = n.match(/(\d+)\s*days?\s*(?:auto\s*)?refill|refill\s*:\s*(\d+)\s*d/i);
  if (dayMatch) return { has: true, type: `${dayMatch[1] || dayMatch[2]}d` };
  if (/auto\s*refill/i.test(n)) return { has: true, type: 'auto-refill' };
  if (/refill/i.test(n)) {
    const parts = n.split(/refill/i);
    const before = parts[0].trim().split(/\s+/).pop();
    if (before !== 'no' && before !== 'non') return { has: true, type: 'yes' };
  }
  if (/lifetime\s*guarantee|guaranteed/i.test(n) && !/refill/i.test(n)) return { has: false, type: 'guaranteed-only' };
  return { has: false, type: 'unknown' };
}

function classifyPlatform(name) {
  const n = name.toLowerCase();
  if (/instagram|ig\b/.test(n)) return 'instagram';
  if (/tiktok/.test(n)) return 'tiktok';
  if (/youtube|yt\b/.test(n)) return 'youtube';
  if (/facebook|fb\b/.test(n)) return 'facebook';
  if (/twitter|\bx\b|x\/twitter/.test(n)) return 'twitter';
  if (/telegram/.test(n)) return 'telegram';
  if (/spotify/.test(n)) return 'spotify';
  if (/snapchat/.test(n)) return 'snapchat';
  if (/discord/.test(n)) return 'discord';
  if (/linkedin/.test(n)) return 'linkedin';
  if (/threads/.test(n)) return 'threads';
  if (/apple\s*music/.test(n)) return 'apple-music';
  if (/onlyfans/.test(n)) return 'onlyfans';
  return 'other';
}

function classifyType(name) {
  const n = name.toLowerCase();
  if (/follower|subscriber|member/.test(n)) return 'followers';
  if (/like|reaction/.test(n)) return 'likes';
  if (/view|watch|stream|play/.test(n)) return 'views';
  if (/comment/.test(n)) return 'comments';
  if (/share|repost|retweet|bookmark|save/.test(n)) return 'engagement';
  return 'other';
}

function qualitySignals(name) {
  const n = name.toLowerCase();
  const s = [];
  if (/uhq|ultra.?high/i.test(n)) s.push('UHQ');
  else if (/\bhq\b|high.?quality/i.test(n)) s.push('HQ');
  if (/real\b/i.test(n)) s.push('Real');
  if (/premium/i.test(n)) s.push('Premium');
  if (/non.?drop|low.?drop/i.test(n)) s.push('Low-drop');
  return s;
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

  // Find the 27 "guaranteed not refill" tiers
  const problematic = [];
  for (const g of groups) {
    for (const t of g.tiers) {
      if (!t.service) continue;
      if (!t.refill) continue; // only tiers that promise refill
      const parsed = parseRefillFromName(t.service.name);
      if (parsed.type === 'guaranteed-only' || (parsed.type === 'unknown' && !t.service.refill)) {
        problematic.push({
          group: g.name,
          groupId: g.id,
          tier: t.tier,
          tierId: t.id,
          nigerian: g.nigerian,
          platform: classifyPlatform(g.name),
          serviceType: classifyType(g.name),
          sellPer1k: t.sellPer1k,
          currentProvider: t.service.provider,
          currentApiId: t.service.apiId,
          currentName: t.service.name,
          currentCost: t.service.costPer1k,
          currentRefillType: parsed.type,
        });
      }
    }
  }

  console.log(`Found ${problematic.length} tiers promising refill without actual refill backing.\n`);

  const allServices = await prisma.service.findMany({ where: { enabled: true } });

  let output = '# Refill Alternatives — Replace "Guaranteed" with Actual Refill\n\n';
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Found **${problematic.length}** tiers where Nitro promises refill but provider only says "Guaranteed".\n\n`;
  output += 'For each, showing available services with **explicit refill** in the name.\n\n';
  output += '---\n\n';

  let withAlternatives = 0;
  let noAlternatives = 0;

  for (const p of problematic) {
    output += `## ${p.group} — ${p.tier}\n\n`;
    output += `**Current**: ${p.currentProvider}/${p.currentApiId} — "${p.currentName}"\n`;
    output += `**Issue**: Tier says refill=true, but service name says "${p.currentRefillType}" (not refill)\n`;
    output += `**Sell**: ₦${p.sellPer1k}/1k | **Cost**: ₦${p.currentCost}/1k\n\n`;

    // Find alternatives: same platform + type, with explicit refill in name
    const candidates = allServices.filter(s => {
      if (s.provider === p.currentProvider && s.apiId === p.currentApiId) return false;
      const sPlatform = classifyPlatform(s.name);
      const sType = classifyType(s.name);
      if (sPlatform !== p.platform) return false;
      if (sType !== p.serviceType) return false;
      // Must have explicit refill
      const refill = parseRefillFromName(s.name);
      if (!refill.has) return false;
      // Nigerian filter
      const isNG = /nigeria|🇳🇬/i.test(s.name);
      if (p.nigerian && !isNG) return false;
      if (!p.nigerian && isNG) return false;
      return true;
    }).sort((a, b) => {
      // Sort by refill quality (lifetime > 30d+ > generic), then by cost
      const ra = parseRefillFromName(a.name);
      const rb = parseRefillFromName(b.name);
      const rank = { lifetime: 4, 'auto-refill': 3, '365d': 3, '90d': 2, '60d': 2, '30d': 2, yes: 1 };
      const sa = rank[ra.type] || 1;
      const sb = rank[rb.type] || 1;
      if (sb !== sa) return sb - sa;
      // Then by quality signals
      const qa = qualitySignals(a.name).length;
      const qb = qualitySignals(b.name).length;
      if (qb !== qa) return qb - qa;
      return a.costPer1k - b.costPer1k;
    });

    if (candidates.length === 0) {
      output += '**No refill alternatives found.** Options:\n';
      output += '1. Turn off `refill=false` on this tier (honest)\n';
      output += '2. Keep as-is if "Guaranteed" is close enough for your customers\n\n';
      noAlternatives++;
    } else {
      withAlternatives++;
      output += `**${candidates.length} refill alternatives found:**\n\n`;
      output += '| # | Provider | API ID | Service Name | Refill Type | Quality | Cost/1k | vs Current |\n';
      output += '|---|----------|--------|-------------|-------------|---------|---------|------------|\n';
      const top = candidates.slice(0, 8);
      for (let i = 0; i < top.length; i++) {
        const c = top[i];
        const refill = parseRefillFromName(c.name);
        const qual = qualitySignals(c.name);
        const costDiff = c.costPer1k - p.currentCost;
        const diffStr = costDiff > 0 ? `+₦${costDiff}` : costDiff < 0 ? `-₦${Math.abs(costDiff)}` : 'same';
        output += `| ${i + 1} | ${c.provider} | ${c.apiId} | ${c.name.slice(0, 70)} | ${refill.type} | ${qual.join('/') || '—'} | ₦${c.costPer1k} | ${diffStr} |\n`;
      }
      output += '\n';

      // Recommend best
      const best = candidates[0];
      const bestRefill = parseRefillFromName(best.name);
      output += `**Recommended**: ${best.provider}/${best.apiId} — "${best.name.slice(0, 80)}" (${bestRefill.type} refill, ₦${best.costPer1k}/1k)\n\n`;
    }
    output += '---\n\n';
  }

  // Summary
  output += '## Summary\n\n';
  output += `| Metric | Count |\n|--------|-------|\n`;
  output += `| Total tiers with false refill promise | ${problematic.length} |\n`;
  output += `| Tiers with refill alternatives available | ${withAlternatives} |\n`;
  output += `| Tiers with NO alternatives (need refill=false) | ${noAlternatives} |\n`;

  fs.writeFileSync('docs/refill-alternatives.md', output);
  console.log(`\nWritten to docs/refill-alternatives.md`);
  console.log(`${withAlternatives} have alternatives | ${noAlternatives} need refill turned off`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
