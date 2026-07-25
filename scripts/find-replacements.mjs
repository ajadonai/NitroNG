#!/usr/bin/env node
// Find replacement services for mismatched tiers using the already-synced services in the DB
// Usage: node scripts/find-replacements.mjs

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mismatches = [
  {
    group: 'Audiomack Streams — Nigeria 🇳🇬',
    currentProvider: 'dao', currentApiId: 320,
    wrongName: 'Instagram Likes [Turkish]',
    searchName: ['audiomack', 'nigeria'],
    searchCategory: ['audiomack'],
  },
  {
    group: 'Boomplay Streams — Nigeria 🇳🇬',
    currentProvider: 'dao', currentApiId: 1714,
    wrongName: 'Spotify Indian Playlist Plays',
    searchName: ['boomplay', 'nigeria'],
    searchCategory: ['boomplay'],
  },
  {
    group: 'Facebook Custom Comments',
    currentProvider: 'jap', currentApiId: 583,
    wrongName: 'Facebook Post Likes [ANGRY emoji]',
    searchName: ['facebook', 'custom comment'],
    searchCategory: ['facebook'],
  },
  {
    group: 'Facebook Random Comments',
    currentProvider: 'jap', currentApiId: 584,
    wrongName: 'Instagram Shares',
    searchName: ['facebook', 'comment'],
    searchCategory: ['facebook'],
  },
  {
    group: 'Instagram Custom Comments (Standard)',
    currentProvider: 'jap', currentApiId: 2953,
    wrongName: 'Facebook Post Likes [SAD emoji]',
    searchName: ['instagram', 'custom comment'],
    searchCategory: ['instagram'],
  },
  {
    group: 'Instagram Custom Comments (Premium)',
    currentProvider: 'mtp', currentApiId: 2517,
    wrongName: 'Instagram Real Likes (not comments)',
    searchName: ['instagram', 'custom comment'],
    searchCategory: ['instagram'],
  },
  {
    group: 'Instagram Random Comments (Budget)',
    currentProvider: 'mtp', currentApiId: 2951,
    wrongName: 'Telegram Post Views',
    searchName: ['instagram', 'random comment'],
    searchCategory: ['instagram'],
  },
  {
    group: 'Instagram Random Comments (Standard)',
    currentProvider: 'mtp', currentApiId: 5709,
    wrongName: 'TikTok Likes Turkey',
    searchName: ['instagram', 'comment'],
    searchCategory: ['instagram'],
  },
  {
    group: 'Instagram Emoji Comments (Budget)',
    currentProvider: 'mtp', currentApiId: 5710,
    wrongName: 'YouTube Likes Turkey',
    searchName: ['instagram', 'emoji comment'],
    searchCategory: ['instagram'],
  },
  {
    group: 'Spotify Followers — Nigeria 🇳🇬',
    currentProvider: 'dao', currentApiId: 4453,
    wrongName: 'TikTok Followers',
    searchName: ['spotify', 'follower'],
    searchCategory: ['spotify'],
  },
  {
    group: 'TikTok Followers (global Standard)',
    currentProvider: 'mtp', currentApiId: 2594,
    wrongName: 'X/Twitter Followers',
    searchName: ['tiktok', 'follower'],
    searchCategory: ['tiktok'],
    excludeGeo: true,
  },
  {
    group: 'TikTok Custom Comments (Standard)',
    currentProvider: 'dao', currentApiId: 5160,
    wrongName: 'Telegram Channel Members China',
    searchName: ['tiktok', 'custom comment'],
    searchCategory: ['tiktok'],
  },
  {
    group: 'TikTok Custom Comments (Premium)',
    currentProvider: 'dao', currentApiId: 5161,
    wrongName: 'Telegram Channel Members China',
    searchName: ['tiktok', 'comment'],
    searchCategory: ['tiktok'],
  },
  {
    group: 'TikTok Random Comments (Budget)',
    currentProvider: 'dao', currentApiId: 5162,
    wrongName: 'Telegram Channel Members China',
    searchName: ['tiktok', 'random comment'],
    searchCategory: ['tiktok'],
  },
  {
    group: 'YouTube Custom Comments',
    currentProvider: 'jap', currentApiId: 911,
    wrongName: 'Facebook Story Views',
    searchName: ['youtube', 'custom comment'],
    searchCategory: ['youtube'],
  },
  {
    group: 'YouTube Random Comments (Budget)',
    currentProvider: 'dao', currentApiId: 913,
    wrongName: 'YouTube Mexican Social Shares',
    searchName: ['youtube', 'random comment'],
    searchCategory: ['youtube'],
  },
  {
    group: 'YouTube Watch Time (60K min)',
    currentProvider: 'mtp', currentApiId: 7292,
    wrongName: 'Facebook WatchTime',
    searchName: ['youtube', 'watch'],
    searchCategory: ['youtube'],
  },
];

