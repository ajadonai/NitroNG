import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('analytics');
  if (error) return error;

  try {
    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '30d';

    const now = new Date();
    let since;
    if (range === '24h') since = new Date(now - 24 * 60 * 60 * 1000);
    else if (range === '7d') since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === '90d') since = new Date(now - 90 * 24 * 60 * 60 * 1000);
    else since = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [ordersAgg, userCount, ordersByStatus, topServices] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: since }, deletedAt: null },
        _sum: { charge: true, cost: true },
        _count: true,
      }),
      prisma.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since }, deletedAt: null },
        _count: true,
        _sum: { charge: true },
      }),
      prisma.order.groupBy({
        by: ['serviceId'],
        where: { createdAt: { gte: since }, deletedAt: null },
        _count: true,
        _sum: { charge: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 10,
      }),
    ]);

    // Resolve service names for top services
    const serviceIds = topServices.map(s => s.serviceId);
    const serviceNames = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, category: true },
    });
    const nameMap = {};
    serviceNames.forEach(s => { nameMap[s.id] = s; });

    return Response.json({
      range,
      revenue: (ordersAgg._sum.charge || 0) / 100,
      cost: (ordersAgg._sum.cost || 0) / 100,
      profit: ((ordersAgg._sum.charge || 0) - (ordersAgg._sum.cost || 0)) / 100,
      orderCount: ordersAgg._count,
      newUsers: userCount,
      byStatus: ordersByStatus.map(s => ({
        status: s.status,
        count: s._count,
        revenue: (s._sum.charge || 0) / 100,
      })),
      topServices: topServices.map(s => ({
        name: nameMap[s.serviceId]?.name || s.serviceId,
        category: nameMap[s.serviceId]?.category || 'unknown',
        orders: s._count,
        revenue: (s._sum.charge || 0) / 100,
      })),
    });
  } catch (err) {
    console.error('[Admin Analytics]', err.message);
    return Response.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
