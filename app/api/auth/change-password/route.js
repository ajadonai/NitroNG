import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, hashToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
    if (limited) return tooManyRequests('Too many attempts. Try again in 5 minutes.');

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return Response.json({ error: 'Current and new password required' }, { status: 400 });
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      return Response.json({ error: 'Password must be 6-128 characters' }, { status: 400 });
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

    // Kill all other sessions (keep current)
    const cookieStore = await cookies();
    const currentToken = cookieStore.get('nitro_token')?.value;
    const currentHash = currentToken ? hashToken(currentToken) : null;
    if (currentHash) {
      await prisma.session.deleteMany({ where: { userId: user.id, tokenHash: { not: currentHash } } });
    }

    return Response.json({ success: true, message: 'Password updated' });
  } catch (err) {
    log.error('Change Password', err.message);
    return Response.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
