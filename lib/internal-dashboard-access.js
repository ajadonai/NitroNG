import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { canPerformAction } from '@/lib/admin';

export const INTERNAL_DASHBOARD_ACTION = 'internalDashboards.view';
export const INTERNAL_DASHBOARD_COOKIE = 'nitro_internal_dashboard_access';
export const INTERNAL_DASHBOARD_SCOPE = 'internal-dashboard';
export const INTERNAL_DASHBOARD_GRANT_TTL_SECONDS = 15 * 60;

const INTERNAL_DASHBOARD_AUDIENCE = 'nitro-internal-dashboards';
const INTERNAL_DASHBOARD_ISSUER = 'nitro.ng';
const INTERNAL_DASHBOARD_KEY_CONTEXT = 'nitro:internal-dashboard-access:v1';
const DEVELOPMENT_SECRET = 'nitro-internal-dashboard-development-only-secret';

export class InternalDashboardAccessUnavailableError extends Error {
  constructor() {
    super('Internal dashboard access is not configured');
    this.name = 'InternalDashboardAccessUnavailableError';
  }
}

export function resolveInternalDashboardRootSecret(env = process.env) {
  const configured = env.INTERNAL_DASHBOARD_SECRET || env.JWT_ADMIN_SECRET;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  if (env.NODE_ENV === 'production') return null;
  return DEVELOPMENT_SECRET;
}

export function deriveInternalDashboardSigningKey(rootSecret) {
  if (typeof rootSecret !== 'string' || rootSecret.length === 0) return null;
  return crypto.createHmac('sha256', rootSecret).update(INTERNAL_DASHBOARD_KEY_CONTEXT).digest();
}

function signingKey({ secret, env } = {}) {
  const rootSecret = secret === undefined
    ? resolveInternalDashboardRootSecret(env)
    : secret;
  return deriveInternalDashboardSigningKey(rootSecret);
}

function seconds(value) {
  const ms = value instanceof Date ? value.getTime() : Number(value);
  return Math.floor(ms / 1000);
}

function validIdentifier(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 191;
}

export function createInternalDashboardGrant({ adminId, sessionId }, options = {}) {
  if (!validIdentifier(adminId) || !validIdentifier(sessionId)) {
    throw new TypeError('A valid admin and session are required');
  }

  const key = signingKey(options);
  if (!key) throw new InternalDashboardAccessUnavailableError();
  const now = seconds(options.now ?? Date.now());

  return jwt.sign(
    {
      iat: now,
      sid: sessionId,
      scope: INTERNAL_DASHBOARD_SCOPE,
      type: INTERNAL_DASHBOARD_SCOPE,
    },
    key,
    {
      algorithm: 'HS256',
      audience: INTERNAL_DASHBOARD_AUDIENCE,
      issuer: INTERNAL_DASHBOARD_ISSUER,
      subject: adminId,
      expiresIn: INTERNAL_DASHBOARD_GRANT_TTL_SECONDS,
    },
  );
}

export function verifyInternalDashboardGrant(token, options = {}) {
  const key = signingKey(options);
  if (!key) return { ok: false, unavailable: true, reason: 'unconfigured' };
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
    return { ok: false, unavailable: false, reason: 'missing' };
  }

  try {
    const payload = jwt.verify(token, key, {
      algorithms: ['HS256'],
      audience: INTERNAL_DASHBOARD_AUDIENCE,
      issuer: INTERNAL_DASHBOARD_ISSUER,
      clockTimestamp: seconds(options.now ?? Date.now()),
    });

    if (!payload || typeof payload !== 'object'
      || payload.scope !== INTERNAL_DASHBOARD_SCOPE
      || payload.type !== INTERNAL_DASHBOARD_SCOPE
      || !validIdentifier(payload.sub)
      || !validIdentifier(payload.sid)
      || !Number.isInteger(payload.iat)
      || !Number.isInteger(payload.exp)
      || payload.exp - payload.iat !== INTERNAL_DASHBOARD_GRANT_TTL_SECONDS) {
      return { ok: false, unavailable: false, reason: 'invalid' };
    }

    return {
      ok: true,
      unavailable: false,
      adminId: payload.sub,
      sessionId: payload.sid,
      expiresAt: new Date(payload.exp * 1000),
    };
  } catch (error) {
    return {
      ok: false,
      unavailable: false,
      reason: error?.name === 'TokenExpiredError' ? 'expired' : 'invalid',
    };
  }
}

export function canAccessInternalDashboard(admin) {
  return Boolean(
    admin
    && admin.status === 'Active'
    && (admin.role === 'owner' || admin.role === 'superadmin')
    && canPerformAction(admin, INTERNAL_DASHBOARD_ACTION),
  );
}

export function internalDashboardCookieOptions(env = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: INTERNAL_DASHBOARD_GRANT_TTL_SECONDS,
  };
}

export function clearInternalDashboardGrantCookie(cookieStore, env = process.env) {
  cookieStore.set(INTERNAL_DASHBOARD_COOKIE, '', {
    ...internalDashboardCookieOptions(env),
    maxAge: 0,
  });
}

export function withInternalDashboardNoStore(response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return response;
}

const RENEW_THRESHOLD_SECONDS = 5 * 60;

export function renewInternalDashboardGrant(access, response) {
  if (!access?.ok || !access.expiresAt || !access.admin?.id || !access.sessionId) return;
  const remaining = (access.expiresAt.getTime() - Date.now()) / 1000;
  if (remaining > RENEW_THRESHOLD_SECONDS) return;
  try {
    const token = createInternalDashboardGrant({
      adminId: access.admin.id,
      sessionId: access.sessionId,
    });
    response.headers.append('Set-Cookie',
      `${INTERNAL_DASHBOARD_COOKIE}=${token}; Path=/; Max-Age=${INTERNAL_DASHBOARD_GRANT_TTL_SECONDS}; HttpOnly; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
  } catch {}
}

export function internalDashboardAccessError(access) {
  const status = access?.status || 401;
  const message = status === 503
    ? 'Internal dashboard access is temporarily unavailable'
    : status === 403
      ? 'Access denied'
      : 'Authentication required';
  return withInternalDashboardNoStore(Response.json({ error: message }, { status }));
}

export async function requireInternalDashboardAccess(options = {}) {
  let token = options.token;
  if (token === undefined) {
    const cookieStore = await cookies();
    token = cookieStore.get(INTERNAL_DASHBOARD_COOKIE)?.value || null;
  }

  const grant = verifyInternalDashboardGrant(token, options);
  if (!grant.ok) {
    return {
      ok: false,
      status: grant.unavailable ? 503 : 401,
      reason: grant.reason,
    };
  }

  const db = options.db || prisma;
  const session = await db.adminSession.findUnique({
    where: { id: grant.sessionId },
    select: {
      id: true,
      adminId: true,
      admin: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          customPages: true,
          customActions: true,
        },
      },
    },
  });

  if (!session || session.adminId !== grant.adminId || session.admin?.id !== grant.adminId) {
    return { ok: false, status: 401, reason: 'revoked' };
  }
  if (!canAccessInternalDashboard(session.admin)) {
    return { ok: false, status: 403, reason: 'forbidden' };
  }

  return {
    ok: true,
    status: 200,
    admin: session.admin,
    sessionId: session.id,
    expiresAt: grant.expiresAt,
  };
}
