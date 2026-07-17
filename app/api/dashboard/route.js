import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { getBonusInfo } from '@/lib/bonus-credit';
import { serializeTransaction, transactionHistoryCutoff } from '@/lib/transaction-history';

const ORDER_INCLUDE = {
  service: { select: { name: true, category: true } },
  tier: {
    select: {
      tier: true,
      speed: true,
      refill: true,
      refillDays: true,
      group: { select: { name: true, platform: true, type: true } },
    },
  },
};

function serializeOrder(o) {
  return {
    id: o.orderId || o.id,
    internalId: o.id,
    service: o.tier?.group?.name || o.service?.name || o.serviceId,
    platform: o.tier?.group?.platform || o.service?.category || 'unknown',
    tier: o.tier?.tier || null,
    speed: o.tier?.speed || null,
    link: o.link,
    quantity: o.quantity,
    charge: o.charge / 100,
    remains: o.remains,
    startCount: o.startCount,
    status: o.status,
    batchId: o.batchId || null,
    apiOrderId: o.apiOrderId || null,
    lastError: o.lastError || null,
    retryCount: o.retryCount || 0,
    refill: o.tier?.refill || false,
    refillDays: o.tier?.refillDays || 0,
    completedAt: o.completedAt?.toISOString() || null,
    created: o.createdAt.toISOString(),
    serviceType: o.tier?.group?.type || null,
    dripDays: o.dripDays || null,
  };
}

async function getOrderSummary(userId) {
  const rows = await prisma.$queryRaw`
    WITH scoped AS (
      SELECT
        o.status,
        o.charge,
        o.quantity,
        o."createdAt",
        o."lastError",
        o."apiOrderId",
        o."queuedBehind",
        COALESCE(sg.platform, s.category, 'unknown') AS platform
      FROM orders o
      JOIN services s ON s.id = o."serviceId"
      LEFT JOIN service_tiers st ON st.id = o."tierId"
      LEFT JOIN service_groups sg ON sg.id = st."groupId"
      WHERE o."userId" = ${userId} AND o."deletedAt" IS NULL
    ),
    platform_counts AS (
      SELECT platform, COUNT(*) AS order_count
      FROM scoped
      GROUP BY platform
      ORDER BY order_count DESC, platform ASC
      LIMIT 1
    )
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status <> 'Cancelled')::int AS "nonCancelled",
      COUNT(*) FILTER (WHERE status IN ('Pending', 'Processing', 'Dispatching'))::int AS active,
      COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days')::int AS "thisWeek",
      COUNT(*) FILTER (
        WHERE "queuedBehind" IS NULL
          AND (status = 'Partial' OR (status = 'Pending' AND "lastError" IS NOT NULL AND "apiOrderId" IS NULL))
      )::int AS attention,
      COALESCE(SUM(charge) FILTER (WHERE status <> 'Cancelled'), 0)::bigint AS "spentKobo",
      COALESCE(SUM(charge) FILTER (WHERE status = 'Cancelled'), 0)::bigint AS "refundedKobo",
      COALESCE(ROUND(AVG(quantity)), 0)::int AS "averageQuantity",
      (SELECT platform FROM platform_counts) AS "topPlatform"
    FROM scoped
  `;
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    nonCancelled: Number(row.nonCancelled || 0),
    active: Number(row.active || 0),
    completed: Number(row.completed || 0),
    thisWeek: Number(row.thisWeek || 0),
    attention: Number(row.attention || 0),
    spent: Number(row.spentKobo || 0) / 100,
    refunded: Number(row.refundedKobo || 0) / 100,
    spentKobo: Number(row.spentKobo || 0),
    averageQuantity: Number(row.averageQuantity || 0),
    topPlatform: row.topPlatform || null,
  };
}

