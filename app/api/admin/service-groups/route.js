import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('services');
  if (error) return error;

  try {
    const groups = await prisma.serviceGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        tiers: {
          orderBy: { sortOrder: 'asc' },
          include: {
            service: {
              select: { id: true, apiId: true, name: true, category: true, costPer1k: true, min: true, max: true, refill: true, avgTime: true },
            },
          },
        },
      },
    });

    // Also return raw MTP services for the admin picker (all, not just enabled)
    const services = await prisma.service.findMany({
      orderBy: { category: 'asc' },
      select: { id: true, apiId: true, name: true, category: true, costPer1k: true, sellPer1k: true, min: true, max: true, refill: true, avgTime: true },
    });

    return Response.json({
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        platform: g.platform,
        type: g.type,
        nigerian: g.nigerian,
        enabled: g.enabled,
        sortOrder: g.sortOrder,
        tiers: g.tiers.map(t => ({
          id: t.id,
          tier: t.tier,
          sellPer1k: t.sellPer1k,
          refill: t.refill,
          speed: t.speed,
          enabled: t.enabled,
          sortOrder: t.sortOrder,
          serviceId: t.serviceId,
          service: t.service,
        })),
      })),
      services: services.map(s => ({
        id: s.id,
        apiId: s.apiId,
        name: s.name,
        category: s.category,
        costPer1k: s.costPer1k,
        sellPer1k: s.sellPer1k,
        min: s.min,
        max: s.max,
        refill: s.refill,
        avgTime: s.avgTime,
      })),
    });
  } catch (err) {
    log.error('Admin ServiceGroups GET', err.message);
    return Response.json({ error: 'Failed to load service groups' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('services', true);
  if (error) return error;

  try {
    const body = await req.json();
    const { action } = body;

    // ── Group actions ──
    if (action === 'create-group') {
      const { name, platform, type, nigerian } = body;
      if (!name || !platform) return Response.json({ error: 'Name and platform required' }, { status: 400 });

      const maxSort = await prisma.serviceGroup.aggregate({ _max: { sortOrder: true } });
      const group = await prisma.serviceGroup.create({
        data: {
          name: name.trim(),
          platform: platform.trim(),
          type: type || 'Standard',
          nigerian: !!nigerian,
          sortOrder: (maxSort._max.sortOrder || 0) + 1,
        },
      });
      await logActivity(admin.name, `Created service group "${name}"`, 'service');
      return Response.json({ success: true, group });
    }

    if (action === 'update-group') {
      const { groupId, ...updates } = body;
      if (!groupId) return Response.json({ error: 'Group ID required' }, { status: 400 });

      const data = {};
      if (updates.name !== undefined) data.name = updates.name.trim();
      if (updates.platform !== undefined) data.platform = updates.platform.trim();
      if (updates.type !== undefined) data.type = updates.type;
      if (updates.nigerian !== undefined) data.nigerian = !!updates.nigerian;
      if (updates.enabled !== undefined) data.enabled = !!updates.enabled;
      if (updates.sortOrder !== undefined) data.sortOrder = Number(updates.sortOrder);

      const group = await prisma.serviceGroup.update({ where: { id: groupId }, data });
      await logActivity(admin.name, `Updated service group "${group.name}"`, 'service');
      return Response.json({ success: true, group });
    }

    if (action === 'delete-group') {
      const { groupId } = body;
      if (!groupId) return Response.json({ error: 'Group ID required' }, { status: 400 });

      const group = await prisma.serviceGroup.findUnique({ where: { id: groupId } });
      if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

      await prisma.serviceGroup.delete({ where: { id: groupId } }); // cascade deletes tiers
      await logActivity(admin.name, `Deleted service group "${group.name}"`, 'service');
      return Response.json({ success: true });
    }

    // ── Tier actions ──
    if (action === 'add-tier') {
      const { groupId, serviceId, tier, sellPer1k, refill, speed } = body;
      if (!groupId || !serviceId) return Response.json({ error: 'Group ID and service ID required' }, { status: 400 });

      const group = await prisma.serviceGroup.findUnique({ where: { id: groupId } });
      if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) return Response.json({ error: 'Service not found' }, { status: 404 });

      // Auto-calculate sell price from markup if not provided
      let finalSellPer1k = Number(sellPer1k);
      if (!finalSellPer1k || finalSellPer1k <= 0) {
        const { calculateTierPrice } = await import('@/lib/markup');
        // Load markup settings from DB
        const markupSettings = {};
        const settings = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
        settings.forEach(s => { markupSettings[s.key] = s.value; });
        finalSellPer1k = calculateTierPrice(service.costPer1k, tier || 'Standard', markupSettings);
      }

      const maxSort = await prisma.serviceTier.aggregate({ where: { groupId }, _max: { sortOrder: true } });
      const newTier = await prisma.serviceTier.create({
        data: {
          groupId,
          serviceId,
          tier: tier || 'Standard',
          sellPer1k: finalSellPer1k,
          refill: !!refill,
          speed: speed || service.avgTime || '0-2 hrs',
          sortOrder: (maxSort._max.sortOrder || 0) + 1,
        },
      });
      await logActivity(admin.name, `Added ${tier || 'Standard'} tier to "${group.name}"`, 'service');
      return Response.json({ success: true, tier: newTier });
    }

    if (action === 'update-tier') {
      const { tierIdToUpdate, ...updates } = body;
      if (!tierIdToUpdate) return Response.json({ error: 'Tier ID required' }, { status: 400 });

      const data = {};
      if (updates.tier !== undefined) data.tier = updates.tier;
      if (updates.sellPer1k !== undefined) data.sellPer1k = Number(updates.sellPer1k);
      if (updates.refill !== undefined) data.refill = !!updates.refill;
      if (updates.speed !== undefined) data.speed = updates.speed;
      if (updates.enabled !== undefined) data.enabled = !!updates.enabled;
      if (updates.sortOrder !== undefined) data.sortOrder = Number(updates.sortOrder);
      if (updates.serviceId !== undefined) data.serviceId = updates.serviceId || null;

      const updated = await prisma.serviceTier.update({ where: { id: tierIdToUpdate }, data });
      await logActivity(admin.name, `Updated tier ${updated.tier}`, 'service');
      return Response.json({ success: true, tier: updated });
    }

    if (action === 'delete-tier') {
      const { tierIdToDelete } = body;
      if (!tierIdToDelete) return Response.json({ error: 'Tier ID required' }, { status: 400 });

      const existing = await prisma.serviceTier.findUnique({ where: { id: tierIdToDelete }, include: { group: true } });
      if (!existing) return Response.json({ error: 'Tier not found' }, { status: 404 });

      await prisma.serviceTier.delete({ where: { id: tierIdToDelete } });
      await logActivity(admin.name, `Deleted ${existing.tier} tier from "${existing.group.name}"`, 'service');
      return Response.json({ success: true });
    }

    if (action === 'recalculate-prices') {
      const { calculateTierPrice } = await import('@/lib/markup');
      // Load markup settings from DB
      const markupRows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
      const ms = {};
      markupRows.forEach(s => { ms[s.key] = s.value; });

      // Get all tiers with their linked service AND group (to check nigerian flag)
      const allTiers = await prisma.serviceTier.findMany({
        include: {
          service: { select: { costPer1k: true } },
          group: { select: { nigerian: true } },
        },
      });

      let updated = 0;
      let skipped = 0;
      const ops = [];

      const INT4_MAX = 2147483647;
      for (const t of allTiers) {
        if (!t.service || !t.service.costPer1k || t.service.costPer1k <= 0) {
          skipped++;
          continue;
        }
        const isNigerian = !!t.group?.nigerian;
        const newSell = Math.min(calculateTierPrice(t.service.costPer1k, t.tier, ms, isNigerian), INT4_MAX);
        if (newSell > 0 && newSell !== t.sellPer1k) {
          ops.push(prisma.serviceTier.update({ where: { id: t.id }, data: { sellPer1k: newSell } }));
          updated++;
        }
      }

      if (ops.length > 0) {
        // Process in chunks of 50 to avoid transaction limits
        for (let i = 0; i < ops.length; i += 50) {
          await prisma.$transaction(ops.slice(i, i + 50));
        }
      }
      await logActivity(admin.name, `Recalculated prices: ${updated} updated, ${skipped} skipped (no cost)`, 'service');
      return Response.json({ success: true, updated, skipped, total: allTiers.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin ServiceGroups POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
