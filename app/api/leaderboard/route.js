import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

function getBadge(orderCount) {
  if (orderCount >= 1000) return { title: 'Legend', emoji: '👑' };
  if (orderCount >= 201) return { title: 'Elite', emoji: '💎' };
  if (orderCount >= 51) return { title: 'Power User', emoji: '⚡' };
  if (orderCount >= 11) return { title: 'Regular', emoji: '🔥' };
  return { title: 'Starter', emoji: '🌱' };
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

    // Get all-time order counts for badges
    const allTimeCounts = await prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: spenderIds }, deletedAt: null },
      _count: { id: true },
    });
    const allTimeMap = Object.fromEntries(allTimeCounts.map(a => [a.userId, a._count.id]));

    const topSpenders = spenders.map((s, i) => {
      const u = spenderMap[s.userId] || {};
      const badge = getBadge(allTimeMap[s.userId] || s._count.id);
      return {
        rank: i + 1,
        name: formatName(u),
        orders: s._count.id,
        badge: badge.title,
        badgeEmoji: badge.emoji,
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

    // All-time counts for active badges
    const activeAllTime = await prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: activeIds }, deletedAt: null },
      _count: { id: true },
    });
    const activeAllTimeMap = Object.fromEntries(activeAllTime.map(a => [a.userId, a._count.id]));

    const mostActive = active.map((a, i) => {
      const u = activeMap[a.userId] || {};
      const badge = getBadge(activeAllTimeMap[a.userId] || a._count.id);
      return {
        rank: i + 1,
        name: formatName(u),
        orders: a._count.id,
        badge: badge.title,
        badgeEmoji: badge.emoji,
        isYou: a.userId === session.id,
      };
    });

    // Your all-time badge
    const yourAllTime = await prisma.order.count({ where: { userId: session.id, deletedAt: null } });
    const yourBadge = getBadge(yourAllTime);

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
      yourBadge: { title: yourBadge.title, emoji: yourBadge.emoji, totalOrders: yourAllTime },
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
