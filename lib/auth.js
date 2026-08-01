import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
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

export const USER_ABSOLUTE_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
export const ADMIN_ABSOLUTE_LIFETIME_SECONDS = 14 * 24 * 60 * 60;
export const SESSION_RENEWAL_REMAINING_FRACTION = 0.25;

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

export function generateSessionId() {
  return crypto.randomUUID();
}

// Keep one name for new call sites while preserving the name used by any
// in-flight tests or callers from the correction pass.
export const createSessionId = generateSessionId;

// ── Token creation ──

export function signUserToken(user, { remember, sid } = {}) {
  const payload = { id: user.id, email: user.email, type: 'user' };
  if (sid) payload.sid = sid;
  if (remember !== undefined) payload.remember = !!remember;
  return jwt.sign(payload, SECRET, { expiresIn: getUserSessionSeconds(remember) });
}

export function signAdminToken(admin, { remember, sid } = {}) {
  const payload = { id: admin.id, email: admin.email, role: admin.role, type: 'admin' };
  if (sid) payload.sid = sid;
  if (remember !== undefined) payload.remember = !!remember;
  const expiry = getAdminSessionSeconds(admin.role, remember);
  return jwt.sign(payload, ADMIN_SECRET, { expiresIn: expiry });
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

export async function setUserCookie(token, { remember, maxAge } = {}) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  // An explicit false creates a browser-session cookie. Existing signup and
  // OAuth callers omit the option and keep Nitro's seven-day default.
  if (remember !== false) {
    options.maxAge = Number.isInteger(maxAge) && maxAge > 0
      ? maxAge
      : getUserSessionSeconds(remember);
  }

  cookieStore.set('nitro_token', token, options);
}

export async function setAdminCookie(token, role, { remember, maxAge } = {}) {
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
  if (remember !== false) {
    options.maxAge = Number.isInteger(maxAge) && maxAge > 0
      ? maxAge
      : getAdminSessionSeconds(role, remember);
  }
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

  let session;
  if (payload.sid) {
    session = await prisma.session.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, lastActive: true, createdAt: true, user: { select: { status: true } } },
    });
    if (session && session.userId !== payload.id) session = null;
  } else {
    const tHash = hashToken(token);
    session = await prisma.session.findUnique({
      where: { tokenHash: tHash },
      select: { id: true, userId: true, lastActive: true, createdAt: true, user: { select: { status: true } } },
    });
  }

  if (!session) { tryClearCookie(cookieStore, 'nitro_token'); return null; }
  if (Date.now() >= new Date(session.createdAt).getTime() + USER_ABSOLUTE_LIFETIME_SECONDS * 1000) {
    tryClearCookie(cookieStore, 'nitro_token');
    return null;
  }
  const status = session.user?.status;
  if (!status || status === 'Deleted' || status === 'Suspended' || status === 'PendingDeletion') { tryClearCookie(cookieStore, 'nitro_token'); return null; }
  if (!session.lastActive || Date.now() - new Date(session.lastActive).getTime() > 5 * 60 * 1000) {
    prisma.session.update({ where: { id: session.id }, data: { lastActive: new Date() } }).catch(() => {});
  }
  payload._sessionId = session.id;
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

  let session;
  if (payload.sid) {
    session = await prisma.adminSession.findUnique({
      where: { id: payload.sid },
      select: { id: true, adminId: true, lastActive: true, createdAt: true, remember: true, admin: { select: { id: true, name: true, email: true, role: true, status: true, customPages: true, customActions: true, themePreference: true, lastActive: true } } },
    });
    if (session && session.adminId !== payload.id) session = null;
  } else {
    const tHash = hashToken(token);
    session = await prisma.adminSession.findUnique({
      where: { tokenHash: tHash },
      select: { id: true, adminId: true, lastActive: true, createdAt: true, remember: true, admin: { select: { id: true, name: true, email: true, role: true, status: true, customPages: true, customActions: true, themePreference: true, lastActive: true } } },
    });
  }

  if (!session) {
    if (clearInvalidCookie) tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }
  if (session.admin?.status !== 'Active') {
    if (clearInvalidCookie) tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }
  const absoluteExpiresAt = new Date(
    new Date(session.createdAt).getTime() + ADMIN_ABSOLUTE_LIFETIME_SECONDS * 1000,
  );
  if (Date.now() >= absoluteExpiresAt.getTime()) {
    if (clearInvalidCookie) tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }
  if (!session.lastActive || Date.now() - new Date(session.lastActive).getTime() > 5 * 60 * 1000) {
    prisma.adminSession.update({ where: { id: session.id }, data: { lastActive: new Date() } }).catch(() => {});
  }
  payload._sessionId = session.id;
  payload._admin = session.admin;
  payload._remember = session.remember;
  payload._absoluteExpiresAt = absoluteExpiresAt;
  return payload;
}

