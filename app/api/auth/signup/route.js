import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signUserToken, setUserCookie } from '@/lib/auth';
import { generateReferralCode, generateVerifyCode, ok, error } from '@/lib/utils';

export async function POST(req) {
  try {
    const { name, email, password, referralCode } = await req.json();

    // Validation
    if (!name || !email || !password) {
      return error('Name, email, and password are required');
    }
    if (password.length < 6) {
      return error('Password must be at least 6 characters');
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return error('An account with this email already exists');
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 12);

    // Generate referral code (ensure unique)
    let refCode = generateReferralCode();
    while (await prisma.user.findUnique({ where: { referralCode: refCode } })) {
      refCode = generateReferralCode();
    }

    // Generate verification code
    const verifyToken = generateVerifyCode();
    const verifyExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    // Check if referral code is valid
    let referredBy = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode } });
      if (referrer) {
        referredBy = referralCode;
      }
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashed,
        referralCode: refCode,
        referredBy,
        verifyToken,
        verifyExpires,
      },
    });

    // TODO: Send verification email with verifyToken
    // For now, we'll log it (remove in production)
    console.log('\n' + '='.repeat(50));
    console.log(`📧 VERIFICATION CODE for ${email}`);
    console.log(`👉 CODE: ${verifyToken}`);
    console.log('='.repeat(50) + '\n');

    // Sign JWT and set cookie
    const token = signUserToken(user);
    await setUserCookie(token);

    return ok({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        referralCode: user.referralCode,
      },
      verifyCode: process.env.NODE_ENV === 'development' ? verifyToken : undefined,
    }, 201);

  } catch (err) {
    console.error('[SIGNUP]', err);
    return error('Something went wrong. Please try again.', 500);
  }
}
