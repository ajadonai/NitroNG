import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const period = req.nextUrl.searchParams.get('period') || 'week';
  const now = new Date();
  const ms = period === 'month' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const since = new Date(now.getTime() - ms);
  const prevSince = new Date(since.getTime() - ms);

  const [contacts, prevContacts] = await Promise.all([
    prisma.outreachContact.findMany({
      where: { contactedAt: { gte: since } },
      select: { userId: true, touchType: true, contactedAt: true },
    }),
    prisma.outreachContact.findMany({
      where: { contactedAt: { gte: prevSince, lt: since } },
      select: { userId: true, touchType: true, contactedAt: true },
    }),
  ]);

  const stats = await buildStats(contacts, since);
  const prev = await buildStats(prevContacts, prevSince);

  const recentContacts = await prisma.outreachContact.findMany({
    where: { contactedAt: { gte: since } },
    select: {
      id: true, touchType: true, contactedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { contactedAt: 'desc' },
    take: 50,
  });

  const recentUserIds = [...new Set(recentContacts.map(c => c.userId || c.user?.id))];
  const recentOrders = recentUserIds.length ? await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: recentUserIds }, createdAt: { gte: since }, status: { not: 'Cancelled' } },
    _sum: { charge: true },
    _count: true,
  }) : [];
  const orderMap = Object.fromEntries(recentOrders.map(o => [o.userId, { revenue: Number(o._sum.charge) || 0, count: o._count }]));

  const rows = recentContacts.map(c => ({
    id: c.id,
    touchType: c.touchType,
    contactedAt: c.contactedAt,
    userName: c.user?.name || c.user?.email?.split('@')[0] || 'User',
    userId: c.user?.id,
    revenue: orderMap[c.user?.id]?.revenue || 0,
    orders: orderMap[c.user?.id]?.count || 0,
  }));

  return Response.json({ stats, prev, rows });
}

async function buildStats(contacts, since) {
  if (!contacts.length) return { contacts: 0, users: 0, converted: 0, revenue: 0, deposits: 0, byTouch: {} };

  const userIds = [...new Set(contacts.map(c => c.userId))];
  const byTouch = {};
  for (const c of contacts) byTouch[c.touchType] = (byTouch[c.touchType] || 0) + 1;

  const earliestContact = {};
  for (const c of contacts) {
    if (!earliestContact[c.userId] || c.contactedAt < earliestContact[c.userId]) {
      earliestContact[c.userId] = c.contactedAt;
    }
  }

  const [orders, deposits] = await Promise.all([
    prisma.order.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: since }, status: { not: 'Cancelled' } },
      select: { userId: true, charge: true, createdAt: true },
    }),
    prisma.transaction.findMany({
      where: { userId: { in: userIds }, type: 'Deposit', status: 'Completed', createdAt: { gte: since } },
      select: { userId: true, amount: true, createdAt: true },
    }),
  ]);

  const BUFFER_MS = 3 * 60 * 60 * 1000;
  let totalRevenue = 0;
  let totalDeposits = 0;
  const converted = new Set();

  for (const o of orders) {
    const threshold = new Date(earliestContact[o.userId].getTime() + BUFFER_MS);
    if (o.createdAt >= threshold) {
      totalRevenue += Number(o.charge) || 0;
      converted.add(o.userId);
    }
  }
  for (const d of deposits) {
    const threshold = new Date(earliestContact[d.userId].getTime() + BUFFER_MS);
    if (d.createdAt >= threshold) {
      totalDeposits += Number(d.amount) || 0;
    }
  }

  return { contacts: contacts.length, users: userIds.length, converted: converted.size, revenue: totalRevenue, deposits: totalDeposits, byTouch };
}
