import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { generateVerifyCode, ok, error } from '@/lib/utils';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { limited } = rateLimit(req, { maxAttempts: 10, windowMs: 5 * 60 * 1000 });
    if (limited) return tooManyRequests('Too many attempts. Try again in 5 minutes.');
    const { code } = await req.json();
    const session = await getCurrentUser();

    if (!session) {
      return error('Not authenticated', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return error('User not found', 404);

    if (user.emailVerified) {
      return ok({ message: 'Email already verified' });
    }

    if (!user.verifyToken || !user.verifyExpires) {
      return error('No verification code found. Request a new one.');
    }

    if (new Date() > user.verifyExpires) {
      return error('Verification code has expired. Request a new one.');
    }

    if (user.verifyToken !== code) {
      return error('Invalid verification code');
    }

    // Mark as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyToken: null,
        verifyExpires: null,
      },
    });

    // If referred, give bonus to both users
    if (user.referredBy) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: user.referredBy },
      });
      if (referrer) {
        // Read bonus amounts from settings, fallback to ₦500
        let referrerBonus = 50000;
        let inviteeBonus = 50000;
        try {
          const settings = await prisma.setting.findMany({ where: { key: { in: ['ref_referrer_bonus', 'ref_invitee_bonus'] } } });
          settings.forEach(s => {
            if (s.key === 'ref_referrer_bonus') referrerBonus = Number(s.value) || 50000;
            if (s.key === 'ref_invitee_bonus') inviteeBonus = Number(s.value) || 50000;
          });
        } catch {}
        const ops = [
          prisma.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } }),
          prisma.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: referrerBonus, note: `Referral bonus: ${user.name} signed up` } }),
        ];
        if (inviteeBonus > 0) {
          ops.push(
            prisma.user.update({ where: { id: user.id }, data: { balance: { increment: inviteeBonus } } }),
            prisma.transaction.create({ data: { userId: user.id, type: 'referral', amount: inviteeBonus, note: 'Welcome bonus from referral' } }),
          );
        }
        await prisma.$transaction(ops);
      }
    }

    return ok({ message: 'Email verified successfully' });

  } catch (err) {
    log.error('VERIFY', err);
    return error('Something went wrong', 500);
  }
}

// Resend verification code
export async function PUT(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return error('Not authenticated', 401);

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) return error('User not found', 404);
    if (user.emailVerified) return ok({ message: 'Email already verified' });

    const verifyToken = generateVerifyCode();
    const verifyExpires = new Date(Date.now() + 30 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken, verifyExpires },
    });

    sendVerificationEmail(user.email, user.firstName || user.name, verifyToken).catch(err =>
      log.error('Verify', 'Resend email failed')
    );
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n${'='.repeat(50)}\n📧 CODE for ${user.email} (resend): ${verifyToken}\n${'='.repeat(50)}\n`);
    }

    return ok({
      message: 'New verification code sent',
      verifyCode: process.env.NODE_ENV === 'development' ? verifyToken : undefined,
    });

  } catch (err) {
    log.error('VERIFY RESEND', err);
    return error('Something went wrong', 500);
  }
}
