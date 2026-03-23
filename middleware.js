import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'boostpanel-dev-secret-change-me');
const ADMIN_SECRET = new TextEncoder().encode(process.env.JWT_ADMIN_SECRET || 'boostpanel-admin-secret-change-me');

async function verifyToken(token, secret) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Protect /dashboard ──
  if (pathname.startsWith('/dashboard')) {
    const token = request.cookies.get('bp_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/?login=1', request.url));
    }
    const payload = await verifyToken(token, SECRET);
    if (!payload || payload.type !== 'user') {
      const response = NextResponse.redirect(new URL('/?login=1', request.url));
      response.cookies.set('bp_token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // ── Protect /admin (but not /admin/login) ──
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('bp_admin_token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    const payload = await verifyToken(token, ADMIN_SECRET);
    if (!payload || payload.type !== 'admin') {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.set('bp_admin_token', '', { maxAge: 0, path: '/' });
      return response;
    }
  }

  // ── Redirect logged-in users away from /admin/login ──
  if (pathname === '/admin/login') {
    const token = request.cookies.get('bp_admin_token')?.value;
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
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
