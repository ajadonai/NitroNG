import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { canPerformAction } from '@/lib/admin';
import { ADMIN_ABSOLUTE_LIFETIME_SECONDS } from '@/lib/auth';

export const INTERNAL_DASHBOARD_ACTION = 'internalDashboards.view';
export const INTERNAL_DASHBOARD_COOKIE = 'nitro_internal_dashboard_access';
export const INTERNAL_DASHBOARD_SCOPE = 'internal-dashboard';
export const INTERNAL_DASHBOARD_GRANT_TTL_SECONDS = 8 * 60 * 60;

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

function milliseconds(value) {
  const ms = value instanceof Date ? value.getTime() : Number(value);
  return Number.isFinite(ms) ? ms : Number.NaN;
}

function validIdentifier(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 191;
}

function boundedGrantTtl(value = INTERNAL_DASHBOARD_GRANT_TTL_SECONDS) {
  const ttl = Math.floor(Number(value));
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > INTERNAL_DASHBOARD_GRANT_TTL_SECONDS) {
    throw new RangeError('Internal dashboard grant lifetime is invalid');
  }
  return ttl;
}

export function getInternalDashboardGrantTtl(parentExpiresAt, now = Date.now()) {
  const parentExpiryMs = milliseconds(parentExpiresAt);
  const nowMs = milliseconds(now);
  if (!Number.isFinite(parentExpiryMs) || !Number.isFinite(nowMs)) return 0;
  return Math.min(
    INTERNAL_DASHBOARD_GRANT_TTL_SECONDS,
    Math.max(0, Math.floor((parentExpiryMs - nowMs) / 1000)),
  );
}

export function createInternalDashboardGrant({ adminId, sessionId }, options = {}) {
  if (!validIdentifier(adminId) || !validIdentifier(sessionId)) {
    throw new TypeError('A valid admin and session are required');
  }

  const key = signingKey(options);
  if (!key) throw new InternalDashboardAccessUnavailableError();
  const now = seconds(options.now ?? Date.now());
  const ttl = boundedGrantTtl(options.ttlSeconds ?? options.ttl);

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
      expiresIn: ttl,
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

    const grantDuration = payload?.exp - payload?.iat;
    if (!payload || typeof payload !== 'object'
      || payload.scope !== INTERNAL_DASHBOARD_SCOPE
      || payload.type !== INTERNAL_DASHBOARD_SCOPE
      || !validIdentifier(payload.sub)
      || !validIdentifier(payload.sid)
      || !Number.isInteger(payload.iat)
      || !Number.isInteger(payload.exp)
      || grantDuration <= 0
      || grantDuration > INTERNAL_DASHBOARD_GRANT_TTL_SECONDS) {
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

export function internalDashboardCookieOptions({
  remember,
  env,
  ttlSeconds = INTERNAL_DASHBOARD_GRANT_TTL_SECONDS,
} = {}) {
  const e = env || process.env;
  const opts = {
    httpOnly: true,
    secure: e.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
  if (remember !== false) opts.maxAge = boundedGrantTtl(ttlSeconds);
  return opts;
}

export function clearInternalDashboardGrantCookie(cookieStore, env = process.env) {
  cookieStore.set(INTERNAL_DASHBOARD_COOKIE, '', {
    ...internalDashboardCookieOptions({ env }),
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

export function renewInternalDashboardGrant(access, response, options = {}) {
  if (!access?.ok || !access.expiresAt || !access.admin?.id || !access.sessionId) return;
  const now = options.now ?? Date.now();
  const nowMs = milliseconds(now);
  if (!Number.isFinite(nowMs)) return;
  const remaining = (access.expiresAt.getTime() - nowMs) / 1000;
  if (remaining > RENEW_THRESHOLD_SECONDS) return;
  const cappedTtl = getInternalDashboardGrantTtl(access.parentExpiresAt, now);
  if (cappedTtl <= 0) return;
  try {
    const token = createInternalDashboardGrant({
      adminId: access.admin.id,
      sessionId: access.sessionId,
    }, {
      env: options.env,
      now,
      secret: options.secret,
      ttlSeconds: cappedTtl,
    });
    const remember = access.remember !== false;
    const parts = [
      `${INTERNAL_DASHBOARD_COOKIE}=${token}`,
      'Path=/',
      ...(remember ? [`Max-Age=${cappedTtl}`] : []),
      'HttpOnly',
      'SameSite=Strict',
      ...((options.env || process.env).NODE_ENV === 'production' ? ['Secure'] : []),
    ];
    response.headers.append('Set-Cookie', parts.join('; '));
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
      remember: true,
      createdAt: true,
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

  const nowMs = milliseconds(options.now ?? Date.now());
  const createdAtMs = milliseconds(session.createdAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(createdAtMs)) {
    return { ok: false, status: 401, reason: 'invalid_session' };
  }
  const parentExpiresAt = new Date(
    createdAtMs + ADMIN_ABSOLUTE_LIFETIME_SECONDS * 1000,
  );
  const parentRemainingSeconds = Math.floor(
    (parentExpiresAt.getTime() - nowMs) / 1000,
  );
  if (parentRemainingSeconds <= 0) {
    return { ok: false, status: 401, reason: 'expired' };
  }

  return {
    ok: true,
    status: 200,
    admin: session.admin,
    sessionId: session.id,
    remember: session.remember,
    parentExpiresAt,
    parentRemainingSeconds,
    expiresAt: grant.expiresAt,
  };
}
