import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return Response.json({ error: 'Current and new password required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return Response.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
    }
    if (currentPassword === newPassword) {
      return Response.json({ error: 'New password must be different from current' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return Response.json({ error: 'Current password is incorrect' }, { status: 400 });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });

    return Response.json({ success: true, message: 'Password updated' });
  } catch (err) {
    log.error('Change Password', err.message);
    return Response.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
