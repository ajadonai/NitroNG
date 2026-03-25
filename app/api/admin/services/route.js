import prisma from '@/lib/prisma';
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('services');
  if (error) return error;

  try {
    const services = await prisma.service.findMany({
      orderBy: { category: 'asc' },
      include: { _count: { select: { orders: true } } },
    });

    return Response.json({
      services: services.map(s => ({
        id: s.id,
        apiId: s.apiId,
        name: s.name,
        category: s.category,
        costPer1k: s.costPer1k / 100,
        sellPer1k: s.sellPer1k / 100,
        markup: s.markup,
        min: s.min,
        max: s.max,
        refill: s.refill,
        avgTime: s.avgTime,
        enabled: s.enabled,
        orders: s._count.orders,
      })),
    });
  } catch (err) {
    console.error('[Admin Services]', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('services', true);
  if (error) return error;

  try {
    const { action, serviceId, markup, enabled } = await req.json();
    if (!serviceId) return Response.json({ error: 'Service ID required' }, { status: 400 });

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return Response.json({ error: 'Service not found' }, { status: 404 });

    if (action === 'toggle') {
      await prisma.service.update({ where: { id: serviceId }, data: { enabled: !service.enabled } });
      await logActivity(admin.name, `${service.enabled ? 'Disabled' : 'Enabled'} service: ${service.name}`, 'service');
      return Response.json({ success: true, enabled: !service.enabled });
    }

    if (action === 'markup') {
      const m = Math.max(0, Math.min(999, Number(markup)));
      const newSell = Math.round(service.costPer1k * (1 + m / 100));
      await prisma.service.update({ where: { id: serviceId }, data: { markup: m, sellPer1k: newSell } });
      await logActivity(admin.name, `Updated markup for ${service.name} to ${m}%`, 'service');
      return Response.json({ success: true, markup: m, sellPer1k: newSell / 100 });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Admin Services POST]', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
