import prisma from '@/lib/prisma';
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('alerts');
  if (error) return error;

  try {
    const alerts = await prisma.alert.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return Response.json({
      alerts: alerts.map(a => ({
        id: a.id,
        message: a.message,
        type: a.type,
        target: a.target,
        active: a.active,
        createdBy: a.createdBy,
        expiresAt: a.expiresAt?.toISOString() || null,
        created: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[Admin Alerts]', err.message);
    return Response.json({ error: 'Failed to load alerts' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('alerts', true);
  if (error) return error;

  try {
    const { action, id, message, type, target, active, expiresAt } = await req.json();

    if (action === 'create') {
      if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 });
      const alert = await prisma.alert.create({
        data: {
          message: message.trim(),
          type: type || 'info',
          target: target || 'both',
          active: active !== false,
          createdBy: admin.name,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });
      await logActivity(admin.name, `Created alert: "${message.trim().slice(0, 50)}"`, 'alert');
      return Response.json({ success: true, alert: { id: alert.id } });
    }

    if (action === 'update') {
      if (!id) return Response.json({ error: 'Alert ID required' }, { status: 400 });
      const data = {};
      if (message !== undefined) data.message = message.trim();
      if (type !== undefined) data.type = type;
      if (target !== undefined) data.target = target;
      if (active !== undefined) data.active = active;
      if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;

      await prisma.alert.update({ where: { id }, data });
      await logActivity(admin.name, `Updated alert ${id}`, 'alert');
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      if (!id) return Response.json({ error: 'Alert ID required' }, { status: 400 });
      await prisma.alert.update({ where: { id }, data: { deletedAt: new Date() } });
      await logActivity(admin.name, `Deleted alert ${id}`, 'alert');
      return Response.json({ success: true });
    }

    if (action === 'toggle') {
      if (!id) return Response.json({ error: 'Alert ID required' }, { status: 400 });
      const alert = await prisma.alert.findUnique({ where: { id } });
      if (!alert) return Response.json({ error: 'Not found' }, { status: 404 });
      await prisma.alert.update({ where: { id }, data: { active: !alert.active } });
      await logActivity(admin.name, `${alert.active ? 'Disabled' : 'Enabled'} alert`, 'alert');
      return Response.json({ success: true, active: !alert.active });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Admin Alerts POST]', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
