import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signUserToken, setUserCookie } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return error('Email and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return error('Invalid email or password', 401);
    }

    if (user.status === 'Suspended') {
      return error('Your account has been suspended. Contact support.', 403);
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
