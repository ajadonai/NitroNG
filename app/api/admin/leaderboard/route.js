import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';
import { sendEmail, leaderboardRewardEmail } from '@/lib/email';

export async function GET(req) {
  const { admin, error } = await requireAdmin('leaderboard');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'month';
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFilter = period === 'month' ? { createdAt: { gte: monthStart } } : {};

    // Top spenders
    const spenders = await prisma.order.groupBy({
      by: ['userId'],
      where: { ...dateFilter, deletedAt: null, status: { in: ['Completed', 'Processing', 'Pending'] } },
      _sum: { charge: true, cost: true },
      _count: { id: true },
      orderBy: { _sum: { charge: 'desc' } },
      take: 20,
    });

    const allUserIds = [...new Set(spenders.map(s => s.userId))];

    // Top referrers
    const allUsers = await prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, firstName: true, lastName: true, email: true, referralCode: true, referredBy: true, createdAt: true },
    });
    const userMap = Object.fromEntries(allUsers.map(u => [u.id, u]));

    // Count referrals
    const refFilter = period === 'month' ? allUsers.filter(u => u.createdAt >= monthStart) : allUsers;
    const refCounts = {};
    refFilter.forEach(u => { if (u.referredBy) refCounts[u.referredBy] = (refCounts[u.referredBy] || 0) + 1; });
    const sortedRefs = Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);

    // Most active
    const active = await prisma.order.groupBy({
      by: ['userId'],
      where: { ...dateFilter, deletedAt: null },
      _count: { id: true },
      _sum: { charge: true, cost: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    // Get reward announcement
    let rewardAnnouncement = null;
    try {
      const setting = await prisma.setting.findUnique({ where: { key: 'leaderboard_reward_announcement' } });
      rewardAnnouncement = setting?.value ? JSON.parse(setting.value) : null;
    } catch {}

    // Get auto-reward config
    let autoReward = null;
    try {
      const setting = await prisma.setting.findUnique({ where: { key: 'leaderboard_auto_reward' } });
      autoReward = setting?.value ? JSON.parse(setting.value) : null;
    } catch {}

    // Get past rewards
    const rewards = await prisma.transaction.findMany({
      where: { type: 'bonus', note: { contains: 'Leaderboard' } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { name: true, firstName: true, lastName: true, email: true } } },
    });

    const formatUser = (u) => ({
      name: u?.name || 'Unknown',
      firstName: u?.firstName || '',
      lastName: u?.lastName || '',
      email: u?.email || '',
      initials: getInitials(u),
    });

    return Response.json({
      spenders: spenders.map((s, i) => ({
        rank: i + 1,
        userId: s.userId,
        ...formatUser(userMap[s.userId]),
        spend: (s._sum.charge || 0) / 100,
        cost: (s._sum.cost || 0) / 100,
        profit: ((s._sum.charge || 0) - (s._sum.cost || 0)) / 100,
        orders: s._count.id,
      })),
      referrers: sortedRefs.map(([userId, count], i) => ({
        rank: i + 1,
        userId,
        ...formatUser(userMap[userId]),
        referrals: count,
      })),
      active: active.map((a, i) => ({
        rank: i + 1,
        userId: a.userId,
        ...formatUser(userMap[a.userId]),
        orders: a._count.id,
        spend: (a._sum.charge || 0) / 100,
        profit: ((a._sum.charge || 0) - (a._sum.cost || 0)) / 100,
      })),
      rewardAnnouncement,
      autoReward,
      rewards: rewards.map(r => ({
        id: r.id,
        amount: r.amount / 100,
        note: r.note,
        date: r.createdAt.toISOString(),
        user: formatUser(r.user),
      })),
      period,
    });
  } catch (err) {
    log.error('Admin Leaderboard GET', err.message);
    return Response.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('leaderboard', true);
  if (error) return error;

  try {
    const { action, userId, amount, note, announcement, config } = await req.json();

    if (action === 'reward') {
      if (!canPerformAction(admin, 'leaderboard.reward')) return Response.json({ error: 'Not authorized to send rewards' }, { status: 403 });
      if (!userId || !amount || amount <= 0) {
        return Response.json({ error: 'User and amount required' }, { status: 400 });
      }
      const amountKobo = Math.round(amount * 100);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { balance: { increment: amountKobo } } });
        await tx.transaction.create({
          data: {
            userId, type: 'bonus', amount: amountKobo,
            method: 'wallet', status: 'Completed',
            reference: `LB-REWARD-${Date.now().toString(36).toUpperCase()}`,
            note: note || `Leaderboard reward — ₦${amount.toLocaleString()}`,
          },
        });
      });

      await logActivity(admin.name, `Rewarded ${user.name || user.email} with ₦${amount.toLocaleString()}`, 'reward');

      // Email notification
      if (user.email && user.notifEmail !== false) {
        leaderboardRewardEmail(user.name || 'there', amount).then(html => sendEmail(user.email, `You received ₦${amount.toLocaleString()} on Nitro!`, html)).catch(() => {});
      }

      return Response.json({ success: true, message: `₦${amount.toLocaleString()} credited to ${user.name || user.email}` });
    }

    if (action === 'set_announcement') {
      if (!canPerformAction(admin, 'leaderboard.announcement')) return Response.json({ error: 'Not authorized' }, { status: 403 });
      const value = announcement ? JSON.stringify({ text: announcement.text || '', enabled: announcement.enabled ?? true }) : JSON.stringify({ text: '', enabled: false });
      await prisma.setting.upsert({
        where: { key: 'leaderboard_reward_announcement' },
        update: { value },
        create: { key: 'leaderboard_reward_announcement', value },
      });
      await logActivity(admin.name, `Updated leaderboard announcement`, 'reward');
      return Response.json({ success: true });
    }

    if (action === 'set_auto_reward') {
      if (!canPerformAction(admin, 'leaderboard.autoReward')) return Response.json({ error: 'Not authorized' }, { status: 403 });
      const value = JSON.stringify(config || { enabled: false, category: 'spenders', slots: [] });
      await prisma.setting.upsert({
        where: { key: 'leaderboard_auto_reward' },
        update: { value },
        create: { key: 'leaderboard_auto_reward', value },
      });
      await logActivity(admin.name, `Updated auto-reward config`, 'reward');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Leaderboard POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}

function getInitials(u) {
  if (u?.firstName && u?.lastName) return (u.firstName[0] + u.lastName[0]).toUpperCase();
  if (u?.name) return u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return '??';
}
