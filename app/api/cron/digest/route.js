export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { watBounds } from '@/lib/format';
import { tgDigest } from '@/lib/telegram';

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '') || new URL(req.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { todayStart, yesterdayStart } = watBounds();
    const now = new Date();
    const watTime = now.toLocaleString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    const watDate = now.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' });

    const partialAdj = (orders) => {
      let charge = 0;
      for (const p of orders) {
        charge += Math.round(p.charge * (p.remains / p.quantity));
      }
      return charge;
    };

    const [
      newUsersToday, totalUsers,
      todayRevenueAgg, yesterdayRevenueAgg,
      todayDepositsAgg, yesterdayDepositsAgg,
      todayOrderCount, yesterdayOrderCount,
      processingCount,
      partialToday, partialYesterday,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: todayStart }, emailVerified: true } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: { notIn: ['Cancelled'] } }, _sum: { charge: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: { in: ['deposit', 'admin_credit'] }, status: 'Completed', createdAt: { gte: yesterdayStart, lt: todayStart } }, _sum: { amount: true } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart }, deletedAt: null } }),
      prisma.order.count({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null } }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
      prisma.order.findMany({ where: { createdAt: { gte: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, quantity: true, remains: true } }),
      prisma.order.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null, status: 'Partial', remains: { gt: 0 }, quantity: { gt: 0 } }, select: { charge: true, quantity: true, remains: true } }),
    ]);

    const todayRevenue = ((todayRevenueAgg._sum.charge || 0) - partialAdj(partialToday)) / 100;
    const yesterdayRevenue = ((yesterdayRevenueAgg._sum.charge || 0) - partialAdj(partialYesterday)) / 100;
    const todayDeposits = (todayDepositsAgg._sum.amount || 0) / 100;
    const yesterdayDeposits = (yesterdayDepositsAgg._sum.amount || 0) / 100;

    const pct = (today, yesterday) => {
      if (yesterday === 0) return today > 0 ? null : 0;
      return Math.round(((today - yesterday) / yesterday) * 100);
    };

    const fmtPct = (val) => {
      if (val === null) return ' 🆕';
      if (val === 0) return '';
      return val > 0 ? ` (+${val}%)` : ` (${val}%)`;
    };

    const fmtNaira = (val) => `₦${val.toLocaleString('en-NG')}`;

    tgDigest(watDate, watTime, {
      newUsers: newUsersToday,
      totalUsers,
      revenue: fmtNaira(Math.round(todayRevenue)),
      revenuePct: fmtPct(pct(todayRevenue, yesterdayRevenue)),
      deposits: fmtNaira(Math.round(todayDeposits)),
      depositsPct: fmtPct(pct(todayDeposits, yesterdayDeposits)),
      orders: todayOrderCount,
      ordersPct: fmtPct(pct(todayOrderCount, yesterdayOrderCount)),
      processing: processingCount,
    });

    return Response.json({ ok: true });
  } catch (err) {
    log.error('Digest cron', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
