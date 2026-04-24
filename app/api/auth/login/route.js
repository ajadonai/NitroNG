import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import { signUserToken, setUserCookie, detectDevice, hashToken } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/validate';
import { headers } from 'next/headers';

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many login attempts. Try again in a minute.');

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
      return Response.json({ error: 'This account is scheduled for deletion. Contact support@nitro.ng to reinstate it.', banned: false }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return error('Invalid email or password', 401);
    }

    // Sign JWT and set cookie
    const token = signUserToken(user);
    await setUserCookie(token);

    // Session management — 1 web + 1 mobile
    const hdrs = await headers();
    const ua = hdrs.get('user-agent') || '';
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const device = detectDevice(ua);
    const tHash = hashToken(token);

    // Kill existing session of same device type for this user
    await prisma.session.deleteMany({
      where: { userId: user.id, deviceType: device.type },
    });

    // Create new session
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: tHash,
        deviceType: device.type,
        deviceInfo: device.info,
        ip,
      },
    });

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
