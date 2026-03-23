import prisma from '@/lib/prisma';
import crypto from 'crypto';
import { ok, error } from '@/lib/utils';

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
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetExpires },
    });

    // TODO: Send reset email with link containing resetToken
    console.log(`[RESET] ${email}: ${resetToken}`);

    return ok({
      message: 'If an account exists, a reset link has been sent.',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    });

  } catch (err) {
    console.error('[FORGOT]', err);
    return error('Something went wrong', 500);
  }
}
