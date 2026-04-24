import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'nitro-dev-secret-change-me');
const ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'nitro-admin-secret-change-me');

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

export function signUserToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'user' },
    SECRET,
    { expiresIn: '7d' }
  );
}

export function signAdminToken(admin) {
  const expiry = admin.role === 'superadmin' ? '90d' : '3d';
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

export async function setUserCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set('nitro_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function setAdminCookie(token, role) {
  const cookieStore = await cookies();
  const maxAge = role === 'superadmin' ? 60 * 60 * 24 * 90 : 60 * 60 * 24 * 3;
  cookieStore.set('nitro_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export async function clearUserCookie() {
  const cookieStore = await cookies();
  cookieStore.set('nitro_token', '', { maxAge: 0, path: '/' });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set('nitro_admin_token', '', { maxAge: 0, path: '/' });
}

// ── Get current user/admin from cookies ──

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_token')?.value;
  if (!token) return null;
  const payload = verifyUserToken(token);
  if (!payload) return null;
  // Validate session exists (lazy import to avoid circular deps)
  try {
    const prisma = (await import('@/lib/prisma')).default;
    const tHash = hashToken(token);
    const session = await prisma.session.findUnique({ where: { tokenHash: tHash } });
    if (!session) return null;
    // Check user is still active (not deleted or suspended)
    const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { status: true } });
    if (!user || user.status === 'Deleted' || user.status === 'Suspended' || user.status === 'PendingDeletion') return null;
    // Update lastActive (fire and forget)
    prisma.session.update({ where: { id: session.id }, data: { lastActive: new Date() } }).catch(() => {});
  } catch {
    return null;
  }
  return payload;
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_admin_token')?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
