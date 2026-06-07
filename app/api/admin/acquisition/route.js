import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin, canPerformAction, logActivity } from '@/lib/admin';

export async function GET(req) {
  const { admin, error } = await requireAdmin('acquisition');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const links = await prisma.acquisitionLink.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const slugs = links.map(l => l.slug);
    const linkIds = links.map(l => l.id);
    const [signupStats, orderStats, clickStats, uniqueClickStats] = await Promise.all([
      prisma.user.groupBy({
        by: ['signupSource'],
        where: { signupSource: { in: slugs }, deletedAt: null },
        _count: true,
      }),
      prisma.$queryRaw`
        SELECT u."signupSource" AS slug, COUNT(o.id)::int AS orders, COALESCE(SUM(o.charge),0)::int AS revenue
        FROM orders o JOIN users u ON o."userId" = u.id
        WHERE u."signupSource" = ANY(${slugs}) AND u."deletedAt" IS NULL AND o."deletedAt" IS NULL AND o.status = 'Completed'
        GROUP BY u."signupSource"
      `,
      prisma.linkClick.groupBy({ by: ['linkId'], where: { linkId: { in: linkIds } }, _count: true }),
      prisma.$queryRaw`SELECT "linkId", COUNT(DISTINCT "ipHash")::int AS cnt FROM link_clicks WHERE "linkId" = ANY(${linkIds}) GROUP BY "linkId"`,
    ]);

    const signupMap = Object.fromEntries(signupStats.map(s => [s.signupSource, s._count]));
    const orderMap = Object.fromEntries(orderStats.map(s => [s.slug, { orders: s.orders, revenue: s.revenue }]));
    const clickMap = Object.fromEntries(clickStats.map(c => [c.linkId, c._count]));
    const uniqueMap = Object.fromEntries(uniqueClickStats.map(c => [c.linkId, c.cnt]));

    const archivedCount = includeArchived ? 0 : await prisma.acquisitionLink.count({ where: { archivedAt: { not: null } } });

    return Response.json({
      links: links.map(l => ({
        ...l,
        clicks: clickMap[l.id] || 0,
        uniqueClicks: uniqueMap[l.id] || 0,
        signups: signupMap[l.slug] || 0,
        orders: orderMap[l.slug]?.orders || 0,
        revenue: orderMap[l.slug]?.revenue || 0,
      })),
      canManage: canPerformAction(admin, 'acquisition.manage'),
      archivedCount,
    });
  } catch (err) {
    log.error('Admin Acquisition GET', err.message);
    return Response.json({ error: 'Failed to load tracking links' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('acquisition', true);
  if (error) return error;

  if (!canPerformAction(admin, 'acquisition.manage')) {
    return Response.json({ error: 'No permission' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const { name, slug } = body;
      if (!name?.trim() || !slug?.trim()) {
        return Response.json({ error: 'Name and slug are required' }, { status: 400 });
      }
      const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (!clean || clean.length < 2) {
        return Response.json({ error: 'Slug must be at least 2 characters (letters, numbers, hyphens)' }, { status: 400 });
      }
      const exists = await prisma.acquisitionLink.findUnique({ where: { slug: clean } });
      if (exists) return Response.json({ error: 'This slug is already taken' }, { status: 409 });

      const link = await prisma.acquisitionLink.create({
        data: { name: name.trim(), slug: clean },
      });
      await logActivity(admin.name, `Created tracking link: ${clean}`, 'acquisition');
      return Response.json({ success: true, link });
    }

    if (action === 'toggle') {
      const { id, enabled } = body;
      if (!id) return Response.json({ error: 'Link ID required' }, { status: 400 });
      const toggled = await prisma.acquisitionLink.update({ where: { id }, data: { enabled: !!enabled } });
      await logActivity(admin.name, `${enabled ? 'Enabled' : 'Disabled'} tracking link: ${toggled.name}`, 'acquisition');
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return Response.json({ error: 'Link ID required' }, { status: 400 });
      const link = await prisma.acquisitionLink.findUnique({ where: { id } });
      if (!link) return Response.json({ error: 'Not found' }, { status: 404 });
      const hasUsers = await prisma.user.count({ where: { signupSource: link.slug }, take: 1 });
      if (hasUsers) {
        await prisma.acquisitionLink.update({ where: { id }, data: { enabled: false } });
        await logActivity(admin.name, `Disabled tracking link ${link.slug} (has signups)`, 'acquisition');
        return Response.json({ success: true, soft: true });
      }
      await prisma.acquisitionLink.delete({ where: { id } });
      await logActivity(admin.name, `Deleted tracking link ${link.slug}`, 'acquisition');
      return Response.json({ success: true });
    }

    if (action === 'archive') {
      const { id } = body;
      if (!id) return Response.json({ error: 'Link ID required' }, { status: 400 });
      const link = await prisma.acquisitionLink.findUnique({ where: { id } });
      if (!link) return Response.json({ error: 'Not found' }, { status: 404 });
      await prisma.acquisitionLink.update({ where: { id }, data: { archivedAt: new Date(), enabled: false } });
      await logActivity(admin.name, `Archived tracking link: ${link.slug}`, 'acquisition');
      return Response.json({ success: true });
    }

    if (action === 'unarchive') {
      const { id } = body;
      if (!id) return Response.json({ error: 'Link ID required' }, { status: 400 });
      const link = await prisma.acquisitionLink.findUnique({ where: { id } });
      if (!link) return Response.json({ error: 'Not found' }, { status: 404 });
      await prisma.acquisitionLink.update({ where: { id }, data: { archivedAt: null, enabled: true } });
      await logActivity(admin.name, `Unarchived tracking link: ${link.slug}`, 'acquisition');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Acquisition POST', err.message, err.stack);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
