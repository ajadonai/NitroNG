import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';
import { sendEmail } from '@/lib/email';

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

      await logActivity(admin.id, 'leaderboard_reward', `Rewarded ${user.name || user.email} with ₦${amount.toLocaleString()}`);

      // Email notification
      if (user.email) {
        const rewardNote = note || `Leaderboard reward — ₦${amount.toLocaleString()}`;
        sendEmail(user.email, `🎁 You received ₦${amount.toLocaleString()} on Nitro!`,
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#c47d8e;margin:0 0 8px;">You've been rewarded! 🎁</h2>
            <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 16px;">
              <strong>₦${amount.toLocaleString()}</strong> has been added to your Nitro wallet.
            </p>
            <p style="color:#666;font-size:14px;line-height:1.5;margin:0 0 20px;">${rewardNote}</p>
            <a href="https://nitro.ng/dashboard" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#c47d8e,#8b5e6b);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Check your balance →</a>
            <p style="color:#999;font-size:12px;margin:24px 0 0;">— The Nitro Team</p>
          </div>`
        ).catch(() => {});
      }

      return Response.json({ success: true, message: `₦${amount.toLocaleString()} credited to ${user.name || user.email}` });
    }

    if (action === 'set_announcement') {
      const value = announcement ? JSON.stringify({ text: announcement.text || '', enabled: announcement.enabled ?? true }) : JSON.stringify({ text: '', enabled: false });
      await prisma.setting.upsert({
        where: { key: 'leaderboard_reward_announcement' },
        update: { value },
        create: { key: 'leaderboard_reward_announcement', value },
      });
      await logActivity(admin.id, 'leaderboard_announcement', `Updated leaderboard announcement`);
      return Response.json({ success: true });
    }

    if (action === 'set_auto_reward') {
      const value = JSON.stringify(config || { enabled: false, category: 'spenders', slots: [] });
      await prisma.setting.upsert({
        where: { key: 'leaderboard_auto_reward' },
        update: { value },
        create: { key: 'leaderboard_auto_reward', value },
      });
      await logActivity(admin.id, 'auto_reward_config', `Updated auto-reward config`);
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
