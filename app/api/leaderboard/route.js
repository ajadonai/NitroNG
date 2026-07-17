import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { watBounds } from '@/lib/format';
import { getEligibleSpendKoboBatch, getNitroStatus, STATUS_TIERS } from '@/lib/nitro-rewards';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'month'; // 'month' or 'all'

    const { monthStart } = watBounds();
    const dateFilter = period === 'month' ? { createdAt: { gte: monthStart } } : {};

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
      where: { ...dateFilter, deletedAt: null, status: { not: 'Cancelled' } },
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

    // Status badges use the same eligible-spend rules as checkout and rewards.
    // Fetch all list users plus the current user in one DB-side batch rather
    // than recalculating lifetime spend once per leaderboard entry.
    const badgeUserIds = [...new Set([...spenderIds, ...activeIds, session.id])];
    const [eligibleSpendByUser, yourTotalOrders] = await Promise.all([
      getEligibleSpendKoboBatch(badgeUserIds),
      prisma.order.count({
        where: { userId: session.id, deletedAt: null, status: { not: 'Cancelled' } },
      }),
    ]);

    const topSpenders = spenders.map((s, i) => {
      const u = spenderMap[s.userId] || {};
      const badge = getNitroStatus((eligibleSpendByUser.get(s.userId) || 0) / 100);
      return {
        rank: i + 1,
        name: formatName(u),
        orders: s._count.id,
        badge: badge.name,
        badgeColor: badge.color,
        isYou: s.userId === session.id,
      };
    });

    const mostActive = active.map((a, i) => {
      const u = activeMap[a.userId] || {};
      const badge = getNitroStatus((eligibleSpendByUser.get(a.userId) || 0) / 100);
      return {
        rank: i + 1,
        name: formatName(u),
        orders: a._count.id,
        badge: badge.name,
        badgeColor: badge.color,
        isYou: a.userId === session.id,
      };
    });

    // Your all-time badge uses the same canonical batch result.
    const yourBadge = getNitroStatus((eligibleSpendByUser.get(session.id) || 0) / 100);

    // Next tier info
    const currentIdx = STATUS_TIERS.findIndex(t2 => t2.key === yourBadge.key);
    const nextTier = currentIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[currentIdx + 1] : null;

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
      yourBadge: { name: yourBadge.name, color: yourBadge.color, totalOrders: yourTotalOrders, nextTier: nextTier ? { name: nextTier.name, color: nextTier.color } : null },
      tiers: STATUS_TIERS.map(t => ({ name: t.name, color: t.color, min: t.min })),
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
