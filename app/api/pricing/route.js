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
      let type = g.name.replace(new RegExp(`^(${p}|X/Twitter|Twitter/X)\\s*`, 'i'), '').trim() || g.type || g.name;
      // Skip geo/Nigerian/combo variants and niche services for the landing cards
      if (/nigerian|🇳🇬|🇺🇸|🇬🇭|usa|ghana|auto |growth|vip|pk battle|use sound|duet|emoji|random|custom|profile|seo|premium|live stream|last \d|comment like|group member|page like|\+|shorts/i.test(type)) continue;
      // Only add unique base service types per platform
      const baseType = type.replace(/\s*—.*$/, '').replace(/\s*\(.*\)$/, '').trim();
      if (!platformMap[p].services.find(s => s.baseType === baseType)) {
        platformMap[p].services.push({ type: baseType, baseType, price });
        platformMap[p].count++;
        if (price < platformMap[p].minPrice) platformMap[p].minPrice = price;
      }
    }

    // Sort platforms: prioritize main platforms, then by service count
    const PRIORITY_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Twitter/X', 'Facebook', 'Telegram'];
    const platforms = Object.values(platformMap)
      .sort((a, b) => {
        const ai = PRIORITY_PLATFORMS.indexOf(a.platform), bi = PRIORITY_PLATFORMS.indexOf(b.platform);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return b.count - a.count;
      })
      .slice(0, 6)
      .map(p => ({
        platform: p.platform,
        minPrice: p.minPrice,
        services: p.services
          .sort((a, b) => {
            const priority = t => /follower|subscriber|member/i.test(t) ? 0 : /like/i.test(t) ? 1 : /view|play|stream/i.test(t) ? 2 : 3;
            const pa = priority(a.type), pb = priority(b.type);
            return pa !== pb ? pa - pb : a.price - b.price;
          })
          .slice(0, 4)
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
