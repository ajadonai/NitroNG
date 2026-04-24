import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { signUserToken, setUserCookie, detectDevice, hashToken } from '@/lib/auth';
import { generateReferralCode } from '@/lib/utils';
import { sendWelcomeEmail } from '@/lib/email';
import { cookies, headers } from 'next/headers';

export async function GET(req) {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nitro.ng';
  const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // User cancelled or error from Google
    if (error) {
      return NextResponse.redirect(`${APP_URL}/?error=google_cancelled`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${APP_URL}/?error=google_missing_params`);
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.redirect(`${APP_URL}/?error=google_not_configured`);
    }

    // Verify CSRF state
    const cookieStore = await cookies();
    const savedState = cookieStore.get('google_oauth_state')?.value;
    const stateBase = state.split('|')[0];
    if (!savedState || savedState !== stateBase) {
      return NextResponse.redirect(`${APP_URL}/?error=google_state_mismatch`);
    }
    cookieStore.delete('google_oauth_state');

    // Extract referral code from state if present
    let referralCode = null;
    if (state.includes('|ref:')) {
      referralCode = state.split('|ref:')[1];
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      log.error('Google OAuth', tokenData.error_description || tokenData.error);
      return NextResponse.redirect(`${APP_URL}/?error=google_token_failed`);
    }

    // Get user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userRes.json();
    if (!googleUser.email) {
      return NextResponse.redirect(`${APP_URL}/?error=google_no_email`);
    }

    const email = googleUser.email.toLowerCase().trim();
    const firstName = googleUser.given_name || '';
    const lastName = googleUser.family_name || '';
    const name = googleUser.name || `${firstName} ${lastName}`.trim();

    // Check if user exists
    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Existing user — check status
      if (user.status === 'Suspended') {
        return NextResponse.redirect(`${APP_URL}/banned`);
      }
      if (user.status === 'Deleted') {
        return NextResponse.redirect(`${APP_URL}/?error=google_account_deleted`);
      }
      if (user.status === 'PendingDeletion') {
        return NextResponse.redirect(`${APP_URL}/?error=account_pending_deletion`);
      }

    } else {
      // New user — create account
      let refCode = generateReferralCode();
      while (await prisma.user.findUnique({ where: { referralCode: refCode } })) {
        refCode = generateReferralCode();
      }

      // Validate referral
      let referredBy = null;
      if (referralCode) {
        const referrer = await prisma.user.findUnique({ where: { referralCode } });
        if (referrer) referredBy = referralCode;
      }

      // Extract IP + ToS version before user creation
      const hdrs = await headers();
      const signupIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
      let tosVersion = '2026-03-23';
      try { const s = await prisma.setting.findUnique({ where: { key: 'tos_version' } }); if (s) tosVersion = s.value; } catch {}

      user = await prisma.user.create({
        data: {
          name,
          firstName: firstName || null,
          lastName: lastName || null,
          email,
          password: '', // No password for Google-only accounts
          referralCode: refCode,
          referredBy,
          emailVerified: true, // Google already verified the email
          signupIp,
          tosAcceptedAt: new Date(),
          tosVersion,
        },
      });

      sendWelcomeEmail(firstName || name, email).catch(err =>
        log.error('Google signup', `Welcome email failed: ${err.message}`)
      );
    }

    // Sign JWT and set cookie
    const token = signUserToken(user);
    await setUserCookie(token);

    // Create session
    const hdrs = await headers();
    const ua = hdrs.get('user-agent') || '';
    const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || 'unknown';
    const device = detectDevice(ua);

    // Kill existing session of same device type
    await prisma.session.deleteMany({ where: { userId: user.id, deviceType: device.type } });
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken(token), deviceType: device.type, deviceInfo: device.info, ip },
    });

    return NextResponse.redirect(`${APP_URL}/dashboard`);
  } catch (err) {
    log.error('Google OAuth Callback', err.message);
    return NextResponse.redirect(`${APP_URL}/?error=google_failed`);
  }
}
