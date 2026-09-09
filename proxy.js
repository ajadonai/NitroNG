import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getApplicationUrl } from '@/lib/env';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'nitro-dev-secret-change-me'));
const ADMIN_SECRET = new TextEncoder().encode(process.env.JWT_ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'nitro-admin-secret-change-me'));

async function verifyToken(token, secret) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

const ALLOWED_ORIGINS = [
  'https://nitro.ng', 'https://www.nitro.ng',
  'http://localhost:3000', 'http://localhost:3001',
  'http://192.168.1.11:3000',
  'http://192.168.1.12:3000',
];

// The locales that get their own URLs. Kept in step with SEO_LOCALES in
// lib/i18n.js by tests/locale-routes.test.js — this file cannot import it,
// because the proxy runs on the edge runtime and that module pulls in more
// than the edge is willing to carry.
const LOCALE_ROUTES = ['fr', 'sw', 'ar'];
const localeOf = (pathname) => {
  const first = pathname.split('/')[1];
  return LOCALE_ROUTES.includes(first) ? first : null;
};

export async function proxy(request) {
  const { pathname } = request.nextUrl;
  const locale = localeOf(pathname);

  // ── CSRF: verify Origin on state-changing API requests ──
  if (pathname.startsWith('/api/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
    // Skip webhook endpoints (external services call these)
    if (!pathname.includes('/webhook')) {
      const origin = request.headers.get('origin');
      if (origin) {
        const appUrl = getApplicationUrl();
        const allowed = ALLOWED_ORIGINS.some(o => origin === o) || origin === appUrl;
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }
  }

  // ── Redirect logged-in users away from landing page ──
  // A locale root is the same landing page in another language, so it gets the
  // same treatment: somebody already signed in wants their dashboard, not the
  // marketing page, whichever URL they arrived on.
  if (pathname === '/' || (locale && pathname === `/${locale}`)) {
    const token = request.cookies.get('nitro_token')?.value;
    if (token) {
      const payload = await verifyToken(token, SECRET);
      if (payload?.type === 'user') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // ── Protect /dashboard ──
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('nitro_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/?login=1', request.url));
    }
    const payload = await verifyToken(token, SECRET);
    if (!payload || payload.type !== 'user') {
      const response = NextResponse.redirect(new URL('/?login=1', request.url));
      response.cookies.set('nitro_token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // ── Protect /admin (but not /admin/login) ──
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('nitro_admin_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    const payload = await verifyToken(token, ADMIN_SECRET);
    if (!payload || payload.type !== 'admin') {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.set('nitro_admin_token', '', { maxAge: 0, path: '/', sameSite: 'strict', secure: true });
      return response;
    }
  }

  // The root layout cannot see the pathname — that is simply not available to a
  // server component — so the locale travels to it as a request header. Without
  // this the layout would render every page in English and only correct itself
  // after hydration, which is exactly what a crawler never waits for.
  if (locale) {
    const headers = new Headers(request.headers);
    headers.set('x-nitro-locale', locale);
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/', '/dashboard/:path*', '/admin/:path*', '/api/:path*',
    '/fr', '/fr/:path*', '/sw', '/sw/:path*', '/ar', '/ar/:path*',
  ],
};
