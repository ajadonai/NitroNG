#!/usr/bin/env node
// Comprehensive tier fix script: swap wrong services + fix false refill promises
// Usage: node scripts/fix-tiers.mjs          (dry run — shows what would change)
//        node scripts/fix-tiers.mjs --apply  (actually updates the database)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

// ═══════════════════════════════════════════════════════════════
// CATEGORY 1: Wrong service mappings (linked to wrong platform)
// ═══════════════════════════════════════════════════════════════
const wrongServiceSwaps = [
  {
    group: 'Audiomack Streams — Nigeria 🇳🇬',
    currentProvider: 'dao', currentApiId: 320,
    newProvider: 'dao', newApiId: 2009,
    reason: 'Was: Instagram Likes [Turkish] → Now: Audiomack Streams [Nigerian]',
  },
  {
    group: 'Boomplay Streams — Nigeria 🇳🇬',
    currentProvider: 'dao', currentApiId: 1714,
    newProvider: 'jap', newApiId: 9088,
    reason: 'Was: Spotify Indian Playlist Plays → Now: Boomplay Streams [NIGERIA]',
  },
  {
    group: 'Facebook Custom Comments',
    currentProvider: 'jap', currentApiId: 583,
    newProvider: 'dao', newApiId: 1074,
    reason: 'Was: Facebook Post Likes [ANGRY emoji] → Now: Facebook Custom Comments [All Link]',
  },
  {
    group: 'Facebook Random Comments',
    currentProvider: 'jap', currentApiId: 584,
    newProvider: 'dao', newApiId: 2718,
    reason: 'Was: Instagram Shares → Now: Facebook Random Comments [Hidden]',
  },
  {
    group: 'Instagram Custom Comments (Standard)',
    currentProvider: 'jap', currentApiId: 2953,
    newProvider: 'dao', newApiId: 5800,
    reason: 'Was: Facebook Post Likes [SAD emoji] → Now: Instagram Custom Comments [HQ Profile]',
  },
  {
    group: 'Instagram Custom Comments (Premium)',
    currentProvider: 'mtp', currentApiId: 2517,
    newProvider: 'dao', newApiId: 2106,
    reason: 'Was: Instagram Real Likes → Now: Instagram Custom Comments [HQ Profiles]',
  },
  {
    group: 'Instagram Random Comments (Budget)',
    currentProvider: 'mtp', currentApiId: 2951,
    newProvider: 'dao', newApiId: 4267,
    reason: 'Was: Telegram Post Views → Now: Instagram Random Comments [HQ Profile]',
  },
  {
    group: 'Instagram Random Comments (Standard)',
    currentProvider: 'mtp', currentApiId: 5709,
    newProvider: 'dao', newApiId: 397,
    reason: 'Was: TikTok Likes Turkey → Now: Instagram Random Comments [HQ Worldwide]',
  },
  {
    group: 'Instagram Emoji Comments (Budget)',
    currentProvider: 'mtp', currentApiId: 5710,
    newProvider: 'dao', newApiId: 2663,
    reason: 'Was: YouTube Likes Turkey → Now: Instagram Random Emoji Comments [Worldwide]',
  },
  {
    group: 'Spotify Followers — Nigeria 🇳🇬',
    currentProvider: 'dao', currentApiId: 4453,
    newProvider: 'mtp', newApiId: 1981,
    reason: 'Was: TikTok Followers → Now: Spotify Followers [30 Day Refill]',
  },
  {
    group: 'TikTok Followers (global Standard)',
    currentProvider: 'mtp', currentApiId: 2594,
    newProvider: 'dao', newApiId: 4454,
    reason: 'Was: X/Twitter Followers → Now: TikTok Followers [Refill: 30D]',
  },
  {
    group: 'TikTok Custom Comments (Standard)',
    currentProvider: 'dao', currentApiId: 5160,
    newProvider: 'dao', newApiId: 5025,
    reason: 'Was: Telegram Channel Members China → Now: TikTok Custom Comments [HQ Worldwide]',
  },
  {
    group: 'TikTok Custom Comments (Premium)',
    currentProvider: 'dao', currentApiId: 5161,
    newProvider: 'dao', newApiId: 2104,
    reason: 'Was: Telegram Channel Members China → Now: TikTok Custom Comments [HQ Worldwide Profiles]',
  },
  {
    group: 'TikTok Random Comments (Budget)',
    currentProvider: 'dao', currentApiId: 5162,
    newProvider: 'dao', newApiId: 3088,
    reason: 'Was: Telegram Channel Members China → Now: TikTok Random Comments',
  },
  {
    group: 'YouTube Custom Comments',
    currentProvider: 'jap', currentApiId: 911,
    newProvider: 'dao', newApiId: 6028,
    reason: 'Was: Facebook Story Views → Now: YouTube Custom Comments [HQ Worldwide] [Refill: 30 Days]',
  },
  {
    group: 'YouTube Random Comments (Budget)',
    currentProvider: 'dao', currentApiId: 913,
    newProvider: 'dao', newApiId: 2015,
    reason: 'Was: YouTube Mexican Social Shares → Now: YouTube English Random Comments [Refill: 30D]',
  },
  {
    group: 'YouTube Watch Time (60K min)',
    currentProvider: 'mtp', currentApiId: 7292,
    newProvider: 'mtp', newApiId: 8868,
    reason: 'Was: Facebook WatchTime → Now: YouTube WatchTime Views [30 Day Refill] [15-20 Min+]',
  },
];

