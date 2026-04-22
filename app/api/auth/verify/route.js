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

    // If referred, give bonus to both users (or defer if min deposit required)
    if (user.referredBy) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: user.referredBy },
      });
      if (referrer) {
        let referrerBonus = 50000;
        let inviteeBonus = 50000;
        let refEnabled = true;
        let refMinDeposit = 0;
        try {
          const settings = await prisma.setting.findMany({ where: { key: { in: ['ref_referrer_bonus', 'ref_invitee_bonus', 'ref_enabled', 'ref_min_deposit'] } } });
          settings.forEach(s => {
            if (s.key === 'ref_referrer_bonus') referrerBonus = Number(s.value) || 50000;
            if (s.key === 'ref_invitee_bonus') inviteeBonus = Number(s.value) || 50000;
            if (s.key === 'ref_enabled') refEnabled = s.value === 'true';
            if (s.key === 'ref_min_deposit') refMinDeposit = Number(s.value) || 0;
          });
        } catch {}
        // Self-referral guard: skip bonus if referrer and invitee share signup IP
        const sameIp = referrer.signupIp && user.signupIp
          && referrer.signupIp !== 'unknown' && referrer.signupIp === user.signupIp;
        if (sameIp) { log.warn('Referral', `Self-referral suspected: ${user.email} → ${referrer.email} (same IP ${user.signupIp})`); }

        // Pay immediately only if enabled AND no min deposit required AND not self-referral
        if (refEnabled && refMinDeposit <= 0 && !sameIp) {
          const markerNote = `[ref-marker:${user.id}]`;
          try {
            await prisma.$transaction(async (tx) => {
              // Double-check inside transaction to prevent race condition
              const exists = await tx.transaction.findFirst({ where: { userId: user.id, type: 'referral', note: { contains: markerNote } } });
              if (exists) return; // already paid by another request
              await tx.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } });
              await tx.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: referrerBonus, note: `Referral bonus: ${user.name} signed up` } });
              if (inviteeBonus > 0) {
                await tx.user.update({ where: { id: user.id }, data: { balance: { increment: inviteeBonus } } });
              }
              await tx.transaction.create({ data: { userId: user.id, type: 'referral', amount: inviteeBonus, note: `Welcome bonus from referral ${markerNote}` } });
            });
          } catch (txErr) { log.warn('Verify referral race', txErr.message); }
        }
        // If min deposit > 0, bonuses are deferred until first qualifying deposit
        // (handled in /api/payments/verify)
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

    await sendVerificationEmail(user.email, user.firstName || user.name, verifyToken).catch(err =>
      log.error('Verify', `Resend email failed: ${err.message}`)
    );
    if (process.env.NODE_ENV === 'development') {
      log.info('Verify', `Verification code resent to ${user.email}`);
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
