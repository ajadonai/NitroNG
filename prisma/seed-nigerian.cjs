// Nitro Nigerian Services Seed
// Adds Nigerian-specific service groups across major platforms
// Uses existing MTP services but branded for Nigerian audience
// Run: node prisma/seed-nigerian.cjs

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const NG = [
  // INSTAGRAM
  { n: "Instagram Followers — Nigeria 🇳🇬", p: "Instagram", y: "followers", t: [
    { t: "Budget", a: 5752, sp: "1-5K/day", r: 0 },
    { t: "Standard", a: 5839, sp: "5-10K/day", r: 1 },
  ]},
  { n: "Instagram Likes — Nigeria 🇳🇬", p: "Instagram", y: "likes", t: [
    { t: "Budget", a: 2847, sp: "5-10K/day", r: 0 },
    { t: "Standard", a: 2499, sp: "5-15K/day", r: 1 },
  ]},
  { n: "Instagram Reel Views — Nigeria 🇳🇬", p: "Instagram", y: "views", t: [
    { t: "Budget", a: 7661, sp: "10-20M/day", r: 0 },
    { t: "Standard", a: 2127, sp: "100-500K/day", r: 1 },
  ]},
  { n: "Instagram Story Views — Nigeria 🇳🇬", p: "Instagram", y: "views", t: [
    { t: "Standard", a: 3516, sp: "50-100K/day", r: 0 },
  ]},

  // TIKTOK
  { n: "TikTok Followers — Nigeria 🇳🇬", p: "TikTok", y: "followers", t: [
    { t: "Standard", a: 2594, sp: "500-2K/day", r: 0 },
  ]},
  { n: "TikTok Video Views — Nigeria 🇳🇬", p: "TikTok", y: "views", t: [
    { t: "Budget", a: 2026, sp: "5-50K/day", r: 0 },
    { t: "Standard", a: 9349, sp: "500-1M/day", r: 1 },
  ]},
  { n: "TikTok Likes — Nigeria 🇳🇬", p: "TikTok", y: "likes", t: [
    { t: "Budget", a: 1128, sp: "5-50K/day", r: 0 },
    { t: "Standard", a: 1126, sp: "5-50K/day", r: 1 },
  ]},

  // TWITTER/X
  { n: "X/Twitter Followers — Nigeria 🇳🇬", p: "Twitter/X", y: "followers", t: [
    { t: "Budget", a: 5125, sp: "1-5K/day", r: 0 },
    { t: "Standard", a: 2594, sp: "500-2K/day", r: 0 },
  ]},
  { n: "X/Twitter Likes — Nigeria 🇳🇬", p: "Twitter/X", y: "likes", t: [
    { t: "Budget", a: 3663, sp: "500-1K/day", r: 0 },
    { t: "Standard", a: 3661, sp: "500-1K/day", r: 1 },
  ]},
  { n: "X/Twitter Retweets — Nigeria 🇳🇬", p: "Twitter/X", y: "engagement", t: [
    { t: "Budget", a: 1604, sp: "500-1K/day", r: 0 },
    { t: "Standard", a: 3308, sp: "500-1K/day", r: 1 },
  ]},
  { n: "X/Twitter Tweet Views — Nigeria 🇳🇬", p: "Twitter/X", y: "views", t: [
    { t: "Budget", a: 981, sp: "100-500K/day", r: 0 },
  ]},

  // YOUTUBE
  { n: "YouTube Views — Nigeria 🇳🇬", p: "YouTube", y: "views", t: [
    { t: "Standard", a: 1573, sp: "100-500/day", r: 1 },
  ]},
  { n: "YouTube Likes — Nigeria 🇳🇬", p: "YouTube", y: "likes", t: [
    { t: "Budget", a: 935, sp: "10-100K/day", r: 0 },
    { t: "Standard", a: 918, sp: "5-10K/day", r: 1 },
  ]},
  { n: "YouTube Subscribers — Nigeria 🇳🇬", p: "YouTube", y: "followers", t: [
    { t: "Budget", a: 2386, sp: "10-50K/day", r: 0 },
  ]},

  // FACEBOOK
  { n: "Facebook Page Followers — Nigeria 🇳🇬", p: "Facebook", y: "followers", t: [
    { t: "Budget", a: 4138, sp: "1-5K/day", r: 0 },
    { t: "Standard", a: 9028, sp: "5-15K/day", r: 1 },
  ]},
  { n: "Facebook Post Likes — Nigeria 🇳🇬", p: "Facebook", y: "likes", t: [
    { t: "Budget", a: 578, sp: "500-1K/day", r: 0 },
    { t: "Standard", a: 5133, sp: "500-2K/day", r: 1 },
  ]},
  { n: "Facebook Video Views — Nigeria 🇳🇬", p: "Facebook", y: "views", t: [
    { t: "Budget", a: 680, sp: "20-30K/day", r: 1 },
    { t: "Standard", a: 7654, sp: "5-15K/day", r: 1 },
  ]},

  // TELEGRAM
  { n: "Telegram Members — Nigeria 🇳🇬", p: "Telegram", y: "followers", t: [
    { t: "Standard", a: 8248, sp: "5-10K/day", r: 0 },
  ]},

  // SPOTIFY (already exists but adding more)
  { n: "Spotify Streams — Nigeria 🇳🇬", p: "Spotify", y: "plays", t: [
    { t: "Standard", a: 6543, sp: "500-2K/day", r: 0 },
  ]},

  // THREADS
  { n: "Threads Followers — Nigeria 🇳🇬", p: "Threads", y: "followers", t: [
    { t: "Standard", a: 8575, sp: "1-5K/day", r: 0 },
  ]},
  { n: "Threads Likes — Nigeria 🇳🇬", p: "Threads", y: "likes", t: [
    { t: "Standard", a: 8578, sp: "5-10K/day", r: 0 },
  ]},
];