// ═══════════════════════════════════════════════════════════════
// CATEGORY 2a: Swap to real-refill alternative
// Tiers that promise refill but current service only says "Guaranteed"
// ═══════════════════════════════════════════════════════════════
const refillSwaps = [
  {
    group: 'Discord Members (Offline)',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 7344,
    reason: 'Lifetime Guaranteed → 30 Day Refill (same service line, ₦205 vs ₦425)',
  },
  {
    group: 'Facebook Video Views',
    tier: 'Standard',
    newProvider: 'mtp', newApiId: 680,
    reason: 'Lifetime Guaranteed → 30 Day Refill video views (₦10 vs ₦12)',
  },
  {
    group: 'Facebook Post Likes',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 5133,
    reason: 'Lifetime Guaranteed → 30 Day Refill post likes (₦76 vs ₦87)',
  },
  {
    group: 'Instagram Followers',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 5839,
    reason: 'Lifetime Guaranteed → 30 Day Refill (same speed/max, ₦38 vs ₦44)',
  },
  {
    group: 'Instagram Likes',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 2518,
    reason: 'Lifetime Guaranteed → 30 Day Refill Premium Likes (₦37 vs ₦9)',
  },
  {
    group: 'Instagram Reel/Video Views',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 2127,
    reason: 'Lifetime Guaranteed → 30 Day Refill video views (₦2 vs ₦4)',
  },
  {
    group: 'OnlyFans Followers',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 8403,
    reason: 'Lifetime Guaranteed → 30 Day Refill (same service line, ₦2860 vs ₦3250)',
  },
  {
    group: 'Snapchat Followers',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 8385,
    reason: 'Lifetime Guaranteed → 30 Day Refill (same service line, ₦1638 vs ₦2065)',
  },
  {
    group: 'Snapchat Likes',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 8388,
    reason: 'Lifetime Guaranteed → 30 Day Refill (same service line, ₦929 vs ₦1161)',
  },
  {
    group: 'TikTok Video Views',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 9349,
    reason: 'Lifetime Guaranteed → 30 Day Auto Refill (₦3 vs ₦12)',
  },
  {
    group: 'TikTok Likes',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 1126,
    reason: 'Lifetime Guaranteed → 30 Day Refill likes (same speed/max, ₦10 vs ₦11)',
  },
  {
    group: 'TikTok Likes — USA 🇺🇸',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 1111,
    reason: 'USA Lifetime Guarantee → USA 30 Day Refill (₦16 vs ₦14)',
  },
  {
    group: 'TikTok Saves',
    tier: 'Standard',
    newProvider: 'mtp', newApiId: 1116,
    reason: 'Lifetime Guaranteed → 30 Day Refill saves (₦12 vs ₦5)',
  },
  {
    group: 'YouTube Views',
    tier: 'Standard',
    newProvider: 'jap', newApiId: 7512,
    reason: 'Lifetime Guaranteed → Native Views [Refill: ∞] (₦80 vs ₦41)',
  },
  {
    group: 'YouTube Likes',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 918,
    reason: 'Lifetime Guaranteed → 30 Day Refill likes (₦35 vs ₦48)',
  },
  {
    group: 'YouTube Shorts Likes',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 6234,
    reason: 'Lifetime Guaranteed → 30 Day Refill shorts likes (₦45 vs ₦48)',
  },
  {
    group: 'YouTube Live Stream Likes',
    tier: 'Premium',
    newProvider: 'mtp', newApiId: 6236,
    reason: 'Lifetime Guaranteed → 30 Day Refill live stream likes (₦45 vs ₦48)',
  },
];

