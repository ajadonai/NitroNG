import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── CSRF: verify Origin on state-changing API requests ──
  if (pathname.startsWith('/api/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
    // Skip webhook endpoints (external services call these)
    if (!pathname.includes('/webhook')) {
      const origin = request.headers.get('origin');
      if (origin) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        const allowed = ALLOWED_ORIGINS.some(o => origin === o) || (appUrl && origin === appUrl);
        if (!allowed) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }
  }

  // ── Redirect logged-in users away from landing page ──
  if (pathname === '/') {
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
      response.cookies.set('nitro_admin_token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // ── Redirect logged-in users away from /admin/login ──
  if (pathname === '/admin/login') {
    const token = request.cookies.get('nitro_admin_token')?.value;
    if (token) {
      const payload = await verifyToken(token, ADMIN_SECRET);
      if (payload?.type === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/admin/:path*', '/api/:path*'],
};
