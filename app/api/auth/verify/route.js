import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { generateVerifyCode, ok, error } from '@/lib/utils';

export async function POST(req) {
  try {
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
        const bonus = 50000; // ₦500 in kobo
        await prisma.$transaction([
          prisma.user.update({ where: { id: referrer.id }, data: { balance: { increment: bonus } } }),
          prisma.transaction.create({ data: { userId: referrer.id, type: 'referral', amount: bonus, note: `Referral bonus: ${user.name} signed up` } }),
          prisma.user.update({ where: { id: user.id }, data: { balance: { increment: bonus } } }),
          prisma.transaction.create({ data: { userId: user.id, type: 'referral', amount: bonus, note: 'Welcome bonus from referral' } }),
        ]);
      }
    }

    return ok({ message: 'Email verified successfully' });

  } catch (err) {
    console.error('[VERIFY]', err);
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

    // TODO: Send email
    console.log('\n' + '='.repeat(50));
    console.log(`📧 NEW VERIFICATION CODE for ${user.email}`);
    console.log(`👉 CODE: ${verifyToken}`);
    console.log('='.repeat(50) + '\n');

    return ok({
      message: 'New verification code sent',
      verifyCode: process.env.NODE_ENV === 'development' ? verifyToken : undefined,
    });

  } catch (err) {
    console.error('[VERIFY RESEND]', err);
    return error('Something went wrong', 500);
  }
}
