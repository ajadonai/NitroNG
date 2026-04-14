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
        tourCompleted: true, orderTourCompleted: true,
        notifOrders: true, notifPromo: true, notifEmail: true,
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

    // User badge based on total lifetime spend
    const DEFAULT_TIERS = [
      { name: "Starter", threshold: 0, discount: 0, color: "#6B7280", perks: "Welcome to Nitro" },
      { name: "Regular", threshold: 5000000, discount: 3, color: "#F59E0B", perks: "3% discount on all orders" },
      { name: "Power User", threshold: 25000000, discount: 5, color: "#3B82F6", perks: "5% discount + priority support" },
      { name: "Elite", threshold: 100000000, discount: 8, color: "#8B5CF6", perks: "8% discount + priority support" },
      { name: "Legend", threshold: 500000000, discount: 12, color: "#EF4444", perks: "12% discount + priority support + early access" },
    ];
    let loyaltyTiers = DEFAULT_TIERS;
    try {
      const ltRow = await prisma.setting.findUnique({ where: { key: 'loyalty_tiers' } });
      if (ltRow) loyaltyTiers = JSON.parse(ltRow.value);
    } catch {}

    let totalOrders = 0;
    let totalSpend = 0;
    try {
      const agg = await prisma.order.aggregate({ where: { userId: user.id, deletedAt: null }, _sum: { charge: true }, _count: { id: true } });
      totalOrders = agg._count.id || 0;
      totalSpend = agg._sum.charge || 0;
    } catch {}

    let badge = loyaltyTiers[0];
    for (const t2 of loyaltyTiers) { if (totalSpend >= t2.threshold) badge = t2; }
    const currentIdx = loyaltyTiers.findIndex(t2 => t2.name === badge.name);
    const nextTier = currentIdx < loyaltyTiers.length - 1 ? loyaltyTiers[currentIdx + 1] : null;

    const tc = (s) => s ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : '';

    return ok({
      user: {
        id: user.id, name: tc(user.name),
        firstName: tc(user.firstName || user.name.split(' ')[0]),
        lastName: tc(user.lastName || user.name.split(' ').slice(1).join(' ') || ''),
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
        badge: badge.name,
        badgeColor: badge.color,
        badgeDiscount: badge.discount,
        badgePerks: badge.perks,
        totalOrders,
        nextTier: nextTier ? { name: nextTier.name, color: nextTier.color } : null,
        createdAt: user.createdAt,
        notifOrders: user.notifOrders,
        notifPromo: user.notifPromo,
        notifEmail: user.notifEmail,
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
