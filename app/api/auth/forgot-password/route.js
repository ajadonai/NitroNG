import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import crypto from 'crypto';
import { ok, error } from '@/lib/utils';
import { sendPasswordResetEmail } from '@/lib/email';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (limited) return tooManyRequests('Too many requests. Try again in 15 minutes.');

    const { email } = await req.json();
    if (!email) return error('Email is required');

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return ok({ message: 'If an account exists, a reset link has been sent.' });
    }

    // Don't send reset for deleted/pending deletion accounts
    if (user.status === 'PendingDeletion' || user.status === 'Deleted' || user.status === 'Suspended') {
      return ok({ message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetExpires },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${origin}/?reset=${resetToken}`;

    const emailResult = await sendPasswordResetEmail(user.email, user.firstName || user.name, resetUrl);
    if (!emailResult.success) {
      log.error('Forgot', `Email failed: ${emailResult.reason}`);
    }
    if (process.env.NODE_ENV === 'development') {
      log.info('Forgot', `Password reset email sent to ${email}`);
    }

    return ok({
      message: 'If an account exists, a reset link has been sent.',
    });

  } catch (err) {
    log.error('FORGOT', err);
    return error('Something went wrong', 500);
  }
}
