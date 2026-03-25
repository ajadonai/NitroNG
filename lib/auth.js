import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const SECRET = process.env.JWT_SECRET || 'nitro-dev-secret-change-me';
const ADMIN_SECRET = process.env.JWT_ADMIN_SECRET || 'nitro-admin-secret-change-me';

// ── Token creation ──

export function signUserToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, type: 'user' },
    SECRET,
    { expiresIn: '7d' }
  );
}

export function signAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: admin.role, type: 'admin' },
    ADMIN_SECRET,
    { expiresIn: '12h' }
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
  cookieStore.set('bp_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function setAdminCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set('bp_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  });
}

export async function clearUserCookie() {
  const cookieStore = await cookies();
  cookieStore.set('bp_token', '', { maxAge: 0, path: '/' });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.set('bp_admin_token', '', { maxAge: 0, path: '/' });
}

// ── Get current user/admin from cookies ──

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('bp_token')?.value;
  if (!token) return null;
  return verifyUserToken(token);
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('bp_admin_token')?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}
