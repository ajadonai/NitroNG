import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canSeeSensitive } from '@/lib/admin';
import { invalidateServiceCatalogue } from '@/lib/service-catalog';
import { DEAD_ORDER_STATES } from '@/lib/ledger';
import { closeStrandedGroups } from '@/lib/group-integrity';
import { PROVIDER_IDS } from '@/lib/smm';
import { reportOperationalFailure } from '@/lib/monitoring';

/**
 * Row count at which this response is close enough to Vercel's 4.5 MB cap to
 * shout about it.
 *
 * Measured 13 Oct 2026: 12,268 live services serialise to 4.01 MB, about 343
 * bytes a row, so the cap lands near 13,750 rows. Warning at 13,000 leaves
 * roughly 700 rows of notice.
 *
 * This exists because of how the failure presents. Going over the cap does not
 * raise an error anyone sees — the tail of the list is simply not there, so a
 * service that is present, enabled and listed by its provider cannot be found
 * in Raw Services, Menu Builder or search, and the only symptom is a person
 * saying "we keep searching but it doesn't appear". That is a bad week of
 * debugging. An alert is worth the four lines.
 *
 * When this does fire, dropping another retired provider will not save it
 * twice. The fix at that point is server-side search and pagination here and in
 * the Menu Builder picker.
 */
const SERVICE_PAYLOAD_WARN_ROWS = 13_000;

