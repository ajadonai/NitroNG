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

    // Check for common email domain typos
    const domain = email.split('@')[1]?.toLowerCase();
    const DOMAIN_TYPOS = {
      'gmail.com': ['gmsil.com', 'gmial.com', 'gmal.com', 'gmil.com', 'gmaill.com', 'gamil.com', 'gnail.com', 'gmaul.com', 'gmali.com', 'gmail.co', 'gmaio.com', 'gmqil.com'],
      'yahoo.com': ['yaho.com', 'yahooo.com', 'yaboo.com', 'yhoo.com', 'yahoo.co', 'yaoo.com', 'yahho.com'],
      'hotmail.com': ['hotmal.com', 'hotmial.com', 'hotmai.com', 'hotmil.com', 'hotmaill.com', 'hotmall.com'],
      'outlook.com': ['outlok.com', 'outloo.com', 'outllok.com', 'outlookm.com'],
      'icloud.com': ['iclou.com', 'icoud.com', 'iclould.com', 'icloude.com'],
    };
    for (const [correct, typos] of Object.entries(DOMAIN_TYPOS)) {
      if (typos.includes(domain)) {
        return error(`Did you mean ${email.split('@')[0]}@${correct}?`);
      }
    }

    if (!validatePassword(password)) return error('Password must be 6-128 characters');

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      if (existing.status === 'PendingDeletion') {
        return error('This email is associated with an account scheduled for deletion. Contact support@nitro.ng to reinstate it.');
      }
      // If unverified and verify code expired, delete and allow re-signup
      if (!existing.emailVerified && existing.verifyExpires && existing.verifyExpires < new Date()) {
        await prisma.user.delete({ where: { id: existing.id } });
      } else if (!existing.emailVerified) {
        // Unverified but code still valid — resend code
        const verifyToken = generateVerifyCode();
        const verifyExpires = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.user.update({ where: { id: existing.id }, data: { verifyToken, verifyExpires } });
        await sendVerificationEmail(email, existing.firstName || existing.name, verifyToken).catch(err => 
          log.error('Signup', `Resend email failed: ${err.message}`)
        );
        if (process.env.NODE_ENV === 'development') {
          log.info('Signup', `Verification code sent to ${email}`);
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

    // Extract IP + ToS version before user creation
    const hdrs = await headers();
    const ua = hdrs.get('user-agent') || '';
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';

    let tosVersion = '2026-03-23';
    try { const s = await prisma.setting.findUnique({ where: { key: 'tos_version' } }); if (s) tosVersion = s.value; } catch {}

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
        signupIp: ip,
        tosAcceptedAt: new Date(),
        tosVersion,
      },
    });

    // Send verification email
    await sendVerificationEmail(email, firstName || name, verifyToken).catch(err => 
      log.error('Signup', `Email send failed: ${err.message}`)
    );
    if (process.env.NODE_ENV === 'development') {
      log.info('Signup', `Verification code sent to ${email}`);
    }

    // Sign JWT and set cookie
    const token = signUserToken(user);
    await setUserCookie(token);

    // Create session
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
