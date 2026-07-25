#!/usr/bin/env node
// Audit ALL service tiers against provider catalogues to find stronger alternatives
// Usage: node scripts/audit-all-tiers.mjs

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

function classifyServiceType(name) {
  const n = name.toLowerCase();
  if (/comment/.test(n)) return 'comments';
  if (/follower|subscriber|member|connection/.test(n)) return 'followers';
  if (/like|reaction/.test(n)) return 'likes';
  if (/view|watch|stream|play/.test(n)) return 'views';
  if (/share|repost|reblog|retweet|bookmark/.test(n)) return 'engagement';
  if (/save|favorite/.test(n)) return 'engagement';
  if (/review|rating/.test(n)) return 'reviews';
  if (/boost/.test(n)) return 'boost';
  if (/vote|poll/.test(n)) return 'engagement';
  if (/impression|reach/.test(n)) return 'engagement';
  return 'other';
}

function classifyPlatform(name, category) {
  const combined = (name + ' ' + category).toLowerCase();
  if (/instagram|ig\b/.test(combined)) return 'instagram';
  if (/tiktok|tik tok/.test(combined)) return 'tiktok';
  if (/youtube|yt\b/.test(combined)) return 'youtube';
  if (/facebook|fb\b/.test(combined)) return 'facebook';
  if (/twitter|x\/twitter|\bx\b/.test(combined)) return 'twitter';
  if (/telegram/.test(combined)) return 'telegram';
  if (/spotify/.test(combined)) return 'spotify';
  if (/soundcloud/.test(combined)) return 'soundcloud';
  if (/discord/.test(combined)) return 'discord';
  if (/linkedin/.test(combined)) return 'linkedin';
  if (/pinterest/.test(combined)) return 'pinterest';
  if (/snapchat/.test(combined)) return 'snapchat';
  if (/threads/.test(combined)) return 'threads';
  if (/twitch/.test(combined)) return 'twitch';
  if (/reddit/.test(combined)) return 'reddit';
  if (/whatsapp/.test(combined)) return 'whatsapp';
  if (/audiomack/.test(combined)) return 'audiomack';
  if (/boomplay/.test(combined)) return 'boomplay';
  if (/deezer/.test(combined)) return 'deezer';
  if (/apple music/.test(combined)) return 'apple_music';
  if (/shazam/.test(combined)) return 'shazam';
  if (/mixcloud/.test(combined)) return 'mixcloud';
  if (/quora/.test(combined)) return 'quora';
  if (/tumblr/.test(combined)) return 'tumblr';
  if (/onlyfans/.test(combined)) return 'onlyfans';
  if (/vimeo/.test(combined)) return 'vimeo';
  if (/kick\b/.test(combined)) return 'kick';
  if (/trustpilot/.test(combined)) return 'trustpilot';
  if (/google/.test(combined)) return 'google';
  return 'unknown';
}

function hasRefill(name) {
  const n = name.toLowerCase();
  if (/lifetime|life time/.test(n)) return 'lifetime';
  if (/\d+\s*day\s*refill|\brefill:\s*\d+d/i.test(n)) return '30d';
  if (/refill/.test(n) && !/no\s*refill|refill:\s*no/i.test(n)) return 'yes';
  return 'none';
}

function qualityTier(name) {
  const n = name.toLowerCase();
  if (/uhq|ultra high quality|real\b/.test(n)) return 3;
  if (/hq\b|high quality/.test(n)) return 2;
  if (/lq\b|low quality|bot/.test(n)) return 0;
  return 1;
}

function isNigerian(name) {
  return /nigeria|🇳🇬/i.test(name);
}

function isGeoTargeted(name) {
  return /nigeria|🇳🇬|usa|🇺🇸|uk\b|🇬🇧|turkey|🇹🇷|india|🇮🇳|brazil|🇧🇷|china|🇨🇳|ghana|🇬🇭|egypt|🇪🇬|arab|korean|japan|vietnam|spain|french|german|iraq|mexico|thai|indonesia|israel/i.test(name);
}