export async function GET() {
  const { admin, error } = await requireAdmin('services');
  if (error) return error;

  try {
    const [services, usdSetting] = await Promise.all([
      prisma.service.findMany({
        // Live providers only, read from the register rather than named here.
        //
        // This route had no filter and no limit, so it serialised every row we
        // have ever seen — 18,291 of them, 6.11 MB, against Vercel's 4.5 MB
        // response cap. Everything past roughly row 13,500 never reached the
        // page, which is why a service could be present, correct and listed by
        // its provider and still be unfindable in Raw Services, Menu Builder and
        // search all at once. DaoSMM 660 sat 70 KB the wrong side of that line.
        //
        // The 6,023 retired `jap` rows were a third of the payload. They stay in
        // the table — 22 historical orders point at them and they are the
        // receipts — they just stop being shipped to a picker that could never
        // order them anyway.
        where: { provider: { in: PROVIDER_IDS } },
        orderBy: { category: 'asc' },
        include: {
          _count: { select: { orders: { where: { status: { notIn: DEAD_ORDER_STATES }, deletedAt: null } }, tiers: { where: { enabled: true } } } },
        },
      }),
      prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } }),
    ]);

    const usdRate = Number(usdSetting?.value || 1600);
    const sensitive = canSeeSensitive(admin);

    if (services.length >= SERVICE_PAYLOAD_WARN_ROWS) {
      reportOperationalFailure('admin_services_payload_near_cap', {
        level: 'warning',
        data: { rows: services.length, warnAt: SERVICE_PAYLOAD_WARN_ROWS },
        dedupeKey: 'admin_services_payload_near_cap',
      });
    }

    return Response.json({
      services: services.map(s => ({
        id: s.id,
        apiId: s.apiId,
        name: s.name,
        category: s.category,
        ...(sensitive ? { costPer1k: Math.round(Number(s.costPer1k) * usdRate) / 100 } : {}),
        sellPer1k: Number(s.sellPer1k) / 100,
        markup: s.markup,
        min: s.min,
        max: s.max,
        refill: s.refill,
        avgTime: s.avgTime,
        enabled: s.enabled,
        blacklisted: s.blacklisted,
        ...(sensitive ? { provider: s.provider || 'mtp' } : {}),
        tags: s.tags || [],
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
      invalidateServiceCatalogue();
      return Response.json({ success: true, enabled: result.count, total: ids.length, message: `Enabled ${result.count} services (${ids.length} total in use)` });
    }

    if (action === 'bulk-tag') {
      const { serviceIds, tag, remove } = body;
      if (!tag || typeof tag !== 'string') return Response.json({ error: 'Tag required' }, { status: 400 });
      if (!Array.isArray(serviceIds) || serviceIds.length === 0) return Response.json({ error: 'Service IDs required' }, { status: 400 });
      const cleanTag = tag.trim().toLowerCase();
      const services = await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, tags: true } });
      let updated = 0;
      for (const s of services) {
        const has = (s.tags || []).includes(cleanTag);
        if (remove && has) {
          await prisma.service.update({ where: { id: s.id }, data: { tags: (s.tags || []).filter(t => t !== cleanTag) } });
          updated++;
        } else if (!remove && !has) {
          await prisma.service.update({ where: { id: s.id }, data: { tags: [...(s.tags || []), cleanTag] } });
          updated++;
        }
      }
      await logActivity(admin.name, `${remove ? 'Removed' : 'Added'} tag "${cleanTag}" on ${updated} service(s)`, 'service');
      return Response.json({ success: true, updated, message: `${remove ? 'Removed' : 'Added'} "${cleanTag}" on ${updated} service(s)` });
    }

    if (!serviceId) return Response.json({ error: 'Service ID required' }, { status: 400 });

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return Response.json({ error: 'Service not found' }, { status: 404 });

    if (action === 'toggle') {
      const newEnabled = !service.enabled;
      // If disabling, check for active tiers
      if (!newEnabled) {
        // The groups these tiers belong to, read BEFORE the cascade — after it
        // the tiers are off and there is no way back to their groups.
        const affected = await prisma.serviceTier.findMany({ where: { serviceId, enabled: true }, select: { groupId: true } });
        const activeTiers = affected.length;
        if (activeTiers > 0) {
          // Disable the tiers too
          await prisma.serviceTier.updateMany({ where: { serviceId, enabled: true }, data: { enabled: false } });
          await prisma.service.update({ where: { id: serviceId }, data: { enabled: false } });
          // And any group the cascade just emptied. This is how X/Twitter
          // Followers 🇺🇸 became a card with nothing to order in it.
          const closed = await closeStrandedGroups(prisma, affected.map(t => t.groupId));
          await logActivity(admin.name, `Disabled service + ${activeTiers} tier(s): ${service.name}${closed.length ? ` — and ${closed.length} now-empty group(s): ${closed.join(', ')}` : ''}`, 'service');
          invalidateServiceCatalogue();
          return Response.json({ success: true, enabled: false, cascaded: activeTiers, message: `Disabled service and ${activeTiers} tier(s) in Menu Builder` });
        }
      }
      await prisma.service.update({ where: { id: serviceId }, data: { enabled: newEnabled } });
      await logActivity(admin.name, `${service.enabled ? 'Disabled' : 'Enabled'} service: ${service.name}`, 'service');
      invalidateServiceCatalogue();
      return Response.json({ success: true, enabled: newEnabled });
    }

    if (action === 'blacklist') {
      const newBlacklisted = !service.blacklisted;
      await prisma.service.update({ where: { id: serviceId }, data: { blacklisted: newBlacklisted } });
      await logActivity(admin.name, `${newBlacklisted ? 'Blacklisted' : 'Restored'} service ${newBlacklisted ? 'from' : 'to'} the full list: ${service.name}`, 'service');
      return Response.json({ success: true, blacklisted: newBlacklisted });
    }


    if (action === 'markup') {
      const m = Math.max(0, Math.min(999, Number(body.markup)));
      const newSell = Math.round(Number(service.costPer1k) * (1 + m / 100));
      await prisma.service.update({ where: { id: serviceId }, data: { markup: m, sellPer1k: newSell } });
      await logActivity(admin.name, `Updated markup for ${service.name} to ${m}%`, 'service');
      invalidateServiceCatalogue();
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
      if (Array.isArray(body.tags)) data.tags = body.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);

      if (Object.keys(data).length === 0) return Response.json({ error: 'No changes provided' }, { status: 400 });

      const updated = await prisma.service.update({ where: { id: serviceId }, data });
      await logActivity(admin.name, `Edited service: ${updated.name}`, 'service');
      invalidateServiceCatalogue();
      return Response.json({ success: true, service: { id: updated.id, name: updated.name, category: updated.category, min: updated.min, max: updated.max, enabled: updated.enabled, refill: updated.refill, avgTime: updated.avgTime, tags: updated.tags || [] } });
    }

    if (action === 'delete') {
      // Check if any tiers reference this service
      const tierCount = await prisma.serviceTier.count({ where: { serviceId } });
      if (tierCount > 0) {
        return Response.json({ error: `Cannot delete — ${tierCount} tier(s) still reference this service. Remove them from Menu Builder first.` }, { status: 400 });
      }
      await prisma.service.update({ where: { id: serviceId }, data: { enabled: false } });
      await logActivity(admin.name, `Disabled service: ${service.name}`, 'service');
      invalidateServiceCatalogue();
      return Response.json({ success: true, disabled: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Services POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
