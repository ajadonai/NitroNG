import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin, canPerformAction, logActivity } from '@/lib/admin';
import { randomBytes } from 'crypto';

// How far back the activity figures on each reseller look. Only ever computed
// for people who already have a profile, so it stays a handful of rows.
const WINDOW_DAYS = 90;
const SEARCH_LIMIT = 15;

const naira = (kobo) => Math.round(Number(kobo || 0) / 100);

// Recent behaviour per reseller. A collapsed order count is how you notice
// someone who stopped reselling and is still taking the discount.
async function activityFor(userIds) {
  if (!userIds.length) return {};
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const rows = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, createdAt: { gte: since }, deletedAt: null, status: { not: 'Cancelled' } },
    _count: true,
    _sum: { charge: true },
  });
  const api = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, createdAt: { gte: since }, deletedAt: null, status: { not: 'Cancelled' }, source: 'api' },
    _count: true,
  }).catch(() => []);
  const apiBy = Object.fromEntries(api.map(r => [r.userId, r._count]));
  return Object.fromEntries(rows.map(r => [r.userId, { orders: r._count, spend: naira(r._sum.charge), apiOrders: apiBy[r.userId] || 0 }]));
}

export async function GET(req) {
  const { error } = await requireAdmin('resellers');
  if (error) return error;

  try {
    const q = req.nextUrl.searchParams.get('q')?.trim() || '';

    const profiles = await prisma.resellerProfile.findMany({
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const activity = await activityFor(profiles.map(p => p.userId));

    // Search is only offered when asked for, so opening the tab costs one query.
    let results = [];
    if (q) {
      const existing = new Set(profiles.map(p => p.userId));
      const found = await prisma.user.findMany({
        where: {
          status: 'Active',
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: SEARCH_LIMIT,
      });
      const act = await activityFor(found.map(u => u.id));
      results = found.map(u => ({
        userId: u.id,
        name: u.name || '',
        email: u.email || '',
        joined: u.createdAt,
        alreadyReseller: existing.has(u.id),
        orders: act[u.id]?.orders || 0,
        spend: act[u.id]?.spend || 0,
      }));
    }

    // What the programme adds up to. Only measurable against the same window the
    // per-reseller figures use, so the totals and the rows always agree.
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
    const activeIds = profiles.filter(p => p.enabled).map(p => p.userId);
    const [everyone, resellerSide] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: since }, deletedAt: null, status: { not: 'Cancelled' } },
        _count: true, _sum: { charge: true },
      }),
      activeIds.length
        ? prisma.order.aggregate({
          where: { userId: { in: activeIds }, createdAt: { gte: since }, deletedAt: null, status: { not: 'Cancelled' } },
          _count: true, _sum: { charge: true },
        })
        : { _count: 0, _sum: { charge: 0 } },
    ]);
    const allRevenue = naira(everyone._sum.charge);
    const resellerRevenue = naira(resellerSide._sum.charge);

    const rateSetting = await prisma.setting.findUnique({ where: { key: 'markup_reseller_discount' } });

    return Response.json({
      windowDays: WINDOW_DAYS,
      query: q,
      globalDiscount: Number(rateSetting?.value) || 20,
      summary: {
        active: activeIds.length,
        revoked: profiles.length - activeIds.length,
        onFullCatalogue: profiles.filter(p => p.enabled && p.catalog === 'full').length,
        orders: resellerSide._count,
        revenue: resellerRevenue,
        // Their share of the business, which is the number that says whether the
        // programme is worth the margin it gives up.
        revenueShare: allRevenue ? Math.round((resellerRevenue / allRevenue) * 100) : 0,
        avgOrder: resellerSide._count ? Math.round(resellerRevenue / resellerSide._count) : 0,
        avgOrderEveryone: everyone._count ? Math.round(allRevenue / everyone._count) : 0,
      },
      results,
      resellers: profiles.map(p => ({
        id: p.id,
        userId: p.userId,
        name: p.user?.name || '',
        email: p.user?.email || '',
        userStatus: p.user?.status || '',
        catalog: p.catalog,
        enabled: p.enabled,
        discountPct: p.discountPct,
        approvedBy: p.approvedBy,
        approvedAt: p.approvedAt,
        notes: p.notes,
        createdAt: p.createdAt,
        recentOrders: activity[p.userId]?.orders || 0,
        recentSpend: activity[p.userId]?.spend || 0,
        apiOrders: activity[p.userId]?.apiOrders || 0,
      })),
    });
  } catch (err) {
    log.error('AdminResellers', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

const CATALOGS = ['curated', 'full'];

export async function POST(req) {
  const { admin, error } = await requireAdmin('resellers', true);
  if (error) return error;
  if (!canPerformAction(admin, 'reseller.approve')) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { action, userId, catalog, notes, discountPct } = body || {};
  if (!userId || typeof userId !== 'string') {
    return Response.json({ error: 'userId required' }, { status: 400 });
  }
  if (catalog !== undefined && !CATALOGS.includes(catalog)) {
    return Response.json({ error: 'catalog must be curated or full' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, status: true } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
    if (action === 'approve' && user.status !== 'Active') {
      return Response.json({ error: `Account is ${user.status} — reactivate it first` }, { status: 400 });
    }
    const who = user.name || user.email || userId;

    if (action === 'approve') {
      const profile = await prisma.resellerProfile.upsert({
        where: { userId },
        create: {
          userId,
          apiKey: randomBytes(24).toString('hex'),
          catalog: catalog || 'curated',
          enabled: true,
          approvedBy: admin.name,
          approvedAt: new Date(),
          notes: notes || null,
        },
        // Re-approving someone previously revoked keeps their key, so an
        // integration that was already built does not have to be rewired.
        update: {
          enabled: true,
          ...(catalog ? { catalog } : {}),
          approvedBy: admin.name,
          approvedAt: new Date(),
          ...(notes !== undefined ? { notes: notes || null } : {}),
        },
      });
      await logActivity(admin.name, `Approved reseller ${who} (${profile.catalog} catalogue)`);
      return Response.json({ success: true, profile: { catalog: profile.catalog, enabled: profile.enabled } });
    }

    if (action === 'revoke') {
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      // Disabled, never deleted: the audit trail and their key both survive, and
      // pricing reverts to retail on their next order.
      await prisma.resellerProfile.update({ where: { userId }, data: { enabled: false } });
      await logActivity(admin.name, `Revoked reseller ${who}`);
      return Response.json({ success: true });
    }

    if (action === 'rate') {
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      // Blank clears the override and returns them to the global rate. A rate can
      // legitimately be worse than global — a probationary reseller on 10% is as
      // useful as a high performer on 35%.
      const blank = discountPct === null || discountPct === undefined || String(discountPct).trim() === '';
      const n = blank ? null : Number(discountPct);
      if (!blank && (!Number.isFinite(n) || n < 0 || n >= 100)) {
        return Response.json({ error: 'Rate must be between 0 and 99' }, { status: 400 });
      }
      await prisma.resellerProfile.update({ where: { userId }, data: { discountPct: blank ? null : Math.round(n) } });
      await logActivity(admin.name, blank
        ? `Reset reseller ${who} to the global wholesale rate`
        : `Set reseller ${who} wholesale rate to ${Math.round(n)}%`);
      return Response.json({ success: true });
    }

    if (action === 'notes') {
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      await prisma.resellerProfile.update({ where: { userId }, data: { notes: notes || null } });
      await logActivity(admin.name, `Updated note on reseller ${who}`);
      return Response.json({ success: true });
    }

    if (action === 'catalog') {
      if (!catalog) return Response.json({ error: 'catalog required' }, { status: 400 });
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      await prisma.resellerProfile.update({ where: { userId }, data: { catalog } });
      await logActivity(admin.name, `Set reseller ${who} to ${catalog} catalogue`);
      return Response.json({ success: true, catalog });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('AdminResellers', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
