import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

const DEFAULT_TIERS = [
  { name: "Starter", threshold: 0, discount: 0, color: "#6B7280" },
  { name: "Regular", threshold: 5000000, discount: 3, color: "#F59E0B" },
  { name: "Power User", threshold: 25000000, discount: 5, color: "#3B82F6" },
  { name: "Elite", threshold: 100000000, discount: 8, color: "#8B5CF6" },
  { name: "Legend", threshold: 500000000, discount: 12, color: "#EF4444" },
];

async function getLoyaltyTiers() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'loyalty_tiers' } });
    if (row) return JSON.parse(row.value);
  } catch {}
  return DEFAULT_TIERS;
}

function getBadge(totalSpend, tiers) {
  let badge = tiers[0];
  for (const t of tiers) {
    if (totalSpend >= t.threshold) badge = t;
  }
  return badge;
}

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'month'; // 'month' or 'all'

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFilter = period === 'month' ? { createdAt: { gte: monthStart } } : {};
    const tiers = await getLoyaltyTiers();

    // Top spenders — ranked by order count (no amount exposed)
    const spenders = await prisma.order.groupBy({
      by: ['userId'],
      where: { ...dateFilter, deletedAt: null, status: { in: ['Completed', 'Processing', 'Pending'] } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const spenderIds = spenders.map(s => s.userId);
    const spenderUsers = await prisma.user.findMany({
      where: { id: { in: spenderIds } },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    const spenderMap = Object.fromEntries(spenderUsers.map(u => [u.id, u]));

    // Get all-time spend for badges (sum of charge on all orders)
    const allTimeSpend = await prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: spenderIds }, deletedAt: null, status: { not: 'Cancelled' } },
      _sum: { charge: true },
    });
    const spendMap = Object.fromEntries(allTimeSpend.map(a => [a.userId, a._sum.charge || 0]));

    const topSpenders = spenders.map((s, i) => {
      const u = spenderMap[s.userId] || {};
      const badge = getBadge(spendMap[s.userId] || 0, tiers);
      return {
        rank: i + 1,
        name: formatName(u),
        orders: s._count.id,
        badge: badge.name,
        badgeColor: badge.color,
        isYou: s.userId === session.id,
      };
    });

    // Top referrers — by referral count
    const referrers = await prisma.user.findMany({
      where: { referredBy: { not: null }, ...dateFilter },
      select: { referredBy: true },
    });
    const refCounts = {};
    referrers.forEach(r => { refCounts[r.referredBy] = (refCounts[r.referredBy] || 0) + 1; });
    const sortedRefs = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const refUserIds = sortedRefs.map(([id]) => id);
    const refUsers = await prisma.user.findMany({
      where: { id: { in: refUserIds } },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    const refMap = Object.fromEntries(refUsers.map(u => [u.id, u]));

    const topReferrers = sortedRefs.map(([userId, count], i) => {
      const u = refMap[userId] || {};
      return {
        rank: i + 1,
        name: formatName(u),
        referrals: count,
        isYou: userId === session.id,
      };
    });

    // Most active — by order count
    const active = await prisma.order.groupBy({
      by: ['userId'],
      where: { ...dateFilter, deletedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const activeIds = active.map(a => a.userId);
    const activeUsers = await prisma.user.findMany({
      where: { id: { in: activeIds } },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    const activeMap = Object.fromEntries(activeUsers.map(u => [u.id, u]));

    // All-time spend for active badges
    const activeAllTimeSpend = await prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: activeIds }, deletedAt: null, status: { not: 'Cancelled' } },
      _sum: { charge: true },
    });
    const activeSpendMap = Object.fromEntries(activeAllTimeSpend.map(a => [a.userId, a._sum.charge || 0]));

    const mostActive = active.map((a, i) => {
      const u = activeMap[a.userId] || {};
      const badge = getBadge(activeSpendMap[a.userId] || 0, tiers);
      return {
        rank: i + 1,
        name: formatName(u),
        orders: a._count.id,
        badge: badge.name,
        badgeColor: badge.color,
        isYou: a.userId === session.id,
      };
    });

    // Your all-time badge (by spend)
    const yourSpendAgg = await prisma.order.aggregate({ where: { userId: session.id, deletedAt: null, status: { not: 'Cancelled' } }, _sum: { charge: true }, _count: { id: true } });
    const yourTotalSpend = yourSpendAgg._sum.charge || 0;
    const yourTotalOrders = yourSpendAgg._count.id || 0;
    const yourBadge = getBadge(yourTotalSpend, tiers);

    // Next tier info
    const currentIdx = tiers.findIndex(t2 => t2.name === yourBadge.name);
    const nextTier = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;

    // Your ranks
    const yourSpenderRank = topSpenders.findIndex(s => s.isYou) + 1 || null;
    const yourRefRank = topReferrers.findIndex(r => r.isYou) + 1 || null;
    const yourActiveRank = mostActive.findIndex(a => a.isYou) + 1 || null;

    // Reward announcement
    let rewardAnnouncement = null;
    try {
      const setting = await prisma.setting.findUnique({ where: { key: 'leaderboard_reward_announcement' } });
      const parsed = setting?.value ? JSON.parse(setting.value) : null;
      if (parsed?.enabled && parsed?.text) rewardAnnouncement = parsed.text;
    } catch {}

    return Response.json({
      spenders: topSpenders,
      referrers: topReferrers,
      active: mostActive,
      yourRank: { spenders: yourSpenderRank, referrers: yourRefRank, active: yourActiveRank },
      yourBadge: { name: yourBadge.name, color: yourBadge.color, discount: yourBadge.discount, perks: yourBadge.perks, totalOrders: yourTotalOrders, nextTier: nextTier ? { name: nextTier.name, color: nextTier.color } : null },
      tiers,
      rewardAnnouncement,
      period,
    });
  } catch (err) {
    console.error('Leaderboard', err.message);
    return Response.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}

function formatName(u) {
  if (u.firstName && u.lastName) return `${u.firstName} ${u.lastName[0]}.`;
  if (u.name) { const parts = u.name.split(' '); return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]; }
  return 'Anonymous';
}
