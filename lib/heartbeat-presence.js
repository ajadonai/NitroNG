import crypto from 'crypto';

export const HEARTBEAT_PRESENCE_COOKIE = 'nitro_hb_presence';
export const HEARTBEAT_PRESENCE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const HEARTBEAT_NEW_PRESENCE_MAX = 30;
export const HEARTBEAT_NEW_PRESENCE_WINDOW_MS = 60 * 60 * 1000;

const TOKEN_VERSION = 'v1';
const PRESENCE_ID_RE = /^[A-Za-z0-9_-]{22,64}$/;
const KEY_CONTEXT = 'nitro:heartbeat-presence:v1';
const DEVELOPMENT_SECRET = 'nitro-heartbeat-development-only-secret';

export class HeartbeatPresenceUnavailableError extends Error {
  constructor() {
    super('Heartbeat presence signing is not configured');
    this.name = 'HeartbeatPresenceUnavailableError';
  }
}

export function resolveHeartbeatPresenceSecret(env = process.env) {
  const configured = env.HEARTBEAT_SECRET || env.JWT_SECRET;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  if (env.NODE_ENV === 'production') return null;
  return DEVELOPMENT_SECRET;
}

function signingKey({ secret, env } = {}) {
  const root = secret === undefined ? resolveHeartbeatPresenceSecret(env) : secret;
  if (typeof root !== 'string' || root.length === 0) return null;
  return crypto.createHmac('sha256', root).update(KEY_CONTEXT).digest();
}

function unixSeconds(value) {
  const ms = value instanceof Date ? value.getTime() : Number(value);
  return Math.floor(ms / 1000);
}

function signatureFor(unsigned, key) {
  return crypto.createHmac('sha256', key).update(unsigned).digest('base64url');
}

function equalSignature(actual, expected) {
  try {
    const left = Buffer.from(actual, 'base64url');
    const right = Buffer.from(expected, 'base64url');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function createHeartbeatPresence(options = {}) {
  const key = signingKey(options);
  if (!key) throw new HeartbeatPresenceUnavailableError();
  const now = unixSeconds(options.now ?? Date.now());
  const presenceId = options.presenceId
    || crypto.randomBytes(16).toString('base64url');
  if (!PRESENCE_ID_RE.test(presenceId)) throw new TypeError('Invalid heartbeat presence ID');
  const expiresAt = now + HEARTBEAT_PRESENCE_TTL_SECONDS;
  const unsigned = `${TOKEN_VERSION}.${presenceId}.${expiresAt}`;
  return {
    presenceId,
    token: `${unsigned}.${signatureFor(unsigned, key)}`,
    expiresAt: new Date(expiresAt * 1000),
  };
}

export function verifyHeartbeatPresence(token, options = {}) {
  const key = signingKey(options);
  if (!key) return { ok: false, unavailable: true, reason: 'unconfigured' };
  if (typeof token !== 'string' || token.length > 512) {
    return { ok: false, unavailable: false, reason: 'missing' };
  }

  const [version, presenceId, expiresText, signature, ...extra] = token.split('.');
  const expiresAt = Number(expiresText);
  if (extra.length > 0
    || version !== TOKEN_VERSION
    || !PRESENCE_ID_RE.test(presenceId || '')
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= unixSeconds(options.now ?? Date.now())) {
    return { ok: false, unavailable: false, reason: 'invalid' };
  }

  const unsigned = `${version}.${presenceId}.${expiresAt}`;
  if (!equalSignature(signature || '', signatureFor(unsigned, key))) {
    return { ok: false, unavailable: false, reason: 'invalid' };
  }

  return {
    ok: true,
    unavailable: false,
    presenceId,
    expiresAt: new Date(expiresAt * 1000),
  };
}

export function deriveHeartbeatSessionId(presenceId, identityScope, options = {}) {
  const key = signingKey(options);
  if (!key) throw new HeartbeatPresenceUnavailableError();
  if (!PRESENCE_ID_RE.test(presenceId || '')
    || typeof identityScope !== 'string'
    || identityScope.length === 0
    || identityScope.length > 256) {
    throw new TypeError('Invalid heartbeat identity scope');
  }
  return crypto.createHmac('sha256', key)
    .update(`${presenceId}:${identityScope}`)
    .digest('base64url');
}

export function heartbeatSourceKey(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || 'unknown';
  return crypto.createHash('sha256').update(`ip:${ip}`).digest('hex').slice(0, 32);
}

export function heartbeatAnonymousSessionPrefix(sourceKey, options = {}) {
  const key = signingKey(options);
  if (!key) throw new HeartbeatPresenceUnavailableError();
  if (typeof sourceKey !== 'string' || !/^[a-f0-9]{32}$/.test(sourceKey)) {
    throw new TypeError('Invalid heartbeat source key');
  }
  const sourceScope = crypto.createHmac('sha256', key)
    .update(`anonymous-source:${sourceKey}`)
    .digest('base64url')
    .slice(0, 16);
  return `a_${sourceScope}_`;
}

export function deriveAnonymousHeartbeatSessionId(presenceId, sourceKey, options = {}) {
  const prefix = heartbeatAnonymousSessionPrefix(sourceKey, options);
  const scoped = deriveHeartbeatSessionId(
    presenceId,
    `anonymous:${sourceKey}`,
    options,
  );
  return `${prefix}${scoped}`;
}

export function heartbeatPresenceCookieOptions(env = process.env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/heartbeat',
    maxAge: HEARTBEAT_PRESENCE_TTL_SECONDS,
  };
}

export function heartbeatAdmissionKey(req, identityScope = 'anonymous') {
  const source = identityScope === 'anonymous' ? heartbeatSourceKey(req) : identityScope;
  const digest = crypto.createHash('sha256').update(source).digest('hex').slice(0, 32);
  return `rl:heartbeat:new-presence:${digest}`;
}

export function heartbeatRequestHeaderError(req) {
  const contentType = req.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    return { status: 415, error: 'Heartbeat requests must use application/json.' };
  }

  let requestOrigin;
  try {
    requestOrigin = new URL(req.url).origin;
  } catch {
    return { status: 400, error: 'Invalid heartbeat request.' };
  }
  const origin = req.headers.get('origin');
  if (origin && origin !== requestOrigin) {
    return { status: 403, error: 'Cross-origin heartbeat requests are not allowed.' };
  }
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return { status: 403, error: 'Cross-origin heartbeat requests are not allowed.' };
  }
  return null;
}
