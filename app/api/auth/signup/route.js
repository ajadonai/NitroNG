import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import bcrypt from 'bcryptjs';
import { signUserToken, setUserCookie, detectDevice, hashToken } from '@/lib/auth';
import { generateReferralCode, generateVerifyCode, ok, error } from '@/lib/utils';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { validateEmail, validatePassword, validateName, sanitizeEmail, sanitizeString } from '@/lib/validate';
import { headers } from 'next/headers';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { limited } = rateLimit(req, { maxAttempts: 5, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many signup attempts. Try again in a minute.');

    const body = await req.json();
    const name = sanitizeString(body.name, 100);
    const firstName = sanitizeString(body.firstName, 50);
    const lastName = sanitizeString(body.lastName, 50);
    const phone = sanitizeString(body.phone, 20);
    const email = sanitizeEmail(body.email);
    const password = body.password;
    const referralCode = sanitizeString(body.referralCode, 20);

    if (!validateName(name)) return error('Name can only contain letters, spaces, hyphens, and apostrophes');
    
    // Check name blacklist
    const { checkName } = await import('@/lib/name-filter');
    const nameCheck = checkName(name);
    if (nameCheck.blocked) return error(nameCheck.reason);
    if (firstName) { const fnCheck = checkName(firstName); if (fnCheck.blocked) return error(fnCheck.reason); }
    if (lastName) { const lnCheck = checkName(lastName); if (lnCheck.blocked) return error(lnCheck.reason); }

    if (!validateEmail(email)) return error('Please enter a valid email address');
    if (!validatePassword(password)) return error('Password must be 6-128 characters');

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      // If unverified and verify code expired, delete and allow re-signup
      if (!existing.emailVerified && existing.verifyExpires && existing.verifyExpires < new Date()) {
        await prisma.user.delete({ where: { id: existing.id } });
      } else if (!existing.emailVerified) {
        // Unverified but code still valid — resend code
        const verifyToken = generateVerifyCode();
        const verifyExpires = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.user.update({ where: { id: existing.id }, data: { verifyToken, verifyExpires } });
        sendVerificationEmail(email, existing.firstName || existing.name, verifyToken).catch(err => 
          log.error('Signup', 'Resend email failed')
        );
        if (process.env.NODE_ENV === 'development') {
          console.log(`\n${'='.repeat(50)}\n📧 CODE for ${email} (re-signup): ${verifyToken}\n${'='.repeat(50)}\n`);
        }
        const token = signUserToken(existing);
        await setUserCookie(token);
        // Create session for re-signup
        const hdrs = await headers();
        const ua = hdrs.get('user-agent') || '';
        const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
        const device = detectDevice(ua);
        await prisma.session.deleteMany({ where: { userId: existing.id, deviceType: device.type } });
        await prisma.session.create({ data: { userId: existing.id, tokenHash: hashToken(token), deviceType: device.type, deviceInfo: device.info, ip } });
        return ok({ user: { id: existing.id, name: existing.name, email: existing.email, emailVerified: false } });
      } else {
        return error('An account with this email already exists');
      }
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
    const derivedName = (firstName && lastName) ? `${firstName} ${lastName}` : name.trim();
    const user = await prisma.user.create({
      data: {
        name: derivedName,
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        email: email.toLowerCase().trim(),
        password: hashed,
        referralCode: refCode,
        referredBy,
        verifyToken,
        verifyExpires,
      },
    });

    // Send verification email
    sendVerificationEmail(email, firstName || name, verifyToken).catch(err => 
      log.error('Signup', 'Email send failed')
    );
    // Also log to terminal in dev
    if (process.env.NODE_ENV === 'development') {
      console.log('\n' + '='.repeat(50));
      console.log(`📧 VERIFICATION CODE for ${email}`);
      console.log(`👉 CODE: ${verifyToken}`);
      console.log('='.repeat(50) + '\n');
    }

    // Sign JWT and set cookie
    const token = signUserToken(user);
    await setUserCookie(token);

    // Create session
    const hdrs = await headers();
    const ua = hdrs.get('user-agent') || '';
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const device = detectDevice(ua);
    await prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), deviceType: device.type, deviceInfo: device.info, ip } });

    return ok({
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        email: user.email,
        emailVerified: user.emailVerified,
        referralCode: user.referralCode,
      },
      verifyCode: process.env.NODE_ENV === 'development' ? verifyToken : undefined,
    }, 201);

  } catch (err) {
    log.error('SIGNUP', err);
    return error('Something went wrong. Please try again.', 500);
  }
}