export async function GET() {
  try {
    const payload = await getCurrentUser();
    if (!payload) return error('Not authenticated', 401);
    const historyCutoff = transactionHistoryCutoff();

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true, name: true, firstName: true, lastName: true, phone: true,
        email: true, balance: true,
        referralCode: true, referredBy: true, emailVerified: true, createdAt: true,
        orderTourCompleted: true,
        notifOrders: true, notifPromo: true, notifEmail: true,
        tosVersion: true, firstDepositBonusPaid: true,
        _count: { select: { transactions: { where: { createdAt: { gte: historyCutoff } } } } },
      },
    });
    if (!user) return error('User not found', 404);

    let orders = [];
    let activeOrders = [];
    let orderSummary = {
      total: 0, nonCancelled: 0, active: 0, completed: 0, thisWeek: 0,
      attention: 0, spent: 0, refunded: 0, spentKobo: 0,
      averageQuantity: 0, topPlatform: null,
    };
    try {
      [orders, activeOrders, orderSummary] = await Promise.all([
        prisma.order.findMany({
          where: { userId: user.id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: ORDER_INCLUDE,
        }),
        prisma.order.findMany({
          where: {
            userId: user.id,
            deletedAt: null,
            status: { in: ['Pending', 'Processing', 'Dispatching'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: ORDER_INCLUDE,
        }),
        getOrderSummary(user.id),
      ]);
    } catch (e) { log.error('Dashboard', 'Orders query failed', { error: e.message }); }

    // Mark stale pending gateway payments as Expired (>24h old, non-manual)
    // Don't delete — user may have paid but webhook/redirect failed
    try {
      await prisma.transaction.updateMany({
        where: { userId: user.id, status: 'Pending', type: 'deposit', method: { notIn: ['manual', 'crypto'] }, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        data: { status: 'Expired' },
      });
    } catch {}

    let transactions = [];
    let walletSummary = { funded: 0, spent: 0 };
    try {
      const [recentTransactions, totalsByType] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId: user.id, createdAt: { gte: historyCutoff } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.transaction.groupBy({
          by: ['type'],
          where: { userId: user.id, status: 'Completed' },
          _sum: { amount: true },
        }),
      ]);
      transactions = recentTransactions;
      const totals = Object.fromEntries(totalsByType.map(row => [row.type, Math.abs(row._sum.amount || 0)]));
      const funded = ['deposit', 'admin_credit', 'admin_gift', 'referral', 'bonus'].reduce((sum, type) => sum + (totals[type] || 0), 0);
      const orderDebits = totals.order || 0;
      const refunds = totals.refund || 0;
      walletSummary = { funded: funded / 100, spent: (orderDebits - refunds) / 100 };
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
        status: "Active",
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

    let unreadTickets = [];
    try {
      unreadTickets = await prisma.ticket.findMany({
        where: { userId: user.id, unreadByUser: true, status: { not: 'Archived' } },
        select: { ticketId: true, subject: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });
    } catch {}

    let currentTosVersion = null;
    try {
      const tosSetting = await prisma.setting.findUnique({ where: { key: 'tos_version' } });
      if (tosSetting) currentTosVersion = tosSetting.value;
    } catch {}

    const totalOrders = orderSummary.nonCancelled;

    const tc = (s) => s ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : '';
    const bonusCredit = await getBonusInfo(prisma, user.id);

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
        totalOrders,
        createdAt: user.createdAt,
        notifOrders: user.notifOrders,
        notifPromo: user.notifPromo,
        notifEmail: user.notifEmail,
        tosVersion: user.tosVersion || null,
        orderTourCompleted: user.orderTourCompleted,
        welcomeBonusEligible: !user.firstDepositBonusPaid,
        bonusCredit: bonusCredit || null,
      },
      orders: orders.map(serializeOrder),
      activeOrders: activeOrders.map(serializeOrder),
      ordersTotal: orderSummary.total,
      orderSummary: {
        total: orderSummary.total,
        active: orderSummary.active,
        completed: orderSummary.completed,
        thisWeek: orderSummary.thisWeek,
        attention: orderSummary.attention,
        spent: orderSummary.spent,
        refunded: orderSummary.refunded,
        averageQuantity: orderSummary.averageQuantity,
        topPlatform: orderSummary.topPlatform,
      },
      transactions: transactions.map(serializeTransaction),
      transactionsTotal: user._count.transactions,
      walletSummary,
      alerts: alerts.map(a => ({
        id: a.id, message: a.message, type: a.type,
        ...(a.actionLabel && a.actionHref ? { action: { label: a.actionLabel, href: a.actionHref } } : {}),
      })),
      currentTosVersion,
      unreadTickets: unreadTickets.map(tk => ({
        id: tk.ticketId,
        subject: tk.subject,
        updated: tk.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    log.error('Dashboard', 'Fatal error', { error: err.message });
    return error('Dashboard error: ' + err.message, 500);
  }
}