// ═══════════════════════════════════════════════════════════════
// CATEGORY 2b: Turn off refill badge (no good refill alternative)
// Keep the current service but set tier.refill = false
// ═══════════════════════════════════════════════════════════════
const refillTurnOff = [
  { group: 'Apple Music Plays — Global', tier: 'Standard', reason: 'No Apple Music refill services exist in any provider' },
  { group: 'Apple Music Plays — USA', tier: 'Premium', reason: 'No Apple Music refill services exist in any provider' },
  { group: 'Spotify Plays — Global', tier: 'Standard', reason: 'No global Spotify refill service — only country-specific ones' },
  { group: 'Spotify Plays — Europe', tier: 'Standard', reason: 'No pan-Europe Spotify refill service — only country-specific ones' },
  { group: 'Spotify Plays — Asia', tier: 'Standard', reason: 'No pan-Asia Spotify refill service — only country-specific ones' },
  { group: 'Spotify Plays — USA', tier: 'Premium', reason: 'Only playlist-plays refill available for USA — not matching tier intent' },
  { group: 'Spotify Followers — USA', tier: 'Premium', reason: 'Only generic Spotify follower refill — no USA-specific refill' },
  { group: 'Spotify Followers — UK', tier: 'Premium', reason: 'Only generic Spotify follower refill — no UK-specific refill' },
  { group: 'YouTube Comment Likes', tier: 'Standard', reason: 'No YouTube comment likes service with refill exists' },
];

async function findTier(groupNamePattern, tierName) {
  const groups = await prisma.serviceGroup.findMany({
    where: { name: { contains: groupNamePattern, mode: 'insensitive' } },
    include: {
      tiers: {
        include: { service: true },
        where: tierName ? { tier: tierName } : undefined,
      },
    },
  });

  if (groups.length === 0) return null;
  if (groups.length > 1) {
    // Try exact match first
    const exact = groups.find(g => g.name === groupNamePattern);
    if (exact && exact.tiers.length > 0) return exact.tiers[0];
  }
  if (groups[0].tiers.length === 0) return null;
  return groups[0].tiers[0];
}

async function findServiceByProviderApiId(provider, apiId) {
  return prisma.service.findUnique({
    where: { apiId_provider: { apiId, provider } },
  });
}

