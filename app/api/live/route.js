import prisma from '@/lib/prisma';
import { HEARTBEAT_ACTIVE_WINDOW_MS } from '@/lib/heartbeat';
import { log } from '@/lib/logger';
import { getOrderOfferDisplay } from '@/lib/order-offer-display';
import {
  internalDashboardAccessError,
  requireInternalDashboardAccess,
  withInternalDashboardNoStore,
} from '@/lib/internal-dashboard-access';
import {
  rateLimit,
  rateLimitUnavailable,
  tooManyRequests,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
const LIVE_SESSION_RESULT_LIMIT = 500;
const LIVE_IDENTIFIED_RESERVED_SLOTS = 400;
const LIVE_ANONYMOUS_RESULT_LIMIT = LIVE_SESSION_RESULT_LIMIT - LIVE_IDENTIFIED_RESERVED_SLOTS;

export async function GET(req) {
  let limit;
  try {
    // Live polls every few seconds. Keep the unauthenticated guard broad enough
    // for several legitimate tabs behind the same office/mobile NAT while
    // still bounding abusive traffic before any session or data lookup.
    limit = await rateLimit(req, { maxAttempts: 120, windowMs: 60_000 });
  } catch {
    return withInternalDashboardNoStore(rateLimitUnavailable());
  }
  if (limit.unavailable) {
    return withInternalDashboardNoStore(rateLimitUnavailable(undefined, limit.retryAfter));
  }
  if (limit.limited) {
    return withInternalDashboardNoStore(tooManyRequests(
      'Too many Live requests. Please try again shortly.',
      limit.retryAfter,
    ));
  }

  let access;
  try {
    access = await requireInternalDashboardAccess();
  } catch (err) {
    log.error('Live Access', err.message);
    return withInternalDashboardNoStore(Response.json(
      { error: 'Internal dashboard access is temporarily unavailable' },
      { status: 503 },
    ));
  }
  if (!access.ok) return internalDashboardAccessError(access);

  try {
    const cutoff = new Date(Date.now() - HEARTBEAT_ACTIVE_WINDOW_MS);
    // Anonymous traffic can never consume the slots reserved for signed-in
    // customers and admins. Identified sessions may use any unused anonymous
    // capacity, while the final merge preserves newest-first display order.
    const [identifiedSessions, anonymousSessions] = await Promise.all([
      prisma.liveSession.findMany({
        where: { lastSeen: { gte: cutoff }, userId: { not: null } },
        orderBy: { lastSeen: 'desc' },
        take: LIVE_SESSION_RESULT_LIMIT,
      }),
      prisma.liveSession.findMany({
        where: { lastSeen: { gte: cutoff }, userId: null },
        orderBy: { lastSeen: 'desc' },
        take: LIVE_ANONYMOUS_RESULT_LIMIT,
      }),
    ]);
    const sessions = [...identifiedSessions, ...anonymousSessions]
      .sort((left, right) => right.lastSeen.getTime() - left.lastSeen.getTime())
      .slice(0, LIVE_SESSION_RESULT_LIMIT);

    const userIds = [...new Set(sessions.map(s => s.userId).filter(Boolean))];
    const [users, depositTotals] = userIds.length
      ? await Promise.all([
        prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true, name: true, email: true, balance: true, createdAt: true, signupSource: true,
            orders: {
              orderBy: { createdAt: 'desc' }, take: 3, where: { deletedAt: null },
              select: {
                orderId: true,
                serviceId: true,
                tierId: true,
                serviceNameAtPurchase: true,
                tierNameAtPurchase: true,
                platformAtPurchase: true,
                serviceTypeAtPurchase: true,
                charge: true,
                status: true,
                createdAt: true,
                service: { select: { name: true, category: true, enabled: true } },
                tier: {
                  select: {
                    tier: true,
                    enabled: true,
                    serviceId: true,
                    group: { select: { name: true, platform: true, type: true, enabled: true } },
                  },
                },
              },
            },
            _count: { select: { orders: { where: { deletedAt: null } } } },
          },
        }),
        prisma.transaction.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            type: { in: ['deposit', 'admin_credit'] },
            status: 'Completed',
          },
          _sum: { amount: true },
        }),
      ])
      : [[], []];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const depositTotalMap = Object.fromEntries(
      depositTotals.map(row => [row.userId, row._sum.amount || 0]),
    );

    const unmatchedIds = userIds.filter(id => !userMap[id]);
    const admins = unmatchedIds.length
      ? await prisma.admin.findMany({ where: { id: { in: unmatchedIds } }, select: { id: true, name: true, email: true } })
      : [];
    const adminMap = Object.fromEntries(admins.map(a => [a.id, a]));

    const result = sessions.map(s => {
      const u = s.userId ? userMap[s.userId] : null;
      const admin = !u && s.userId ? adminMap[s.userId] : null;
      return {
        sessionId: s.sessionId,
        page: s.page,
        firstSeen: s.firstSeen.toISOString(),
        lastSeen: s.lastSeen.toISOString(),
        ua: s.ua,
        user: u ? {
          name: u.name,
          email: u.email,
          balance: u.balance / 100,
          orderCount: u._count.orders,
          totalDeposited: (depositTotalMap[u.id] || 0) / 100,
          lastOrder: u.orders[0]?.createdAt?.toISOString() || null,
          joined: u.createdAt.toISOString(),
          source: u.signupSource || null,
          recentOrders: u.orders.map(o => {
            const offer = getOrderOfferDisplay(o);
            return {
              id: o.orderId,
              service: offer.serviceName,
              tier: offer.tierLabel,
              platform: offer.platform,
              charge: o.charge / 100,
              status: o.status,
              date: o.createdAt.toISOString(),
            };
          }),
        } : admin ? {
          name: admin.name,
          email: admin.email,
          isAdmin: true,
        } : null,
      };
    });

    return withInternalDashboardNoStore(Response.json({
      sessions: result,
      count: result.length,
      truncated: identifiedSessions.length === LIVE_SESSION_RESULT_LIMIT
        || anonymousSessions.length === LIVE_ANONYMOUS_RESULT_LIMIT,
      ts: Date.now(),
    }));
  } catch (err) {
    log.error('Live API', err.message);
    return withInternalDashboardNoStore(Response.json({ error: 'Failed to load live data' }, { status: 500 }));
  }
}
