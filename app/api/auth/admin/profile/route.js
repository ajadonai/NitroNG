import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  const { admin, error } = await requireAdmin('settings', true);
  if (error) return error;

  try {
    const body = await req.json();
    const { action, name, email, currentPassword, newPassword, themePreference } = body;

    if (action === 'save-theme') {
      if (themePreference && ['auto', 'night', 'day'].includes(themePreference)) {
        await prisma.admin.update({ where: { id: admin.id }, data: { themePreference } });
        return Response.json({ success: true });
      }
      return Response.json({ error: 'Invalid theme' }, { status: 400 });
    }

    if (action === 'update-profile') {
      const updates = {};
      if (name?.trim() && name.trim() !== admin.name) updates.name = name.trim();
      if (email?.trim() && email.trim() !== admin.email) {
        const existing = await prisma.admin.findUnique({ where: { email: email.trim() } });
        if (existing && existing.id !== admin.id) {
          return Response.json({ error: 'Email already in use' }, { status: 400 });
        }
        updates.email = email.trim();
      }
      if (Object.keys(updates).length === 0) {
        return Response.json({ error: 'No changes' }, { status: 400 });
      }
      await prisma.admin.update({ where: { id: admin.id }, data: updates });
      await logActivity(admin.name, `Updated profile: ${Object.keys(updates).join(', ')}`, 'settings');
      return Response.json({ success: true, message: 'Profile updated', updates });
    }

    if (action === 'change-password') {
      if (!currentPassword || !newPassword) {
        return Response.json({ error: 'Current and new password required' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return Response.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
      }

      const adminFull = await prisma.admin.findUnique({ where: { id: admin.id } });
      const valid = await bcrypt.compare(currentPassword, adminFull.password);
      if (!valid) {
        return Response.json({ error: 'Current password is incorrect' }, { status: 400 });
      }

      const hash = await bcrypt.hash(newPassword, 12);
      await prisma.admin.update({ where: { id: admin.id }, data: { password: hash } });
      await logActivity(admin.name, 'Changed password', 'settings');
      return Response.json({ success: true, message: 'Password updated' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Admin Profile', err.message);
    return Response.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
