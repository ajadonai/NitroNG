import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signUserToken, setUserCookie } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { sanitizeEmail } from '@/lib/validate';

export async function POST(req) {
  try {
    const { limited } = rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
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

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return error('Invalid email or password', 401);
    }

    // Sign JWT and set cookie
    const token = signUserToken(user);
    await setUserCookie(token);

    return ok({
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName || user.name.split(' ')[0],
        email: user.email,
        emailVerified: user.emailVerified,
        balance: user.balance,
        referralCode: user.referralCode,
      },
    });

  } catch (err) {
    console.error('[LOGIN]', err);
    return error('Something went wrong. Please try again.', 500);
  }
}
