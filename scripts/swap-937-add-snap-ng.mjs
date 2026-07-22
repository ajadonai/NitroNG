import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  // ── 1. Swap DAO 937 → DAO 6553 on the Premium tier of "Facebook Post Likes" ──

  const svc937 = await db.service.findFirst({ where: { apiId: 937, provider: 'dao' } });
  const svc6553 = await db.service.findFirst({ where: { apiId: 6553, provider: 'dao' } });
  if (!svc937 || !svc6553) throw new Error(`Missing service: 937=${!!svc937}, 6553=${!!svc6553}`);

  const tier937 = await db.serviceTier.findFirst({
    where: { serviceId: svc937.id },
    include: { group: { select: { name: true } } },
  });
  if (!tier937) throw new Error('No tier found for service 937');

  console.log(`Swapping tier "${tier937.tier}" of "${tier937.group.name}"`);
  console.log(`  Old: DAO #937 (${svc937.name})`);
  console.log(`  New: DAO #6553 (${svc6553.name})`);

  await db.serviceTier.update({
    where: { id: tier937.id },
    data: {
      serviceId: svc6553.id,
      speed: '100K/day',
    },
  });
  console.log('  ✓ Tier updated\n');

  // Disable the old 937 service (keep it for historical order references)
  await db.service.update({ where: { id: svc937.id }, data: { enabled: false } });
  console.log('  ✓ Service 937 disabled\n');

  // ── 2. Add Nigerian Snapchat Followers service group ──

  const svc7518 = await db.service.findFirst({ where: { apiId: 7518, provider: 'dao' } });
  if (!svc7518) throw new Error('Service 7518 not found');

  // Check if group already exists
  const existing = await db.serviceGroup.findFirst({
    where: { platform: 'Snapchat', nigerian: true, type: 'followers' },
  });
  if (existing) {
    console.log(`Nigerian Snapchat Followers group already exists: ${existing.id}`);
  } else {
    // Get max sortOrder for Snapchat to place this after existing groups
    const lastSnap = await db.serviceGroup.findFirst({
      where: { platform: 'Snapchat' },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (lastSnap?.sortOrder || 0) + 1;

    // Look at other Nigerian follower services for sell price reference
    const refTier = await db.serviceTier.findFirst({
      where: { group: { nigerian: true, platform: 'Facebook', type: 'followers' }, tier: 'Standard' },
      select: { sellPer1k: true },
    });
    // Fallback sell price: cost × 1.54 markup (54% default)
    // DAO 7518 cost: $11.29/1K = 1129 (stored as cents×100?)
    // Actually costPer1k in DB is 1129 for 7518
    // USD rate ~1571, so cost in kobo = 1129 × 1571 / 100 = 17,737 kobo/1K = ₦177.37/1K
    // With 54% markup: ₦177.37 × 1.54 = ₦273.15/1K → 27315 kobo/1K
    // Reference: similar Nigerian services sell around 20K-40K kobo/1K
    const sellPer1k = refTier?.sellPer1k || 27000n;

    const group = await db.serviceGroup.create({
      data: {
        name: 'Snapchat Followers — Nigerian 🇳🇬',
        platform: 'Snapchat',
        type: 'followers',
        nigerian: true,
        sortOrder,
        enabled: true,
        tiers: {
          create: {
            tier: 'Standard',
            service: { connect: { id: svc7518.id } },
            sellPer1k: sellPer1k,
            minOrder: 50,
            maxOrder: 3000,
            refill: false,
            refillDays: 0,
            speed: 'Instant',
            sortOrder: 0,
            enabled: true,
          },
        },
      },
      include: { tiers: true },
    });

    console.log(`✓ Created group: ${group.name} (${group.id})`);
    console.log(`  Tier: ${group.tiers[0].tier} | Sell: ${group.tiers[0].sellPer1k} | Min: ${group.tiers[0].minOrder} | Max: ${group.tiers[0].maxOrder}`);
    console.log(`  Service: DAO #7518 | Cost: ${Number(svc7518.costPer1k)}`);
    console.log(`\n  ⚠ Review the sell price — set via Admin > Services if needed`);
  }

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
