import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function GET() {
  try {
    const payload = await getCurrentUser();
    if (!payload) return error('Not authenticated', 401);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true, name: true, firstName: true, lastName: true, phone: true,
        email: true, balance: true,
        referralCode: true, referredBy: true, emailVerified: true, createdAt: true,
      },
    });
    if (!user) return error('User not found', 404);

    let orders = [];
    try {
      orders = await prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { service: { select: { name: true, category: true } }, tier: { select: { tier: true, group: { select: { name: true, platform: true } } } } },
      });
    } catch (e) { log.error('Dashboard', 'Orders query failed', { error: e.message }); }

    let transactions = [];
    try {
      transactions = await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch (e) { log.error('Dashboard', 'Transactions query failed', { error: e.message }); }

    let referralCount = 0;
    let referralList = [];
    try {
      const referred = await prisma.user.findMany({
        where: { referredBy: user.referralCode, status: { not: 'Deleted' } },
        select: { id: true, name: true, emailVerified: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      referralCount = referred.length;
      referralList = referred.map(r => ({
        id: r.id,
        name: r.name,
        status: r.emailVerified ? "Active" : "Pending",
        joined: r.createdAt.toISOString(),
      }));
    } catch (e) { log.error('Dashboard', 'Referral count failed', { error: e.message }); }

    let referralEarnings = 0;
    try {
      const agg = await prisma.transaction.aggregate({
        where: { userId: user.id, type: 'referral' },
        _sum: { amount: true },
      });
      referralEarnings = agg._sum.amount || 0;
    } catch (e) { log.error('Dashboard', 'Referral earnings failed', { error: e.message }); }

    let alerts = [];
    try {
      alerts = await prisma.alert.findMany({
        where: {
          active: true,
          deletedAt: null,
          target: { in: ['everyone', 'users'] },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (e) { log.error('Dashboard', 'Alerts query failed', { error: e.message }); }

    // Check if user has a pending referral bonus (referred but bonus not yet paid)
    let pendingRefBonus = false;
    let refMinDepositDisplay = 0;
    if (user.referredBy) {
      try {
        const hasBonusTx = await prisma.transaction.findFirst({ where: { userId: user.id, type: 'referral' } });
        if (!hasBonusTx) {
          const minDepRow = await prisma.setting.findUnique({ where: { key: 'ref_min_deposit' } });
          const minDep = Number(minDepRow?.value) || 0;
          if (minDep > 0) {
            pendingRefBonus = true;
            refMinDepositDisplay = minDep / 100;
          }
        }
      } catch {}
    }

    return ok({
      user: {
        id: user.id, name: user.name,
        firstName: user.firstName || user.name.split(' ')[0],
        lastName: user.lastName || user.name.split(' ').slice(1).join(' ') || '',
        phone: user.phone || '',
        email: user.email,
        balance: user.balance / 100,
        emailVerified: user.emailVerified,
        refs: referralCount,
        earnings: referralEarnings / 100,
        refCode: user.referralCode,
        referralList,
        pendingRefBonus,
        refMinDeposit: refMinDepositDisplay,
        themePreference: user.themePreference || 'auto',
        perPagePreference: user.perPagePreference || 10,
      },
      orders: orders.map(o => ({
        id: o.orderId || o.id,
        service: o.tier?.group?.name || o.service?.name || o.serviceId,
        platform: o.tier?.group?.platform || o.service?.category || 'unknown',
        tier: o.tier?.tier || null,
        link: o.link, quantity: o.quantity,
        charge: o.charge / 100,
        status: o.status,
        created: o.createdAt.toISOString(),
      })),
      transactions: transactions.map(tx => ({
        id: tx.id, type: tx.type,
        reference: tx.reference || null,
        amount: tx.amount / 100,
        method: tx.method || tx.type,
        date: tx.createdAt.toISOString(),
        description: tx.note,
      })),
      alerts: alerts.map(a => ({
        id: a.id, message: a.message, type: a.type,
      })),
    });
  } catch (err) {
    log.error('Dashboard', 'Fatal error', { error: err.message });
    return error('Dashboard error: ' + err.message, 500);
  }
}
