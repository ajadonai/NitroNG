import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

const STAFF_NAMES = { '8567146346': 'Nitro', '1935066216': 'Soludo', '8911494544': 'Eshiema' };
function staffName(tgId) { return STAFF_NAMES[String(tgId)] || `Staff ${String(tgId).slice(-4)}`; }

export async function GET(req) {
  const { admin, error } = await requireAdmin('outreach');
  if (error) return error;

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const now = new Date();

  let since, prevSince;
  if (from) {
    since = new Date(from);
    const end = to ? new Date(to + 'T23:59:59') : now;
    const rangeMs = end.getTime() - since.getTime();
    prevSince = new Date(since.getTime() - rangeMs);
    var dateFilter = { gte: since, lte: end };
    var prevFilter = { gte: prevSince, lt: since };
  } else {
    const period = req.nextUrl.searchParams.get('period') || 'week';
    const msMap = { today: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000, all: now.getTime() };
    const ms = msMap[period] || msMap.week;
    since = new Date(now.getTime() - ms);
    prevSince = period === 'all' ? since : new Date(since.getTime() - ms);
    var dateFilter = { gte: since };
    var prevFilter = { gte: prevSince, lt: since };
  }

  const staffParam = req.nextUrl.searchParams.get('staff');
  const staffFilter = staffParam ? { contactedBy: staffParam } : {};

  const skipStats = req.nextUrl.searchParams.get('skipStats') === '1';

  let stats = null, prev = null;
  if (!skipStats) {
    const [contacts, prevContacts] = await Promise.all([
      prisma.outreachContact.findMany({
        where: { contactedAt: dateFilter, ...staffFilter },
        select: { userId: true, touchType: true, contactedAt: true, contactedBy: true, method: true },
      }),
      prisma.outreachContact.findMany({
        where: { contactedAt: prevFilter, ...staffFilter },
        select: { userId: true, touchType: true, contactedAt: true, contactedBy: true, method: true },
      }),
    ]);
    stats = await buildStats(contacts, since);
    prev = await buildStats(prevContacts, prevSince);
  }

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const perPage = 15;
  const totalContacts = await prisma.outreachContact.count({ where: { contactedAt: dateFilter, ...staffFilter } });
  const recentContacts = await prisma.outreachContact.findMany({
    where: { contactedAt: dateFilter, ...staffFilter },
    select: {
      id: true, touchType: true, contactedAt: true, contactedBy: true, method: true,
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { contactedAt: 'desc' },
    skip: (page - 1) * perPage,
    take: perPage,
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
    contactedBy: c.contactedBy ? staffName(c.contactedBy) : null,
    method: c.method || null,
    userName: c.user?.name || c.user?.email?.split('@')[0] || 'User',
    userEmail: c.user?.email || null,
    userPhone: c.user?.phone || null,
    userId: c.user?.id,
    revenue: orderMap[c.user?.id]?.revenue || 0,
    orders: orderMap[c.user?.id]?.count || 0,
  }));

  const tab = req.nextUrl.searchParams.get('tab');
  let dnc = null;
  const dncCount = await prisma.user.count({ where: { outreachOptedOutAt: { not: null } } });
  let dncTotalPages = 1;
  if (tab === 'dnc') {
    const dncPage = Math.max(1, parseInt(req.nextUrl.searchParams.get('dncPage') || '1', 10));
    dncTotalPages = Math.ceil(dncCount / perPage);
    const dncUsers = await prisma.user.findMany({
      where: { outreachOptedOutAt: { not: null } },
      select: { id: true, name: true, email: true, phone: true, outreachOptedOutAt: true },
      orderBy: { outreachOptedOutAt: 'desc' },
      skip: (dncPage - 1) * perPage,
      take: perPage,
    });
    dnc = dncUsers.map(u => ({
      id: u.id,
      name: u.name || u.email?.split('@')[0] || 'User',
      phone: u.phone || null,
      since: u.outreachOptedOutAt,
    }));
  }

  const staffList = Object.entries(STAFF_NAMES).map(([id, name]) => ({ id, name }));

  return Response.json({ stats, prev, rows, dnc, dncCount, dncTotalPages, page, totalPages: Math.ceil(totalContacts / perPage), totalContacts, staffList });
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('outreach');
  if (error) return error;

  const body = await req.json();
  if (body.action === 'undnc' && body.userId) {
    await prisma.user.update({ where: { id: body.userId }, data: { outreachOptedOutAt: null } });
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'Unknown action' }, { status: 400 });
}

async function buildStats(contacts, since) {
  if (!contacts.length) return { contacts: 0, users: 0, converted: 0, revenue: 0, deposits: 0, byTouch: {}, byStaff: {}, byMethod: {} };

  const userIds = [...new Set(contacts.map(c => c.userId))];
  const byTouch = {};
  for (const c of contacts) byTouch[c.touchType] = (byTouch[c.touchType] || 0) + 1;
  const byStaff = {};
  for (const c of contacts) {
    const name = c.contactedBy ? staffName(c.contactedBy) : 'Unassigned';
    byStaff[name] = (byStaff[name] || 0) + 1;
  }
  const byMethod = {};
  for (const c of contacts) {
    const m = c.method || 'legacy';
    byMethod[m] = (byMethod[m] || 0) + 1;
  }

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

  const BUFFER_MS = 0;
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

  return { contacts: contacts.length, users: userIds.length, converted: converted.size, revenue: totalRevenue, deposits: totalDeposits, byTouch, byStaff, byMethod };
}