// ── Session renewal ──

export const RENEWAL_THRESHOLD = 1 - SESSION_RENEWAL_REMAINING_FRACTION;

function userStatusAllowsSession(status) {
  return Boolean(
    status
    && status !== 'Deleted'
    && status !== 'Suspended'
    && status !== 'PendingDeletion'
  );
}

function calculateRenewal(payload, {
  baseDuration,
  absoluteLifetime,
  sessionCreatedAt,
  claimsChanged = false,
  nowMs = Date.now(),
}) {
  const nowSeconds = Math.floor(nowMs / 1000);
  const issuedAt = Number(payload?.iat);
  const currentExpiry = Number(payload?.exp);
  if (!Number.isInteger(issuedAt)
    || !Number.isInteger(currentExpiry)
    || currentExpiry <= issuedAt
    || currentExpiry <= nowSeconds) {
    return { valid: false };
  }

  const createdAtMs = new Date(sessionCreatedAt).getTime();
  if (!Number.isFinite(createdAtMs)) return { valid: false };
  const absoluteExpiry = Math.floor(createdAtMs / 1000) + absoluteLifetime;
  if (nowSeconds >= absoluteExpiry) return { valid: false };

  const tokenLifetime = currentExpiry - issuedAt;
  const tokenRemaining = currentExpiry - nowSeconds;
  const threshold = Math.max(
    60,
    Math.floor(tokenLifetime * SESSION_RENEWAL_REMAINING_FRACTION),
  );
  if (!claimsChanged && tokenRemaining > threshold) {
    return { valid: true, renew: false, expiresIn: tokenRemaining };
  }

  const targetExpiry = Math.min(nowSeconds + baseDuration, absoluteExpiry);
  // Once a token already reaches the absolute deadline, another token cannot
  // extend the session and only creates unnecessary rotation traffic.
  if (!claimsChanged && targetExpiry <= currentExpiry) {
    return { valid: true, renew: false, expiresIn: tokenRemaining };
  }

  const expiresIn = targetExpiry - nowSeconds;
  if (expiresIn <= 60) return { valid: false };
  return { valid: true, renew: true, expiresIn };
}

async function validateLegacyUserSession(prisma, token, payload) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      userId: true,
      user: { select: { status: true } },
    },
  });
  return Boolean(
    session
    && session.userId === payload.id
    && userStatusAllowsSession(session.user?.status)
  );
}

async function validateLegacyAdminSession(prisma, token, payload) {
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      adminId: true,
      admin: { select: { status: true } },
    },
  });
  return Boolean(
    session
    && session.adminId === payload.id
    && session.admin?.status === 'Active'
  );
}