async function seed() {
  console.log('🇳🇬 Seeding Nigerian services...\n');

  // Get existing MTP service IDs
  const allApiIds = [...new Set(NG.flatMap(g => g.t.map(x => x.a)))];
  const svcs = await p.service.findMany({ where: { apiId: { in: allApiIds } }, select: { id: true, apiId: true } });
  const m = {};
  svcs.forEach(s => { m[s.apiId] = s.id; });
  const miss = allApiIds.filter(id => !m[id]);
  if (miss.length) console.log('⚠️  Missing apiIds:', miss.join(', '), '\n');

  // Get current max sort order
  const maxSort = await p.serviceGroup.aggregate({ _max: { sortOrder: true } });
  let sortBase = (maxSort._max.sortOrder || 0) + 1;

  // Delete existing Nigerian groups (to avoid duplicates on re-run)
  const deleted = await p.serviceGroup.deleteMany({ where: { nigerian: true } });
  if (deleted.count > 0) console.log(`🗑️  Removed ${deleted.count} existing Nigerian groups\n`);

  let gc = 0, tc = 0, sk = 0;

  for (let i = 0; i < NG.length; i++) {
    const g = NG[i];
    const grp = await p.serviceGroup.create({
      data: { name: g.n, platform: g.p, type: g.y || 'Standard', nigerian: true, enabled: true, sortOrder: sortBase + i },
    });
    gc++;

    for (let j = 0; j < g.t.length; j++) {
      const x = g.t[j];
      const sid = m[x.a];
      if (!sid) { console.log('   ⏭️  Skip:', g.n, '→', x.t, '(apiId', x.a, 'missing)'); sk++; continue; }
      await p.serviceTier.create({
        data: { groupId: grp.id, serviceId: sid, tier: x.t, sellPer1k: 0, refill: !!x.r, speed: x.sp, enabled: true, sortOrder: j + 1 },
      });
      tc++;
    }
    console.log('   ✅', g.p, '→', g.n, '(' + g.t.length + ' tiers)');
  }

  console.log('\n🇳🇬 Done!', gc, 'Nigerian groups,', tc, 'tiers,', sk, 'skipped');
  console.log('💡 Run "Recalculate All Prices" in Admin Settings to set sell prices from markup\n');
}

seed().catch(e => { console.error('❌', e.message); }).finally(() => p.$disconnect());
