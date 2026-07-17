export const HEARTBEAT_MAX_BODY_BYTES = 1024;
export const HEARTBEAT_SESSION_ID_MIN_LENGTH = 16;
export const HEARTBEAT_SESSION_ID_MAX_LENGTH = 64;
export const HEARTBEAT_PAGE_MAX_LENGTH = 160;
export const HEARTBEAT_USER_AGENT_MAX_LENGTH = 256;

export const HEARTBEAT_INTERVAL_MS = 60_000;
export const HEARTBEAT_WRITE_COALESCE_MS = 45_000;
export const HEARTBEAT_ACTIVE_WINDOW_MS = 150_000;
export const HEARTBEAT_RETENTION_DAYS = 31;
export const HEARTBEAT_RETENTION_MS = HEARTBEAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const HEARTBEAT_ANONYMOUS_RETENTION_MS = 6 * 60 * 60 * 1000;
export const HEARTBEAT_CLEANUP_BATCH_SIZE = 1_000;
export const HEARTBEAT_CLEANUP_PRESSURE_THRESHOLD = 2_500;
export const HEARTBEAT_CLEANUP_PRESSURE_BATCH_SIZE = 5_000;
export const HEARTBEAT_ANONYMOUS_ACTIVE_GLOBAL_MAX = 500;
export const HEARTBEAT_ANONYMOUS_ACTIVE_SOURCE_MAX = 12;

const HEARTBEAT_ANONYMOUS_ADMISSION_LOCK_ID = 1_751_914_832;
const ANONYMOUS_SESSION_PREFIX_RE = /^a_[A-Za-z0-9_-]{16}_$/;

const SESSION_ID_RE = /^[A-Za-z0-9_-]+$/;
const PATH_CONTROL_RE = /[\u0000-\u001f\u007f]/;
const ENCODED_PATH_CONTROL_RE = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const INVALID_PERCENT_ESCAPE_RE = /%(?![0-9a-f]{2})/i;
const HEARTBEAT_URL_BASE = 'https://heartbeat.invalid';

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function isValidHeartbeatSessionId(value) {
  return typeof value === 'string'
    && value.length >= HEARTBEAT_SESSION_ID_MIN_LENGTH
    && value.length <= HEARTBEAT_SESSION_ID_MAX_LENGTH
    && SESSION_ID_RE.test(value);
}

export function createHeartbeatSessionId(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.randomUUID === 'function') {
    try {
      const id = cryptoSource.randomUUID();
      if (isValidHeartbeatSessionId(id)) return id;
    } catch {}
  }

  if (typeof cryptoSource?.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16);
      cryptoSource.getRandomValues(bytes);
      const id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      if (isValidHeartbeatSessionId(id)) return id;
    } catch {}
  }

  // Presence IDs are not credentials. This last-resort fallback keeps the
  // heartbeat functional in privacy-restricted browsers without treating the
  // identifier as an authentication secret.
  const time = Date.now().toString(36).padStart(10, '0');
  const random = Math.random().toString(36).slice(2).padEnd(16, '0');
  return `${time}_${random}`.slice(0, HEARTBEAT_SESSION_ID_MAX_LENGTH);
}

export function normalizeHeartbeatPage(value) {
  if (typeof value !== 'string'
    || value.length === 0
    || value.length > HEARTBEAT_PAGE_MAX_LENGTH
    || !value.startsWith('/')
    || value.startsWith('//')
    || value.includes('?')
    || value.includes('#')
    || value.includes('\\')
    || PATH_CONTROL_RE.test(value)
    || ENCODED_PATH_CONTROL_RE.test(value)
    || INVALID_PERCENT_ESCAPE_RE.test(value)) {
    return null;
  }

  try {
    let pathname = new URL(value, HEARTBEAT_URL_BASE).pathname;
    pathname = pathname.replace(/\/{2,}/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    pathname = pathname.replace(/%[0-9a-f]{2}/gi, encoded => encoded.toUpperCase());

    if (pathname.length === 0
      || pathname.length > HEARTBEAT_PAGE_MAX_LENGTH
      || !pathname.startsWith('/')
      || pathname.startsWith('//')
      || pathname.includes('?')
      || pathname.includes('#')
      || PATH_CONTROL_RE.test(pathname)
      || ENCODED_PATH_CONTROL_RE.test(pathname)) {
      return null;
    }

    return pathname;
  } catch {
    return null;
  }
}

export function normalizeHeartbeatUserAgent(value) {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, HEARTBEAT_USER_AGENT_MAX_LENGTH) : null;
}