export async function renewUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_token')?.value;
  if (!token) return null;

  const payload = verifyUserToken(token);
  if (!payload) {
    tryClearCookie(cookieStore, 'nitro_token');
    return null;
  }

  const prisma = (await import('@/lib/prisma')).default;
  if (!payload.sid) {
    if (await validateLegacyUserSession(prisma, token, payload)) {
      // Existing cookies retain their original expiry and persistence class.
      // They can authenticate normally but roll into sid sessions only on the
      // next explicit login, avoiding a deployment-wide forced logout.
      return { renewed: false, legacy: true };
    }
    tryClearCookie(cookieStore, 'nitro_token');
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      userId: true,
      remember: true,
      createdAt: true,
      user: { select: { status: true, id: true, email: true } },
    },
  });

  if (!session
    || session.userId !== payload.id
    || !userStatusAllowsSession(session.user?.status)) {
    tryClearCookie(cookieStore, 'nitro_token');
    return null;
  }

  const renewal = calculateRenewal(payload, {
    baseDuration: getUserSessionSeconds(session.remember),
    absoluteLifetime: USER_ABSOLUTE_LIFETIME_SECONDS,
    sessionCreatedAt: session.createdAt,
    claimsChanged: payload.email !== session.user.email
      || payload.remember !== session.remember,
  });
  if (!renewal.valid) {
    tryClearCookie(cookieStore, 'nitro_token');
    return null;
  }
  if (!renewal.renew) {
    return { renewed: false, expiresIn: renewal.expiresIn };
  }

  const newToken = jwt.sign(
    {
      id: payload.id,
      email: session.user.email,
      type: 'user',
      sid: session.id,
      remember: session.remember,
    },
    SECRET,
    { expiresIn: renewal.expiresIn },
  );

  // tokenHash remains the immutable initial-token hash for legacy lookup.
  // Every lifecycle operation for modern tokens resolves/revokes by signed sid.
  const touched = await prisma.session.updateMany({
    where: { id: session.id, userId: payload.id },
    data: { lastActive: new Date() },
  });
  if (touched.count !== 1) {
    tryClearCookie(cookieStore, 'nitro_token');
    return null;
  }

  await setUserCookie(newToken, {
    remember: session.remember,
    maxAge: renewal.expiresIn,
  });
  return { renewed: true, expiresIn: renewal.expiresIn };
}

export async function renewAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nitro_admin_token')?.value;
  if (!token) return null;

  const payload = verifyAdminToken(token);
  if (!payload) {
    tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }

  const prisma = (await import('@/lib/prisma')).default;
  if (!payload.sid) {
    if (await validateLegacyAdminSession(prisma, token, payload)) {
      return { renewed: false, legacy: true };
    }
    tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      adminId: true,
      remember: true,
      createdAt: true,
      admin: { select: { id: true, email: true, role: true, status: true } },
    },
  });

  if (!session
    || session.adminId !== payload.id
    || session.admin?.status !== 'Active') {
    tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }

  const renewal = calculateRenewal(payload, {
    baseDuration: getAdminSessionSeconds(session.admin.role, session.remember),
    absoluteLifetime: ADMIN_ABSOLUTE_LIFETIME_SECONDS,
    sessionCreatedAt: session.createdAt,
    claimsChanged: payload.email !== session.admin.email
      || payload.role !== session.admin.role
      || payload.remember !== session.remember,
  });
  if (!renewal.valid) {
    tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }
  if (!renewal.renew) {
    return { renewed: false, expiresIn: renewal.expiresIn };
  }

  const newToken = jwt.sign(
    {
      id: payload.id,
      email: session.admin.email,
      role: session.admin.role,
      type: 'admin',
      sid: session.id,
      remember: session.remember,
    },
    ADMIN_SECRET,
    { expiresIn: renewal.expiresIn },
  );

  const touched = await prisma.adminSession.updateMany({
    where: { id: session.id, adminId: payload.id },
    data: { lastActive: new Date() },
  });
  if (touched.count !== 1) {
    tryClearCookie(cookieStore, 'nitro_admin_token');
    return null;
  }

  await setAdminCookie(newToken, session.admin.role, {
    remember: session.remember,
    maxAge: renewal.expiresIn,
  });
  return { renewed: true, expiresIn: renewal.expiresIn };
}
