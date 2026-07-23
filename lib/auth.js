import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_ADMIN_SECRET)) {
  throw new Error('FATAL: JWT_SECRET and JWT_ADMIN_SECRET must be set in production');
}
const SECRET = process.env.JWT_SECRET || 'nitro-dev-secret-change-me';
const ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'nitro-admin-secret-change-me';

export const USER_SESSION_SECONDS = 60 * 60 * 24;
export const DEFAULT_USER_SESSION_SECONDS = 60 * 60 * 24 * 7;
export const REMEMBERED_USER_SESSION_SECONDS = 60 * 60 * 24 * 7;
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

export function getUserSessionSeconds(remember) {
  if (remember === true) return REMEMBERED_USER_SESSION_SECONDS;
  if (remember === false) return USER_SESSION_SECONDS;
  return DEFAULT_USER_SESSION_SECONDS;
}

export function getAdminSessionSeconds(role, remember) {
  if (remember === false) return ADMIN_SESSION_SECONDS;
  return role === 'superadmin'
    ? 60 * 60 * 24 * 14
    : 60 * 60 * 24 * 7;
}

// ── Device detection ──

export function detectDevice(userAgent) {
  if (!userAgent) return { type: 'web', info: 'Unknown' };
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod|tablet|kindle|silk/i.test(ua);
  let browser = 'Browser';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';
  let os = '';
  if (ua.includes('iphone')) os = 'iPhone';
  else if (ua.includes('ipad')) os = 'iPad';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('linux')) os = 'Linux';
  return { type: isMobile ? 'mobile' : 'web', info: `${browser}${os ? ' · ' + os : ''}` };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Token creation ──

export function signUserToken(user, { remember } = {}) {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'user' },
    SECRET,
    { expiresIn: getUserSessionSeconds(remember) }
  );
}

export function signAdminToken(admin, { remember } = {}) {
  const expiry = getAdminSessionSeconds(admin.role, remember);
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, type: 'admin' },
    ADMIN_SECRET,
    { expiresIn: expiry }
  );
}

// ── Token verification ──

export function verifyUserToken(token) {
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.type !== 'user') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, ADMIN_SECRET);
    if (decoded.type !== 'admin') return null;
    return decoded;
  } catch {
    return null;
  }
}

// ── Cookie helpers (for Route Handlers) ──

export async function setUserCookie(token, { remember } = {}) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  // An explicit false creates a browser-session cookie. Existing signup and
  // OAuth callers omit the option and keep Nitro's seven-day default.
  if (remember !== false) options.maxAge = getUserSessionSeconds(remember);

  cookieStore.set('nitro_token', token, options);
}

export async function setAdminCookie(token, role, { remember } = {}) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  if (remember !== false) options.maxAge = getAdminSessionSeconds(role, remember);
  cookieStore.set('nitro_admin_token', token, options);
}

export async function clearUserCookie() {
  const cookieStore = await cookies();
  cookieStore.set('nitro_token', '', { maxAge: 0, path: '/' });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set('nitro_admin_token', '', { maxAge: 0, path: '/', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
}

// ── Get current user/admin from cookies ──

function tryClearCookie(cookieStore, name) {
  try { cookieStore.set(name, '', { maxAge: 0, path: '/' }); } catch {}
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_token')?.value;
  if (!token) return null;
  const payload = verifyUserToken(token);
  if (!payload) { tryClearCookie(cookieStore, 'nitro_token'); return null; }
  const prisma = (await import('@/lib/prisma')).default;
  const tHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash: tHash },
    select: {
      id: true,
      lastActive: true,
      user: { select: { status: true } },
    },
  });
  if (!session) { tryClearCookie(cookieStore, 'nitro_token'); return null; }
  const status = session.user?.status;
  if (!status || status === 'Deleted' || status === 'Suspended' || status === 'PendingDeletion') { tryClearCookie(cookieStore, 'nitro_token'); return null; }
  if (!session.lastActive || Date.now() - new Date(session.lastActive).getTime() > 5 * 60 * 1000) {
    prisma.session.update({ where: { id: session.id }, data: { lastActive: new Date() } }).catch(() => {});
  }
  return payload;
}

export async function getCurrentAdmin({ clearInvalidCookie = true } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_admin_token')?.value;
  if (!token) return null;
  const payload = verifyAdminToken(token);
  if (!payload) {
    if (clearInvalidCookie) tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }
  const prisma = (await import('@/lib/prisma')).default;
  const tHash = hashToken(token);
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: tHash }, select: { id: true, lastActive: true, admin: { select: { id: true, name: true, email: true, role: true, status: true, customPages: true, customActions: true, themePreference: true, lastActive: true } } } });
  if (!session) {
    if (clearInvalidCookie) tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }
  if (!session.lastActive || Date.now() - new Date(session.lastActive).getTime() > 5 * 60 * 1000) {
    prisma.adminSession.update({ where: { id: session.id }, data: { lastActive: new Date() } }).catch(() => {});
  }
  payload._sessionId = session.id;
  payload._admin = session.admin;
  return payload;
}
