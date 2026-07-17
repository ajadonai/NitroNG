import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import { signUserToken, setUserCookie, detectDevice, hashToken } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/validate';
import { headers } from 'next/headers';

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many login attempts. Try again in a minute.', limit.retryAfter);

    const body = await req.json();
    const email = sanitizeEmail(body.email);
    const password = body.password;

    if (!email || !password) {
      return error('Email and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return error('Invalid email or password', 401);
    }

    if (user.status === 'Suspended') {
      return Response.json({ error: 'Account suspended', banned: true }, { status: 403 });
    }
    if (user.status === 'Deleted') {
      return error('Invalid email or password', 401);
    }
    if (user.status === 'PendingDeletion') {
      return Response.json({ error: 'Account pending deletion. Contact support@nitro.ng.', banned: false }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return error('Invalid email or password', 401);
    }

    // Sign JWT and set cookie
    const token = signUserToken(user);
    await setUserCookie(token);

    const hdrs = await headers();
    const ua = hdrs.get('user-agent') || '';
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const device = detectDevice(ua);
    const tHash = hashToken(token);

    await prisma.session.create({
      data: { userId: user.id, tokenHash: tHash, deviceType: device.type, deviceInfo: device.info, ip },
    });

    // Cap at 5 sessions — prune oldest beyond limit
    const sessions = await prisma.session.findMany({ where: { userId: user.id }, orderBy: { lastActive: 'desc' }, select: { id: true } });
    if (sessions.length > 5) {
      await prisma.session.deleteMany({ where: { id: { in: sessions.slice(5).map(s => s.id) } } });
    }

    return ok({
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName || user.name.split(' ')[0],
        email: user.email,
        emailVerified: user.emailVerified,
        balance: user.balance / 100,
        referralCode: user.referralCode,
      },
    });

  } catch (err) {
    log.error('LOGIN', err);
    return error('Something went wrong. Please try again.', 500);
  }
}
