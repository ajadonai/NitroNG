import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin, logActivity } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('team');
  if (error) return error;

  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, role: true,
        status: true, lastActive: true, createdAt: true,
      },
    });

    return Response.json({
      admins: admins.map(a => ({
        ...a,
        lastActive: a.lastActive.toISOString(),
        joined: a.createdAt.toISOString(),
        customPages: null,
      })),
    });
  } catch (err) {
    console.error('[Admin Team]', err.message);
    return Response.json({ error: 'Failed to load team' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('team', true);
  if (error) return error;

  if (admin.role !== 'superadmin') {
    return Response.json({ error: 'Only superadmin can manage team' }, { status: 403 });
  }

  try {
    const { action, adminId, name, email, password, role, status } = await req.json();

    if (action === 'create') {
      if (!name || !email || !password) return Response.json({ error: 'Name, email, password required' }, { status: 400 });
      const exists = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
      if (exists) return Response.json({ error: 'Email already in use' }, { status: 400 });

      const hash = await bcrypt.hash(password, 12);
      await prisma.admin.create({
        data: { name, email: email.toLowerCase(), password: hash, role: role || 'admin' },
      });
      await logActivity(admin.name, `Created admin: ${name} (${role || 'admin'})`, 'admin');
      return Response.json({ success: true });
    }

    if (action === 'updateRole') {
      if (!adminId || !role) return Response.json({ error: 'Admin ID and role required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });

      await prisma.admin.update({ where: { id: adminId }, data: { role } });
      await logActivity(admin.name, `Changed ${target.name}'s role to ${role}`, 'admin');
      return Response.json({ success: true });
    }

    if (action === 'toggleStatus') {
      if (!adminId) return Response.json({ error: 'Admin ID required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });
      if (target.id === admin.id) return Response.json({ error: 'Cannot deactivate yourself' }, { status: 400 });

      const newStatus = target.status === 'Active' ? 'Inactive' : 'Active';
      await prisma.admin.update({ where: { id: adminId }, data: { status: newStatus } });
      await logActivity(admin.name, `${newStatus === 'Active' ? 'Activated' : 'Deactivated'} admin: ${target.name}`, 'admin');
      return Response.json({ success: true, status: newStatus });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('[Admin Team POST]', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
