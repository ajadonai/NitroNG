import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin, canPerformAction, logActivity } from '@/lib/admin';
import { sendPromotionBlast } from '@/lib/email';

export async function GET() {
  const { admin, error } = await requireAdmin('promotions');
  if (error) return error;

  try {
    const [seasonal, recurring] = await Promise.all([
      prisma.platformCampaign.findMany({
        orderBy: { startAt: 'desc' },
        include: { createdBy: { select: { name: true } } },
      }),
      prisma.recurringCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        include: { createdBy: { select: { name: true } } },
      }),
    ]);

    // Get order stats per promotion
    const [platformStats, recurringStats] = await Promise.all([
      prisma.order.groupBy({
        by: ['platformCampaignId'],
        where: { platformCampaignId: { not: null } },
        _count: true,
        _sum: { campaignDiscount: true },
      }),
      prisma.order.groupBy({
        by: ['recurringCampaignId'],
        where: { recurringCampaignId: { not: null } },
        _count: true,
        _sum: { campaignDiscount: true },
      }),
    ]);

    const pStatsMap = Object.fromEntries(platformStats.map(s => [s.platformCampaignId, { orders: s._count, totalDiscount: s._sum.campaignDiscount || 0 }]));
    const rStatsMap = Object.fromEntries(recurringStats.map(s => [s.recurringCampaignId, { orders: s._count, totalDiscount: s._sum.campaignDiscount || 0 }]));

    return Response.json({
      seasonal: seasonal.map(c => ({
        ...c,
        createdByName: c.createdBy?.name,
        stats: pStatsMap[c.id] || { orders: 0, totalDiscount: 0 },
      })),
      recurring: recurring.map(c => ({
        ...c,
        createdByName: c.createdBy?.name,
        stats: rStatsMap[c.id] || { orders: 0, totalDiscount: 0 },
      })),
      canManage: canPerformAction(admin, 'promotions.manage'),
    });
  } catch (err) {
    log.error('Admin Promotions GET', err.message);
    return Response.json({ error: 'Failed to load promotions' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('promotions', true);
  if (error) return error;

  if (!canPerformAction(admin, 'promotions.manage')) {
    return Response.json({ error: 'You don\'t have permission to manage promotions' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, promotionType } = body;

    // ── CREATE ──
    if (action === 'create') {
      if (promotionType === 'recurring') {
        const { name, description, dayOfWeek, startTimeLocal, endTimeLocal, discountPercent, maxDiscountPerOrder, bannerCopy, bannerColor, effectiveFrom, effectiveUntil } = body;
        if (!name?.trim() || !bannerCopy?.trim()) {
          return Response.json({ error: 'Name and banner copy are required' }, { status: 400 });
        }
        if (!dayOfWeek || !['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].includes(dayOfWeek)) {
          return Response.json({ error: 'Valid day of week required' }, { status: 400 });
        }
        if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
          return Response.json({ error: 'Discount must be between 1-100%' }, { status: 400 });
        }
        if (bannerColor && !/^#[0-9A-Fa-f]{6}$/.test(bannerColor)) {
          return Response.json({ error: 'Banner color must be a hex code like #FF6699' }, { status: 400 });
        }
        const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (startTimeLocal && !timeRe.test(startTimeLocal)) return Response.json({ error: 'Invalid start time format (HH:MM)' }, { status: 400 });
        if (endTimeLocal && !timeRe.test(endTimeLocal)) return Response.json({ error: 'Invalid end time format (HH:MM)' }, { status: 400 });

        const created = await prisma.recurringCampaign.create({
          data: {
            name: name.trim(),
            description: description?.trim() || null,
            dayOfWeek,
            startTimeLocal: startTimeLocal || '00:00',
            endTimeLocal: endTimeLocal || '23:59',
            discountPercent,
            maxDiscountPerOrder: maxDiscountPerOrder || null,
            bannerCopy: bannerCopy.trim(),
            bannerColor: bannerColor || null,
            lineItemLabel: `${name.trim()} (-${discountPercent}%)`,
            effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
            effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
            active: false,
            createdById: admin.id,
          },
        });
        await logActivity(admin.name, `Created recurring promotion: ${name.trim()}`, 'promotion');
        return Response.json({ success: true, promotion: created });
      }

      // Platform (seasonal) promotion
      const { name, description, discountPercent, startAt, endAt, priority, maxDiscountPerOrder, bannerCopy, bannerColor, bannerCtaText, emailTheme } = body;
      if (!name?.trim() || !bannerCopy?.trim()) {
        return Response.json({ error: 'Name and banner copy are required' }, { status: 400 });
      }
      if (!startAt || !endAt) return Response.json({ error: 'Start and end dates required' }, { status: 400 });
      if (new Date(endAt) < new Date(startAt)) return Response.json({ error: 'End date must be after start date' }, { status: 400 });
      if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
        return Response.json({ error: 'Discount must be between 1-100%' }, { status: 400 });
      }
      if (bannerColor && !/^#[0-9A-Fa-f]{6}$/.test(bannerColor)) {
        return Response.json({ error: 'Banner color must be a hex code like #FF6699' }, { status: 400 });
      }

      const created = await prisma.platformCampaign.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          discountPercent,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          priority: priority || 10,
          maxDiscountPerOrder: maxDiscountPerOrder || null,
          bannerCopy: bannerCopy.trim(),
          bannerColor: bannerColor || null,
          bannerCtaText: bannerCtaText?.trim() || null,
          emailTheme: emailTheme || null,
          lineItemLabel: `${name.trim()} (-${discountPercent}%)`,
          status: 'DRAFT',
          createdById: admin.id,
        },
      });
      await logActivity(admin.name, `Created seasonal promotion: ${name.trim()}`, 'promotion');
      return Response.json({ success: true, promotion: created });
    }

    // ── UPDATE ──
    if (action === 'update') {
      const { id, promotionType: ct, ...fields } = body;
      if (!id) return Response.json({ error: 'Promotion ID required' }, { status: 400 });

      const platformFields = ['name', 'description', 'discountPercent', 'startAt', 'endAt', 'priority', 'maxDiscountPerOrder', 'bannerCopy', 'bannerColor', 'bannerCtaText', 'emailTheme'];
      const recurringFields = ['name', 'description', 'discountPercent', 'maxDiscountPerOrder', 'bannerCopy', 'bannerColor', 'dayOfWeek', 'startTimeLocal', 'endTimeLocal', 'effectiveFrom', 'effectiveUntil'];
      const allowed = ct === 'recurring' ? recurringFields : platformFields;
      const data = { updatedBy: { connect: { id: admin.id } } };
      for (const key of allowed) {
        if (fields[key] !== undefined) {
          if (['startAt', 'endAt', 'effectiveFrom', 'effectiveUntil'].includes(key)) {
            data[key] = fields[key] ? new Date(fields[key]) : null;
          } else {
            data[key] = fields[key];
          }
        }
      }
      if (data.name || data.discountPercent) {
        const existing = ct === 'recurring'
          ? await prisma.recurringCampaign.findUnique({ where: { id } })
          : await prisma.platformCampaign.findUnique({ where: { id } });
        const finalName = data.name || existing.name;
        const finalDiscount = data.discountPercent || existing.discountPercent;
        data.lineItemLabel = `${finalName} (-${finalDiscount}%)`;
      }

      if (ct === 'recurring') {
        await prisma.recurringCampaign.update({ where: { id }, data });
        await logActivity(admin.name, `Updated recurring promotion ${id}`, 'promotion');
      } else {
        await prisma.platformCampaign.update({ where: { id }, data });
        await logActivity(admin.name, `Updated seasonal promotion ${id}`, 'promotion');
      }
      return Response.json({ success: true });
    }

    // ── ACTIVATE ──
    if (action === 'activate') {
      const { id, promotionType: ct } = body;
      if (!id) return Response.json({ error: 'Promotion ID required' }, { status: 400 });

      if (ct === 'recurring') {
        await prisma.recurringCampaign.update({ where: { id }, data: { active: true, updatedBy: { connect: { id: admin.id } } } });
        await logActivity(admin.name, `Activated recurring promotion ${id}`, 'promotion');
      } else {
        const promo = await prisma.platformCampaign.findUnique({ where: { id } });
        if (!promo) return Response.json({ error: 'Promotion not found' }, { status: 404 });
        if (promo.status === 'ENDED' && new Date(promo.endAt) < new Date()) {
          return Response.json({ error: 'Update the dates first — this promotion has expired' }, { status: 400 });
        }
        const reactivating = promo.status === 'ENDED';
        const startsInFuture = new Date(promo.startAt) > new Date();
        if (reactivating) {
          // Reset emailedAt so email fires when promo actually starts
          await prisma.platformCampaign.update({ where: { id }, data: { emailedAt: null, updatedBy: { connect: { id: admin.id } } } });
        }
        if (startsInFuture) {
          await prisma.platformCampaign.update({ where: { id }, data: { status: 'SCHEDULED', updatedBy: { connect: { id: admin.id } } } });
          await logActivity(admin.name, `Scheduled seasonal promotion: ${promo.name}`, 'promotion');
        } else {
          const shouldEmail = !promo.emailedAt || reactivating;
          const updateData = { status: 'ACTIVE', updatedBy: { connect: { id: admin.id } } };
          if (shouldEmail) updateData.emailedAt = new Date();
          await prisma.platformCampaign.update({ where: { id }, data: updateData });
          await logActivity(admin.name, `${reactivating ? 'Reactivated' : 'Activated'} seasonal promotion: ${promo.name}`, 'promotion');
          if (shouldEmail) sendPromotionBlast(promo).catch(() => {});
        }
      }
      return Response.json({ success: true });
    }

    // ── PAUSE ──
    if (action === 'pause') {
      const { id, promotionType: ct } = body;
      if (!id) return Response.json({ error: 'Promotion ID required' }, { status: 400 });

      if (ct === 'recurring') {
        await prisma.recurringCampaign.update({ where: { id }, data: { active: false, updatedBy: { connect: { id: admin.id } } } });
        await logActivity(admin.name, `Paused recurring promotion ${id}`, 'promotion');
      } else {
        await prisma.platformCampaign.update({ where: { id }, data: { status: 'PAUSED', updatedBy: { connect: { id: admin.id } } } });
        await logActivity(admin.name, `Paused seasonal promotion ${id}`, 'promotion');
      }
      return Response.json({ success: true });
    }

    // ── SCHEDULE ──
    if (action === 'schedule') {
      const { id } = body;
      if (!id) return Response.json({ error: 'Promotion ID required' }, { status: 400 });
      const promo = await prisma.platformCampaign.findUnique({ where: { id } });
      if (!promo) return Response.json({ error: 'Promotion not found' }, { status: 404 });
      if (promo.status !== 'DRAFT') return Response.json({ error: 'Only draft promotions can be scheduled' }, { status: 400 });
      await prisma.platformCampaign.update({ where: { id }, data: { status: 'SCHEDULED', updatedBy: { connect: { id: admin.id } } } });
      await logActivity(admin.name, `Scheduled seasonal promotion: ${promo.name}`, 'promotion');
      return Response.json({ success: true });
    }

    // ── DELETE ──
    if (action === 'delete') {
      const { id, promotionType: ct } = body;
      if (!id) return Response.json({ error: 'Promotion ID required' }, { status: 400 });

      if (ct === 'recurring') {
        const has = await prisma.order.count({ where: { recurringCampaignId: id }, take: 1 });
        if (has) {
          await prisma.recurringCampaign.update({ where: { id }, data: { active: false } });
          await logActivity(admin.name, `Deactivated recurring promotion ${id} (has linked orders)`, 'promotion');
          return Response.json({ success: true, soft: true });
        }
        await prisma.recurringCampaign.delete({ where: { id } });
        await logActivity(admin.name, `Deleted recurring promotion ${id}`, 'promotion');
      } else {
        const has = await prisma.order.count({ where: { platformCampaignId: id }, take: 1 });
        if (has) {
          await prisma.platformCampaign.update({ where: { id }, data: { status: 'ENDED' } });
          await logActivity(admin.name, `Ended seasonal promotion ${id} (has linked orders)`, 'promotion');
          return Response.json({ success: true, soft: true });
        }
        await prisma.platformCampaign.delete({ where: { id } });
        await logActivity(admin.name, `Deleted seasonal promotion ${id}`, 'promotion');
      }
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Promotions POST', err.message, err.stack);
    return Response.json({ error: process.env.NODE_ENV === 'production' ? 'Action failed' : `Action failed: ${err.message}` }, { status: 500 });
  }
}