export function parseHeartbeatPayload(value) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, code: 'invalid_payload' };
    }

    const page = normalizeHeartbeatPage(value.page);
    if (!page) return { ok: false, code: 'invalid_page' };

    // Presence identity is assigned and signed by the server. Any legacy sid
    // field sent by an older client is intentionally ignored.
    return { ok: true, value: { page } };
  } catch {
    return { ok: false, code: 'invalid_payload' };
  }
}

export function parseHeartbeatPayloadText(text) {
  try {
    if (typeof text !== 'string') return { ok: false, code: 'invalid_payload' };
    if (utf8ByteLength(text) > HEARTBEAT_MAX_BODY_BYTES) {
      return { ok: false, code: 'body_too_large' };
    }
    return parseHeartbeatPayload(JSON.parse(text));
  } catch {
    return { ok: false, code: 'invalid_json' };
  }
}

export async function readHeartbeatRequestText(req, maxBytes = HEARTBEAT_MAX_BODY_BYTES) {
  const declaredLength = req.headers?.get?.('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    return { ok: false, code: 'body_too_large' };
  }

  const reader = req.body?.getReader?.();
  if (!reader) {
    const text = await req.text();
    return utf8ByteLength(text) > maxBytes
      ? { ok: false, code: 'body_too_large' }
      : { ok: true, text };
  }

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch {}
        return { ok: false, code: 'body_too_large' };
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

export async function persistHeartbeat(db, {
  sid,
  page,
  userId = null,
  userAgent = null,
  now = new Date(),
} = {}) {
  const writeCutoff = new Date(now.getTime() - HEARTBEAT_WRITE_COALESCE_MS);
  const written = await db.$executeRaw`
    INSERT INTO "live_sessions" ("sessionId", "userId", "page", "ua", "lastSeen", "firstSeen")
    VALUES (${sid}, ${userId}, ${page}, ${userAgent}, ${now}, ${now})
    ON CONFLICT ("sessionId") DO UPDATE
    SET
      "userId" = EXCLUDED."userId",
      "page" = EXCLUDED."page",
      "ua" = COALESCE("live_sessions"."ua", EXCLUDED."ua"),
      "lastSeen" = GREATEST("live_sessions"."lastSeen", EXCLUDED."lastSeen")
    WHERE EXCLUDED."lastSeen" >= "live_sessions"."lastSeen"
      AND (
        "live_sessions"."lastSeen" <= ${writeCutoff}
        OR "live_sessions"."page" IS DISTINCT FROM EXCLUDED."page"
        OR "live_sessions"."userId" IS DISTINCT FROM EXCLUDED."userId"
      )
  `;

  return { written: Number(written) > 0 };
}

// Anonymous admission is fenced by one database advisory lock so the global
// and per-source counts stay exact across concurrent serverless instances.
// Only currently active sessions bypass admission. A retained inactive row
// must re-enter the fence and capacity checks before it can become active.
export async function persistBoundedAnonymousHeartbeat(db, {
  sid,
  sourcePrefix,
  page,
  userAgent = null,
  now = new Date(),
  globalMax = HEARTBEAT_ANONYMOUS_ACTIVE_GLOBAL_MAX,
  sourceMax = HEARTBEAT_ANONYMOUS_ACTIVE_SOURCE_MAX,
} = {}) {
  if (!isValidHeartbeatSessionId(sid)
    || !ANONYMOUS_SESSION_PREFIX_RE.test(sourcePrefix || '')
    || !sid.startsWith(sourcePrefix)
    || !Number.isSafeInteger(globalMax)
    || !Number.isSafeInteger(sourceMax)
    || globalMax < 1
    || sourceMax < 1
    || sourceMax > globalMax) {
    throw new TypeError('Invalid bounded anonymous heartbeat parameters');
  }

  const activeCutoff = new Date(now.getTime() - HEARTBEAT_ACTIVE_WINDOW_MS);
  const existing = await db.liveSession.findUnique({
    where: { sessionId: sid },
    select: { sessionId: true, lastSeen: true },
  });
  if (existing?.lastSeen >= activeCutoff) {
    return persistHeartbeat(db, { sid, page, userAgent, now });
  }

  return db.$transaction(async tx => {
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(${HEARTBEAT_ANONYMOUS_ADMISSION_LOCK_ID})::text AS "lock"
    `;

    const current = await tx.liveSession.findUnique({
      where: { sessionId: sid },
      select: { sessionId: true, lastSeen: true },
    });
    if (current?.lastSeen >= activeCutoff) {
      return persistHeartbeat(tx, { sid, page, userAgent, now });
    }

    const [globalActive, sourceActive] = await Promise.all([
      tx.liveSession.count({
        where: { userId: null, lastSeen: { gte: activeCutoff } },
      }),
      tx.liveSession.count({
        where: {
          userId: null,
          lastSeen: { gte: activeCutoff },
          sessionId: { startsWith: sourcePrefix },
        },
      }),
    ]);

    if (globalActive >= globalMax) {
      return { written: false, admitted: false, reason: 'global_capacity' };
    }
    if (sourceActive >= sourceMax) {
      return { written: false, admitted: false, reason: 'source_capacity' };
    }

    const result = await persistHeartbeat(tx, { sid, page, userAgent, now });
    return { ...result, admitted: true };
  });
}

export async function cleanupStaleHeartbeats(
  db,
  now = new Date(),
  {
    identifiedRetentionMs = HEARTBEAT_RETENTION_MS,
    anonymousRetentionMs = HEARTBEAT_ANONYMOUS_RETENTION_MS,
    batchSize,
  } = {},
) {
  const identifiedCutoff = new Date(now.getTime() - identifiedRetentionMs);
  const anonymousCutoff = new Date(now.getTime() - anonymousRetentionMs);
  const staleWhere = {
    OR: [
      { userId: null, lastSeen: { lt: anonymousCutoff } },
      { userId: { not: null }, lastSeen: { lt: identifiedCutoff } },
    ],
  };
  const staleCount = batchSize === undefined && typeof db.liveSession.count === 'function'
    ? await db.liveSession.count({ where: staleWhere })
    : null;
  const effectiveBatchSize = batchSize ?? (
    staleCount > HEARTBEAT_CLEANUP_PRESSURE_THRESHOLD
      ? HEARTBEAT_CLEANUP_PRESSURE_BATCH_SIZE
      : HEARTBEAT_CLEANUP_BATCH_SIZE
  );
  if (!Number.isSafeInteger(effectiveBatchSize)
    || effectiveBatchSize < 1
    || effectiveBatchSize > HEARTBEAT_CLEANUP_PRESSURE_BATCH_SIZE) {
    throw new TypeError('Invalid heartbeat cleanup batch size');
  }
  const candidates = await db.liveSession.findMany({
    where: staleWhere,
    select: { sessionId: true },
    orderBy: { lastSeen: 'asc' },
    take: effectiveBatchSize,
  });
  if (candidates.length === 0) {
    return {
      checked: 0,
      deleted: 0,
      hasMore: false,
      batchSize: effectiveBatchSize,
      backlogEstimate: staleCount,
      identifiedCutoff,
      anonymousCutoff,
    };
  }

  const result = await db.liveSession.deleteMany({
    where: {
      sessionId: { in: candidates.map(row => row.sessionId) },
      ...staleWhere,
    },
  });
  return {
    checked: candidates.length,
    deleted: result.count,
    hasMore: candidates.length === effectiveBatchSize,
    batchSize: effectiveBatchSize,
    backlogEstimate: staleCount,
    identifiedCutoff,
    anonymousCutoff,
  };
}
