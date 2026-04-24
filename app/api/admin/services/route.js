import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('services');
  if (error) return error;

  try {
    const [services, usdSetting] = await Promise.all([
      prisma.service.findMany({
        orderBy: { category: 'asc' },
        include: {
          _count: { select: { orders: true, tiers: true } },
        },
      }),
      prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } }),
    ]);

    const usdRate = Number(usdSetting?.value || 1600);

    return Response.json({
      services: services.map(s => ({
        id: s.id,
        apiId: s.apiId,
        name: s.name,
        category: s.category,
        costPer1k: Math.round(s.costPer1k * usdRate) / 100,
        sellPer1k: s.sellPer1k / 100,
        markup: s.markup,
        min: s.min,
        max: s.max,
        refill: s.refill,
        avgTime: s.avgTime,
        enabled: s.enabled,
        provider: s.provider || 'mtp',
        orders: s._count.orders,
        tiers: s._count.tiers,
      })),
    });
  } catch (err) {
    log.error('Admin Services', err.message);
    return Response.json({ error: 'Failed to load services' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('services', true);
  if (error) return error;

  try {
    const body = await req.json();
    const { action, serviceId } = body;

    // Actions that don't need a serviceId
    if (action === 'sync-enable') {
      const usedServiceIds = await prisma.serviceTier.findMany({
        where: { enabled: true },
        select: { serviceId: true },
        distinct: ['serviceId'],
      });
      const ids = usedServiceIds.map(t => t.serviceId);
      if (ids.length === 0) return Response.json({ success: true, enabled: 0, message: 'No active tiers found' });

      const result = await prisma.service.updateMany({
        where: { id: { in: ids }, enabled: false },
        data: { enabled: true },
      });
      await logActivity(admin.name, `Sync-enabled ${result.count} services used by active tiers`, 'service');
      return Response.json({ success: true, enabled: result.count, total: ids.length, message: `Enabled ${result.count} services (${ids.length} total in use)` });
    }

    if (!serviceId) return Response.json({ error: 'Service ID required' }, { status: 400 });

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return Response.json({ error: 'Service not found' }, { status: 404 });

    if (action === 'toggle') {
      const newEnabled = !service.enabled;
      // If disabling, check for active tiers
      if (!newEnabled) {
        const activeTiers = await prisma.serviceTier.count({ where: { serviceId, enabled: true } });
        if (activeTiers > 0) {
          // Disable the tiers too
          await prisma.serviceTier.updateMany({ where: { serviceId, enabled: true }, data: { enabled: false } });
          await prisma.service.update({ where: { id: serviceId }, data: { enabled: false } });
          await logActivity(admin.name, `Disabled service + ${activeTiers} tier(s): ${service.name}`, 'service');
          return Response.json({ success: true, enabled: false, cascaded: activeTiers, message: `Disabled service and ${activeTiers} tier(s) in Menu Builder` });
        }
      }
      await prisma.service.update({ where: { id: serviceId }, data: { enabled: newEnabled } });
      await logActivity(admin.name, `${service.enabled ? 'Disabled' : 'Enabled'} service: ${service.name}`, 'service');
      return Response.json({ success: true, enabled: newEnabled });
    }


    if (action === 'markup') {
      const m = Math.max(0, Math.min(999, Number(body.markup)));
      const newSell = Math.round(service.costPer1k * (1 + m / 100));
      await prisma.service.update({ where: { id: serviceId }, data: { markup: m, sellPer1k: newSell } });
      await logActivity(admin.name, `Updated markup for ${service.name} to ${m}%`, 'service');
      return Response.json({ success: true, markup: m, sellPer1k: newSell / 100 });
    }

    if (action === 'edit') {
      const data = {};
      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.category !== undefined) data.category = String(body.category).trim();
      if (body.min !== undefined) data.min = Math.max(1, Number(body.min) || 1);
      if (body.max !== undefined) data.max = Math.max(1, Number(body.max) || 100000);
      if (typeof body.enabled === 'boolean') data.enabled = body.enabled;
      if (typeof body.refill === 'boolean') data.refill = body.refill;
      if (body.avgTime !== undefined) data.avgTime = String(body.avgTime).trim();

      if (Object.keys(data).length === 0) return Response.json({ error: 'No changes provided' }, { status: 400 });

      const updated = await prisma.service.update({ where: { id: serviceId }, data });
      await logActivity(admin.name, `Edited service: ${updated.name}`, 'service');
      return Response.json({ success: true, service: { id: updated.id, name: updated.name, category: updated.category, min: updated.min, max: updated.max, enabled: updated.enabled, refill: updated.refill, avgTime: updated.avgTime } });
    }

    if (action === 'delete') {
      // Check if any tiers reference this service
      const tierCount = await prisma.serviceTier.count({ where: { serviceId } });
      if (tierCount > 0) {
        return Response.json({ error: `Cannot delete — ${tierCount} tier(s) still reference this service. Remove them from Menu Builder first.` }, { status: 400 });
      }
      // Check if any orders reference this service
      const orderCount = await prisma.order.count({ where: { serviceId } });
      if (orderCount > 0) {
        // Don't delete, just disable
        await prisma.service.update({ where: { id: serviceId }, data: { enabled: false } });
        await logActivity(admin.name, `Disabled service (has ${orderCount} orders): ${service.name}`, 'service');
        return Response.json({ success: true, disabled: true, message: `Service has ${orderCount} order(s) — disabled instead of deleted to preserve history.` });
      }
      await prisma.service.delete({ where: { id: serviceId } });
      await logActivity(admin.name, `Deleted service: ${service.name}`, 'service');
      return Response.json({ success: true, deleted: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Services POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
