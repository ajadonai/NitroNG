import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ok, error } from '@/lib/utils';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
    if (limited) return tooManyRequests('Too many reset attempts. Try again in 5 minutes.');

    const { token, password } = await req.json();

    if (!token || typeof token !== 'string' || token.length > 200) {
      return error('Invalid token');
    }
    if (!password || typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return error('Password must be 6-128 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: {
        resetToken: tokenHash,
        resetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return error('Invalid or expired reset token', 401);
    }

    const hashed = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          resetToken: null,
          resetExpires: null,
        },
      }),
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return ok({ message: 'Password reset successfully. You can now log in.' });

  } catch (err) {
    log.error('RESET PW', err);
    return error('Something went wrong', 500);
  }
}
