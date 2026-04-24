import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function GET(req) {
  try {
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://nitro.ng';
    const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

    if (!GOOGLE_CLIENT_ID) {
      console.error('[Google OAuth] GOOGLE_CLIENT_ID not set');
      return NextResponse.redirect(new URL('/?error=google_not_configured', req.url));
    }

    // Generate CSRF state token
    const state = crypto.randomBytes(16).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set('google_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Check if there's a referral code in the URL
    const url = new URL(req.url);
    const ref = url.searchParams.get('ref');
    const stateParam = ref ? `${state}|ref:${ref}` : state;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state: stateParam,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err) {
    console.error('[Google OAuth] Error:', err.message);
    return NextResponse.redirect(new URL('/?google_error=1', req.url));
  }
}