async function main() {
  console.log(apply ? '🔧 APPLYING CHANGES...\n' : '👀 DRY RUN — pass --apply to execute\n');

  let swapped = 0, refillFixed = 0, refillOff = 0, errors = 0;

  // ─── CATEGORY 1: Wrong service swaps ───
  console.log('═══ CATEGORY 1: Wrong Service Mappings ═══\n');

  for (const swap of wrongServiceSwaps) {
    const tier = await findTierByCurrentService(swap.currentProvider, swap.currentApiId);
    if (!tier) {
      console.log(`  ⚠️  SKIP: ${swap.group} — tier with ${swap.currentProvider}/${swap.currentApiId} not found`);
      errors++;
      continue;
    }

    const newService = await findServiceByProviderApiId(swap.newProvider, swap.newApiId);
    if (!newService) {
      console.log(`  ⚠️  SKIP: ${swap.group} — replacement ${swap.newProvider}/${swap.newApiId} not found in DB`);
      errors++;
      continue;
    }

    console.log(`  ✅ ${swap.group}`);
    console.log(`     ${swap.reason}`);
    console.log(`     Tier ID: ${tier.id} → Service: ${newService.provider}/${newService.apiId} (₦${newService.costPer1k}/1k)`);

    if (apply) {
      await prisma.serviceTier.update({
        where: { id: tier.id },
        data: { serviceId: newService.id },
      });
    }
    swapped++;
  }

  // ─── CATEGORY 2a: Refill swaps ───
  console.log('\n═══ CATEGORY 2a: Swap to Real Refill Service ═══\n');

  for (const swap of refillSwaps) {
    const tier = await findTier(swap.group, swap.tier);
    if (!tier) {
      console.log(`  ⚠️  SKIP: ${swap.group} (${swap.tier}) — not found`);
      errors++;
      continue;
    }

    const newService = await findServiceByProviderApiId(swap.newProvider, swap.newApiId);
    if (!newService) {
      console.log(`  ⚠️  SKIP: ${swap.group} — replacement ${swap.newProvider}/${swap.newApiId} not found`);
      errors++;
      continue;
    }

    const currentService = tier.service;
    console.log(`  ✅ ${swap.group} — ${swap.tier}`);
    console.log(`     ${swap.reason}`);
    console.log(`     Was: ${currentService?.provider}/${currentService?.apiId} → Now: ${newService.provider}/${newService.apiId}`);

    if (apply) {
      await prisma.serviceTier.update({
        where: { id: tier.id },
        data: { serviceId: newService.id },
      });
    }
    refillFixed++;
  }

  // ─── CATEGORY 2b: Turn off refill ───
  console.log('\n═══ CATEGORY 2b: Turn Off False Refill Badge ═══\n');

  for (const item of refillTurnOff) {
    const tier = await findTier(item.group, item.tier);
    if (!tier) {
      console.log(`  ⚠️  SKIP: ${item.group} (${item.tier}) — not found`);
      errors++;
      continue;
    }

    if (!tier.refill) {
      console.log(`  ℹ️  SKIP: ${item.group} (${item.tier}) — refill already off`);
      continue;
    }

    console.log(`  ✅ ${item.group} — ${item.tier}`);
    console.log(`     Refill: true → false (${item.reason})`);

    if (apply) {
      await prisma.serviceTier.update({
        where: { id: tier.id },
        data: { refill: false },
      });
    }
    refillOff++;
  }

  // ─── Summary ───
  console.log('\n═══ SUMMARY ═══\n');
  console.log(`  Wrong services swapped:    ${swapped}/${wrongServiceSwaps.length}`);
  console.log(`  Refill services upgraded:  ${refillFixed}/${refillSwaps.length}`);
  console.log(`  Refill badges turned off:  ${refillOff}/${refillTurnOff.length}`);
  if (errors > 0) console.log(`  Errors/skips:              ${errors}`);
  console.log(`\n  Total changes: ${swapped + refillFixed + refillOff}`);
  console.log(apply ? '\n✅ All changes applied.' : '\n👀 Dry run complete. Run with --apply to execute.');
}

async function findTierByCurrentService(provider, apiId) {
  const service = await findServiceByProviderApiId(provider, apiId);
  if (!service) return null;
  const tier = await prisma.serviceTier.findFirst({
    where: { serviceId: service.id },
    include: { service: true, group: true },
  });
  return tier;
}

main().catch(console.error).finally(() => prisma.$disconnect());
