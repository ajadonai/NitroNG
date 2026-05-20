import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin, canPerformAction, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('acquisition');
  if (error) return error;

  try {
    const links = await prisma.acquisitionLink.findMany({ orderBy: { createdAt: 'desc' } });

    const slugs = links.map(l => l.slug);
    const [signupStats, orderStats] = await Promise.all([
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
    ]);

    const signupMap = Object.fromEntries(signupStats.map(s => [s.signupSource, s._count]));
    const orderMap = Object.fromEntries(orderStats.map(s => [s.slug, { orders: s.orders, revenue: s.revenue }]));

    return Response.json({
      links: links.map(l => ({
        ...l,
        signups: signupMap[l.slug] || 0,
        orders: orderMap[l.slug]?.orders || 0,
        revenue: orderMap[l.slug]?.revenue || 0,
      })),
      canManage: canPerformAction(admin, 'acquisition.manage'),
    });
  } catch (err) {
    log.error('Admin Acquisition GET', err.message);
    return Response.json({ error: 'Failed to load acquisition links' }, { status: 500 });
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
      await logActivity(admin.name, `Created acquisition link: ${clean}`, 'acquisition');
      return Response.json({ success: true, link });
    }

    if (action === 'toggle') {
      const { id, enabled } = body;
      if (!id) return Response.json({ error: 'Link ID required' }, { status: 400 });
      await prisma.acquisitionLink.update({ where: { id }, data: { enabled: !!enabled } });
      await logActivity(admin.name, `${enabled ? 'Enabled' : 'Disabled'} acquisition link ${id}`, 'acquisition');
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
        await logActivity(admin.name, `Disabled acquisition link ${link.slug} (has signups)`, 'acquisition');
        return Response.json({ success: true, soft: true });
      }
      await prisma.acquisitionLink.delete({ where: { id } });
      await logActivity(admin.name, `Deleted acquisition link ${link.slug}`, 'acquisition');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Acquisition POST', err.message, err.stack);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
