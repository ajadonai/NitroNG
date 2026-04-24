import prisma from '@/lib/prisma';

export const revalidate = 300;

export async function GET() {
  try {
    // Get all enabled groups with their enabled tiers
    const groups = await prisma.serviceGroup.findMany({
      where: { enabled: true },
      include: {
        tiers: {
          where: { enabled: true },
          orderBy: { sellPer1k: 'asc' },
          take: 1, // cheapest tier per group
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Aggregate by platform — for each platform, collect service types with cheapest price
    const platformMap = {};
    for (const g of groups) {
      if (!g.tiers.length) continue;
      const p = g.platform;
      if (!platformMap[p]) platformMap[p] = { platform: p, services: [], minPrice: Infinity, count: 0 };
      const price = g.tiers[0].sellPer1k;
      // Extract type from group name (e.g. "Instagram Followers" → "Followers")
      const type = g.name.replace(new RegExp(`^${p}\\s*`, 'i'), '').trim() || g.type || g.name;
      // Only add unique service types per platform
      if (!platformMap[p].services.find(s => s.type === type)) {
        platformMap[p].services.push({ type, price });
        platformMap[p].count++;
        if (price < platformMap[p].minPrice) platformMap[p].minPrice = price;
      }
    }

    // Sort platforms by service count (most services first), take top 6
    const platforms = Object.values(platformMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(p => ({
        platform: p.platform,
        minPrice: p.minPrice,
        services: p.services
          .sort((a, b) => a.price - b.price)
          .slice(0, 4) // max 4 service types per platform
          .map(s => ({
            type: s.type,
            price: `₦${(s.price / 100).toLocaleString()}/1K`,
          })),
      }));

    return Response.json({ platforms });
  } catch (err) {
    return Response.json({ platforms: [] });
  }
}