async function main() {
  // Load all tiers with their linked services and groups
  const groups = await prisma.serviceGroup.findMany({
    orderBy: [{ platform: 'asc' }, { sortOrder: 'asc' }],
    include: {
      tiers: {
        orderBy: { sortOrder: 'asc' },
        include: {
          service: true,
        },
      },
    },
  });

  // Load ALL synced services indexed by platform+type
  const allServices = await prisma.service.findMany();
  console.log(`Loaded ${allServices.length} synced services across all providers`);

  // Index services by platform
  const servicesByPlatform = {};
  for (const s of allServices) {
    const plat = classifyPlatform(s.name, s.category);
    if (!servicesByPlatform[plat]) servicesByPlatform[plat] = [];
    servicesByPlatform[plat].push(s);
  }

  let output = '# Full Service Tier Audit\n\n';
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Groups: ${groups.length} | Tiers: ${groups.reduce((s, g) => s + g.tiers.length, 0)} | Synced services: ${allServices.length}\n\n`;
  output += 'Legend: ✅ = good as-is | ⚠️ = stronger alternative available | ❌ = wrong service mapped | 🔲 = no service linked\n\n';

  let stats = { good: 0, upgradeable: 0, wrong: 0, unlinked: 0 };
  const upgrades = [];

  let currentPlatform = '';

  for (const g of groups) {
    if (g.platform !== currentPlatform) {
      currentPlatform = g.platform;
      output += `---\n\n## ${currentPlatform}\n\n`;
    }

    output += `### ${g.name}${g.nigerian ? ' 🇳🇬' : ''}\n\n`;

    for (const t of g.tiers) {
      if (!t.service) {
        output += `- **${t.tier}**: 🔲 No service linked\n`;
        stats.unlinked++;
        continue;
      }

      const s = t.service;
      const groupPlatform = classifyPlatform(g.name, g.platform);
      const servicePlatform = classifyPlatform(s.name, s.category);
      const groupType = classifyServiceType(g.name);
      const serviceType = classifyServiceType(s.name);

      // Check if completely wrong platform/type
      if (groupPlatform !== servicePlatform && groupPlatform !== 'unknown' && servicePlatform !== 'unknown') {
        output += `- **${t.tier}**: ❌ WRONG — "${s.name.slice(0, 80)}" (${s.provider}/${s.apiId}) — is ${servicePlatform}/${serviceType}, should be ${groupPlatform}/${groupType}\n`;
        stats.wrong++;
        continue;
      }

      // Find alternatives on same platform + similar type
      const candidates = (servicesByPlatform[groupPlatform] || []).filter(alt => {
        if (alt.id === s.id) return false;
        const altType = classifyServiceType(alt.name);

        // Type must match
        if (altType !== groupType && altType !== serviceType) return false;

        // Nigerian group? Prefer Nigerian services
        if (g.nigerian && !isNigerian(alt.name)) return false;
        // Non-Nigerian group? Skip geo-targeted unless current is also geo
        if (!g.nigerian && !isGeoTargeted(s.name) && isGeoTargeted(alt.name)) return false;
        // If current IS geo-targeted, alt should target same geo
        if (isGeoTargeted(s.name) && !g.nigerian) {
          const geoMatch = s.name.match(/usa|🇺🇸|uk\b|🇬🇧|europe|asia|turkey|🇹🇷|ghana|🇬🇭/i);
          if (geoMatch && !new RegExp(geoMatch[0], 'i').test(alt.name)) return false;
        }

        return true;
      });

      // Score: refill > no refill, lifetime > 30d > none, HQ > standard > LQ, lower cost is better for same quality
      const currentRefill = hasRefill(s.name);
      const currentQuality = qualityTier(s.name);

      let dominated = false;
      let bestUpgrade = null;
      let bestScore = 0;

      for (const alt of candidates) {
        const altRefill = hasRefill(alt.name);
        const altQuality = qualityTier(alt.name);

        // Score the alternative vs current
        let score = 0;
        let dominated_axes = 0;

        // Quality upgrade
        if (altQuality > currentQuality) { score += 3; dominated_axes++; }
        else if (altQuality < currentQuality) { score -= 5; } // don't downgrade quality

        // Refill upgrade
        const refillRank = { none: 0, yes: 1, '30d': 2, lifetime: 3 };
        if (refillRank[altRefill] > refillRank[currentRefill]) { score += 2; dominated_axes++; }
        else if (refillRank[altRefill] < refillRank[currentRefill]) { score -= 3; }

        // Cost: significantly cheaper at same/better quality
        if (alt.costPer1k > 0 && s.costPer1k > 0) {
          const ratio = alt.costPer1k / s.costPer1k;
          if (ratio <= 0.6) { score += 2; dominated_axes++; } // 40%+ cheaper
          else if (ratio <= 0.8) { score += 1; dominated_axes++; } // 20-40% cheaper
          else if (ratio >= 2.0) { score -= 2; } // way more expensive
        }

        // Must be strictly better on at least one axis without being worse on any major one
        if (score > bestScore && score >= 2) {
          bestScore = score;
          bestUpgrade = alt;
        }
      }

      if (bestUpgrade) {
        const altRefill = hasRefill(bestUpgrade.name);
        const altQuality = qualityTier(bestUpgrade.name);
        const reasons = [];
        if (altQuality > currentQuality) reasons.push('higher quality');
        if (['lifetime', '30d', 'yes'].includes(altRefill) && currentRefill === 'none') reasons.push('adds refill');
        if (altRefill === 'lifetime' && currentRefill !== 'lifetime') reasons.push('lifetime refill');
        if (bestUpgrade.costPer1k < s.costPer1k * 0.8) reasons.push(`${Math.round((1 - bestUpgrade.costPer1k / s.costPer1k) * 100)}% cheaper`);

        output += `- **${t.tier}**: ⚠️ Upgrade available — current: ${s.provider}/${s.apiId} (₦${s.costPer1k}/1k, ${currentRefill} refill)\n`;
        output += `  → **${bestUpgrade.provider}/${bestUpgrade.apiId}** "${bestUpgrade.name.slice(0, 90)}" (₦${bestUpgrade.costPer1k}/1k) — ${reasons.join(', ')}\n`;
        stats.upgradeable++;
        upgrades.push({
          group: g.name,
          tier: t.tier,
          nigerian: g.nigerian,
          currentProvider: s.provider,
          currentApiId: s.apiId,
          currentName: s.name,
          currentCost: s.costPer1k,
          currentRefill,
          newProvider: bestUpgrade.provider,
          newApiId: bestUpgrade.apiId,
          newName: bestUpgrade.name,
          newCost: bestUpgrade.costPer1k,
          newRefill: hasRefill(bestUpgrade.name),
          reasons: reasons.join(', '),
        });
      } else {
        output += `- **${t.tier}**: ✅ ${s.provider}/${s.apiId} (₦${s.costPer1k}/1k, ${currentRefill} refill)\n`;
        stats.good++;
      }
    }
    output += '\n';
  }

  // Summary
  output += '---\n\n## Summary\n\n';
  output += `| Status | Count |\n|--------|-------|\n`;
  output += `| ✅ Good as-is | ${stats.good} |\n`;
  output += `| ⚠️ Stronger alternative | ${stats.upgradeable} |\n`;
  output += `| ❌ Wrong service | ${stats.wrong} |\n`;
  output += `| 🔲 No service linked | ${stats.unlinked} |\n`;
  output += `| **Total** | **${stats.good + stats.upgradeable + stats.wrong + stats.unlinked}** |\n\n`;

  // Upgrade table
  if (upgrades.length > 0) {
    output += '## Recommended Upgrades\n\n';
    output += '| Group | Tier | Current (provider/id) | Current Cost | → New (provider/id) | New Cost | Why |\n';
    output += '|-------|------|-----------------------|-------------|---------------------|----------|-----|\n';
    for (const u of upgrades) {
      output += `| ${u.group}${u.nigerian ? ' 🇳🇬' : ''} | ${u.tier} | ${u.currentProvider}/${u.currentApiId} | ₦${u.currentCost} | **${u.newProvider}/${u.newApiId}** | ₦${u.newCost} | ${u.reasons} |\n`;
    }
  }

  fs.writeFileSync('docs/full-tier-audit.md', output);
  console.log(`\nWritten to docs/full-tier-audit.md`);
  console.log(`✅ ${stats.good} good | ⚠️ ${stats.upgradeable} upgradeable | ❌ ${stats.wrong} wrong | 🔲 ${stats.unlinked} unlinked`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
