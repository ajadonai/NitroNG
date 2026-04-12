import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import { ok, error } from '@/lib/utils';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const { limited } = rateLimit(req, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
    if (limited) return tooManyRequests('Too many reset attempts. Try again in 5 minutes.');

    const { token, password } = await req.json();

    if (!token || !password) {
      return error('Token and new password are required');
    }
    if (password.length < 6) {
      return error('Password must be at least 6 characters');
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return error('Invalid or expired reset token', 401);
    }

    const hashed = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetToken: null,
        resetExpires: null,
      },
    });

    return ok({ message: 'Password reset successfully. You can now log in.' });

  } catch (err) {
    log.error('RESET PW', err);
    return error('Something went wrong', 500);
  }
}
