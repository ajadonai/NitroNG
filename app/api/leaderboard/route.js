import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'month'; // 'month' or 'all'

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFilter = period === 'month' ? { createdAt: { gte: monthStart } } : {};

    // Top spenders — by total charge on completed/processing orders
    const spenders = await prisma.order.groupBy({
      by: ['userId'],
      where: { ...dateFilter, deletedAt: null, status: { in: ['Completed', 'Processing', 'Pending'] } },
      _sum: { charge: true },
      _count: { id: true },
      orderBy: { _sum: { charge: 'desc' } },
      take: 10,
    });

    const spenderIds = spenders.map(s => s.userId);
    const spenderUsers = await prisma.user.findMany({
      where: { id: { in: spenderIds } },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    const spenderMap = Object.fromEntries(spenderUsers.map(u => [u.id, u]));

    const topSpenders = spenders.map((s, i) => {
      const u = spenderMap[s.userId] || {};
      return {
        rank: i + 1,
        name: formatName(u),
        initials: getInitials(u),
        amount: (s._sum.charge || 0) / 100,
        orders: s._count.id,
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
        initials: getInitials(u),
        referrals: count,
        isYou: userId === session.id,
      };
    });

    // Most active — by order count
    const active = await prisma.order.groupBy({
      by: ['userId'],
      where: { ...dateFilter, deletedAt: null },
      _count: { id: true },
      _sum: { charge: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const activeIds = active.map(a => a.userId);
    const activeUsers = await prisma.user.findMany({
      where: { id: { in: activeIds } },
      select: { id: true, name: true, firstName: true, lastName: true },
    });
    const activeMap = Object.fromEntries(activeUsers.map(u => [u.id, u]));

    const mostActive = active.map((a, i) => {
      const u = activeMap[a.userId] || {};
      return {
        rank: i + 1,
        name: formatName(u),
        initials: getInitials(u),
        orders: a._count.id,
        amount: (a._sum.charge || 0) / 100,
        isYou: a.userId === session.id,
      };
    });

    // Your ranks
    const yourSpenderRank = topSpenders.findIndex(s => s.isYou) + 1 || null;
    const yourRefRank = topReferrers.findIndex(r => r.isYou) + 1 || null;
    const yourActiveRank = mostActive.findIndex(a => a.isYou) + 1 || null;

    // Reward announcement
    let rewardAnnouncement = null;
    try {
      const setting = await prisma.siteConfig.findUnique({ where: { key: 'leaderboard_reward_announcement' } });
      const parsed = setting?.value ? JSON.parse(setting.value) : null;
      if (parsed?.enabled && parsed?.text) rewardAnnouncement = parsed.text;
    } catch {}

    return Response.json({
      spenders: topSpenders,
      referrers: topReferrers,
      active: mostActive,
      yourRank: { spenders: yourSpenderRank, referrers: yourRefRank, active: yourActiveRank },
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

function getInitials(u) {
  if (u.firstName && u.lastName) return (u.firstName[0] + u.lastName[0]).toUpperCase();
  if (u.name) return u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return '??';
}
