import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { ok, error } from '@/lib/utils';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) return error('Email is required');

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return ok({ message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetExpires },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${origin}/?reset=${resetToken}`;

    sendPasswordResetEmail(user.email, user.firstName || user.name, resetUrl).catch(err =>
      console.error('[Forgot] Email failed:', err)
    );
    if (process.env.NODE_ENV === 'development') {
      console.log(`[RESET] ${email}: ${resetUrl}`);
    }

    return ok({
      message: 'If an account exists, a reset link has been sent.',
    });

  } catch (err) {
    console.error('[FORGOT]', err);
    return error('Something went wrong', 500);
  }
}
