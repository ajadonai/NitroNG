import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('team');
  if (error) return error;

  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, role: true,
        status: true, customPages: true, customActions: true, lastActive: true, createdAt: true,
      },
    });

    return Response.json({
      admins: admins.map(a => ({
        ...a,
        lastActive: a.lastActive.toISOString(),
        joined: a.createdAt.toISOString(),
        customPages: a.customPages ? JSON.parse(a.customPages) : null,
        customActions: a.customActions || null,
      })),
      currentRole: admin.role,
    });
  } catch (err) {
    log.error('Admin Team', err.message);
    return Response.json({ error: 'Failed to load team' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('team', true);
  if (error) return error;

  try {
    const { action, adminId, name, email, password, role, status, pages, newPassword, actions } = await req.json();

    // Prevent creating owner or superadmin via API
    const ASSIGNABLE = ['admin', 'support', 'finance'];

    if (action === 'create') {
      if (!canPerformAction(admin, 'team.create')) return Response.json({ error: 'Not authorized to create admins' }, { status: 403 });
      if (!name || !email || !password) return Response.json({ error: 'Name, email, password required' }, { status: 400 });
      const safeRole = ASSIGNABLE.includes(role) ? role : 'admin';
      const exists = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } });
      if (exists) return Response.json({ error: 'Email already in use' }, { status: 400 });

      const hash = await bcrypt.hash(password, 12);
      await prisma.admin.create({
        data: { name, email: email.toLowerCase(), password: hash, role: safeRole },
      });
      await logActivity(admin.name, `Created admin: ${name} (${safeRole})`, 'admin');
      return Response.json({ success: true });
    }

    if (action === 'updateRole') {
      if (!canPerformAction(admin, 'team.changeRole')) return Response.json({ error: 'Only owner can change roles' }, { status: 403 });
      if (!adminId || !role) return Response.json({ error: 'Admin ID and role required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });
      if (target.role === 'owner') return Response.json({ error: 'Cannot modify owner role' }, { status: 403 });
      const safeRole = ASSIGNABLE.includes(role) ? role : target.role;

      await prisma.admin.update({ where: { id: adminId }, data: { role: safeRole } });
      await logActivity(admin.name, `Changed ${target.name}'s role to ${safeRole}`, 'admin');
      return Response.json({ success: true });
    }

    if (action === 'toggleStatus') {
      if (!adminId) return Response.json({ error: 'Admin ID required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });
      if (target.role === 'owner') return Response.json({ error: 'Cannot deactivate owner' }, { status: 403 });
      if (target.id === admin.id) return Response.json({ error: 'Cannot deactivate yourself' }, { status: 400 });

      const newStatus = target.status === 'Active' ? 'Inactive' : 'Active';
      await prisma.admin.update({ where: { id: adminId }, data: { status: newStatus } });
      await logActivity(admin.name, `${newStatus === 'Active' ? 'Activated' : 'Deactivated'} admin: ${target.name}`, 'admin');
      return Response.json({ success: true, status: newStatus });
    }

    if (action === 'updatePermissions') {
      if (!adminId) return Response.json({ error: 'Admin ID required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });
      if (target.role === 'owner') return Response.json({ error: 'Cannot modify owner' }, { status: 403 });

      // pages = null means reset to default, pages = [...] means custom
      const customPages = Array.isArray(pages) ? JSON.stringify(pages) : null;
      await prisma.admin.update({ where: { id: adminId }, data: { customPages } });
      await logActivity(admin.name, `Updated permissions for ${target.name}${customPages ? ' (custom)' : ' (reset to default)'}`, 'admin');
      return Response.json({ success: true });
    }

    if (action === 'updateActions') {
      if (!adminId) return Response.json({ error: 'Admin ID required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });
      if (target.role === 'owner') return Response.json({ error: 'Cannot modify owner' }, { status: 403 });

      const customActions = Array.isArray(actions) && actions.length > 0 ? JSON.stringify(actions) : null;
      await prisma.admin.update({ where: { id: adminId }, data: { customActions } });
      await logActivity(admin.name, `Updated action permissions for ${target.name}: ${actions?.join(', ') || 'cleared'}`, 'admin');
      return Response.json({ success: true });
    }

    if (action === 'resetPassword') {
      if (!adminId) return Response.json({ error: 'Admin ID required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });
      if (target.role === 'owner' && target.id !== admin.id) return Response.json({ error: 'Cannot reset owner password' }, { status: 403 });

      if (!newPassword || newPassword.length < 6) return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.admin.update({ where: { id: adminId }, data: { password: hash } });
      await logActivity(admin.name, `Reset password for ${target.name}`, 'admin');
      return Response.json({ success: true });
    }

    if (action === 'delete') {
      if (!canPerformAction(admin, 'team.delete')) return Response.json({ error: 'Only owner can delete admins' }, { status: 403 });
      if (!adminId) return Response.json({ error: 'Admin ID required' }, { status: 400 });
      const target = await prisma.admin.findUnique({ where: { id: adminId } });
      if (!target) return Response.json({ error: 'Admin not found' }, { status: 404 });
      if (target.role === 'owner') return Response.json({ error: 'Cannot delete owner' }, { status: 403 });
      if (target.id === admin.id) return Response.json({ error: 'Cannot delete yourself' }, { status: 400 });

      await prisma.admin.delete({ where: { id: adminId } });
      await logActivity(admin.name, `Deleted admin: ${target.name} (${target.email})`, 'admin');
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Team POST', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}