async function main() {
  let output = '# Replacement Services for Mismatched Tiers\n\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += 'For each mismatched tier, showing available replacement services from the synced provider catalogues.\n\n';

  // Get total counts per provider
  const providerCounts = await prisma.service.groupBy({
    by: ['provider'],
    _count: true,
  });
  output += '## Provider Service Counts\n\n';
  for (const p of providerCounts) {
    output += `- **${p.provider.toUpperCase()}**: ${p._count} services\n`;
  }
  output += '\n---\n\n';

  for (const mm of mismatches) {
    output += `## ${mm.group}\n\n`;
    output += `**Currently mapped**: ${mm.currentProvider}/${mm.currentApiId} = "${mm.wrongName}" ❌\n\n`;

    // Search for candidate replacements across all providers
    const nameTerms = mm.searchName;

    // Build OR conditions for name search
    const nameConditions = nameTerms.map(term => ({
      name: { contains: term, mode: 'insensitive' },
    }));

    // Search: name must contain ALL search terms
    const candidates = await prisma.service.findMany({
      where: {
        AND: nameTerms.map(term => ({
          name: { contains: term, mode: 'insensitive' },
        })),
      },
      orderBy: { costPer1k: 'asc' },
      take: 15,
    });

    // Also search with just category + type keywords (broader)
    const broadCandidates = await prisma.service.findMany({
      where: {
        AND: [
          { category: { contains: mm.searchCategory[0], mode: 'insensitive' } },
          { name: { contains: nameTerms[nameTerms.length - 1], mode: 'insensitive' } },
        ],
      },
      orderBy: { costPer1k: 'asc' },
      take: 15,
    });

    // Merge and deduplicate
    const seen = new Set();
    const all = [];
    for (const s of [...candidates, ...broadCandidates]) {
      const key = `${s.provider}-${s.apiId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Filter out geo-specific if needed
      if (mm.excludeGeo && /nigeria|usa|turkey|india|brazil|uk|china/i.test(s.name)) continue;

      all.push(s);
    }

    // Sort by cost
    all.sort((a, b) => a.costPer1k - b.costPer1k);

    if (all.length === 0) {
      output += '_No matching services found in synced catalogues._\n\n';
      output += '**Action needed**: Sync provider catalogues from admin, then re-run.\n\n';
    } else {
      output += `Found ${all.length} candidates:\n\n`;
      output += '| Provider | API ID | Service Name | Cost/1k | Min | Max | Refill | Enabled |\n';
      output += '|----------|--------|-------------|---------|-----|-----|--------|--------|\n';
      for (const s of all.slice(0, 12)) {
        output += `| ${s.provider} | ${s.apiId} | ${s.name} | ₦${s.costPer1k} | ${s.min} | ${s.max} | ${s.refill ? 'Yes' : 'No'} | ${s.enabled ? 'Yes' : 'No'} |\n`;
      }
      output += '\n';

      // Recommend the best option
      const best = all[0];
      const bestRefill = all.find(s => s.refill);
      if (best) {
        output += `**Cheapest**: ${best.provider}/${best.apiId} — "${best.name}" (₦${best.costPer1k}/1k)\n`;
      }
      if (bestRefill && bestRefill !== best) {
        output += `**Best w/ refill**: ${bestRefill.provider}/${bestRefill.apiId} — "${bestRefill.name}" (₦${bestRefill.costPer1k}/1k)\n`;
      }
    }
    output += '\n---\n\n';
  }

  const fs = await import('fs');
  fs.writeFileSync('docs/tier-replacements.md', output);
  console.log('Written to docs/tier-replacements.md');
}

main().catch(console.error).finally(() => prisma.$disconnect());
