import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import {
  HEARTBEAT_ACTIVE_WINDOW_MS,
  HEARTBEAT_ANONYMOUS_RETENTION_MS,
  HEARTBEAT_CLEANUP_BATCH_SIZE,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_MAX_BODY_BYTES,
  HEARTBEAT_PAGE_MAX_LENGTH,
  HEARTBEAT_RETENTION_DAYS,
  HEARTBEAT_RETENTION_MS,
  HEARTBEAT_USER_AGENT_MAX_LENGTH,
  HEARTBEAT_WRITE_COALESCE_MS,
  cleanupStaleHeartbeats,
  normalizeHeartbeatPage,
  normalizeHeartbeatUserAgent,
  parseHeartbeatPayload,
  parseHeartbeatPayloadText,
  persistHeartbeat,
  readHeartbeatRequestText,
} from '@/lib/heartbeat';
import {
  HEARTBEAT_NEW_PRESENCE_MAX,
  HEARTBEAT_NEW_PRESENCE_WINDOW_MS,
  HEARTBEAT_PRESENCE_COOKIE,
  HEARTBEAT_PRESENCE_TTL_SECONDS,
  createHeartbeatPresence,
  deriveHeartbeatSessionId,
  heartbeatAdmissionKey,
  heartbeatPresenceCookieOptions,
  heartbeatRequestHeaderError,
  resolveHeartbeatPresenceSecret,
  verifyHeartbeatPresence,
} from '@/lib/heartbeat-presence';
import { staleSignupCutoff } from '@/lib/stale-signup-cleanup';

const routeCharacter = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-');
const routeSegment = fc.array(routeCharacter, { minLength: 1, maxLength: 12 })
  .map(chars => chars.join(''));
const validRoute = fc.array(routeSegment, { maxLength: 8 })
  .map(segments => `/${segments.join('/')}`);
const presenceCharacter = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-',
);
const validPresenceId = fc.array(presenceCharacter, { minLength: 22, maxLength: 64 })
  .map(chars => chars.join(''));

function streamedRequest(chunks, headers = {}) {
  let offset = 0;
  const reader = {
    read: vi.fn(async () => (
      offset < chunks.length
        ? { done: false, value: chunks[offset++] }
        : { done: true, value: undefined }
    )),
    cancel: vi.fn().mockResolvedValue(undefined),
    releaseLock: vi.fn(),
  };
  const getReader = vi.fn(() => reader);
  return {
    req: {
      headers: new Headers(headers),
      body: { getReader },
      text: vi.fn(() => { throw new Error('stream fallback must not be used'); }),
    },
    reader,
    getReader,
  };
}

describe('heartbeat parsing and normalization', () => {
  it('accepts canonical routes and never trusts a legacy client-supplied session ID', () => {
    fc.assert(fc.property(validRoute, fc.jsonValue(), (page, legacySid) => {
      const result = parseHeartbeatPayload({ sid: legacySid, page });

      expect(result).toEqual({ ok: true, value: { page } });
      expect(Object.hasOwn(result.value, 'sid')).toBe(false);
      expect(result.value.page.length).toBeLessThanOrEqual(HEARTBEAT_PAGE_MAX_LENGTH);
      expect(normalizeHeartbeatPage(result.value.page)).toBe(result.value.page);
    }), { numRuns: 300 });
  });

  it('never throws for arbitrary JSON and every accepted value is canonical and bounded', () => {
    fc.assert(fc.property(fc.jsonValue(), value => {
      let result;
      expect(() => { result = parseHeartbeatPayload(value); }).not.toThrow();
      expect(() => parseHeartbeatPayloadText(JSON.stringify(value))).not.toThrow();
      if (!result.ok) return;

      expect(result.value).toEqual({ page: result.value.page });
      expect(result.value.page.length).toBeLessThanOrEqual(HEARTBEAT_PAGE_MAX_LENGTH);
      expect(normalizeHeartbeatPage(result.value.page)).toBe(result.value.page);
    }), { numRuns: 500 });
  });

  it('normalizes accepted paths idempotently', () => {
    fc.assert(fc.property(fc.string({ maxLength: 220 }), value => {
      const normalized = normalizeHeartbeatPage(value);
      if (normalized !== null) expect(normalizeHeartbeatPage(normalized)).toBe(normalized);
    }), { numRuns: 300 });
  });

  it('rejects query strings, fragments, controls, protocol-relative paths, and malformed payloads', () => {
    for (const page of [
      '/orders?status=open',
      '/orders#latest',
      '/orders\nnext',
      '//other.test/path',
      '/%0aadmin',
      '/bad%escape',
      `/${'x'.repeat(HEARTBEAT_PAGE_MAX_LENGTH)}`,
    ]) {
      expect(parseHeartbeatPayload({ page }).ok, page).toBe(false);
    }
    for (const value of [null, [], 'route', 42, {}, { page: 1 }]) {
      expect(parseHeartbeatPayload(value).ok).toBe(false);
    }
    expect(parseHeartbeatPayload({ sid: 'attacker-controlled', page: '/' }))
      .toEqual({ ok: true, value: { page: '/' } });
    expect(normalizeHeartbeatPage('/dashboard//orders/')).toBe('/dashboard/orders');
    expect(normalizeHeartbeatPage('/dashboard/../pricing')).toBe('/pricing');
  });

  it('enforces the UTF-8 body limit before parsing JSON', () => {
    const oversized = JSON.stringify({ page: `/${'é'.repeat(HEARTBEAT_MAX_BODY_BYTES)}` });
    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(HEARTBEAT_MAX_BODY_BYTES);
    expect(parseHeartbeatPayloadText(oversized)).toEqual({ ok: false, code: 'body_too_large' });
    expect(parseHeartbeatPayloadText('{')).toEqual({ ok: false, code: 'invalid_json' });
  });

  it('bounds and strips controls from stored user agents', () => {
    fc.assert(fc.property(fc.string({ maxLength: 1000 }), value => {
      const normalized = normalizeHeartbeatUserAgent(value);
      if (normalized === null) return;
      expect(normalized.length).toBeLessThanOrEqual(HEARTBEAT_USER_AGENT_MAX_LENGTH);
      expect(normalized).not.toMatch(/[\u0000-\u001f\u007f]/);
    }), { numRuns: 300 });
    expect(normalizeHeartbeatUserAgent(` Browser\n${'x'.repeat(400)} `)?.length)
      .toBe(HEARTBEAT_USER_AGENT_MAX_LENGTH);
  });
});

describe('bounded heartbeat request streams', () => {
  it('accepts an exact-limit stream assembled from multiple chunks', async () => {
    const encoder = new TextEncoder();
    const first = encoder.encode('a'.repeat(600));
    const second = encoder.encode('b'.repeat(HEARTBEAT_MAX_BODY_BYTES - first.byteLength));
    const { req, reader } = streamedRequest([first, second]);

    const result = await readHeartbeatRequestText(req);

    expect(result.ok).toBe(true);
    expect(new TextEncoder().encode(result.text).byteLength).toBe(HEARTBEAT_MAX_BODY_BYTES);
    expect(result.text).toBe(`${'a'.repeat(600)}${'b'.repeat(424)}`);
    expect(reader.cancel).not.toHaveBeenCalled();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it('stops and cancels the stream as soon as the actual byte cap is crossed', async () => {
    const encoder = new TextEncoder();
    const { req, reader } = streamedRequest([
      encoder.encode('a'.repeat(700)),
      encoder.encode('b'.repeat(325)),
      encoder.encode('this chunk must never be consumed'),
    ]);

    await expect(readHeartbeatRequestText(req)).resolves.toEqual({
      ok: false,
      code: 'body_too_large',
    });
    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(reader.cancel).toHaveBeenCalledOnce();
    expect(reader.releaseLock).toHaveBeenCalledOnce();
  });

  it('rejects an oversized declared length before acquiring a body reader', async () => {
    const { req, getReader } = streamedRequest(
      [new TextEncoder().encode('{}')],
      { 'content-length': String(HEARTBEAT_MAX_BODY_BYTES + 1) },
    );

    await expect(readHeartbeatRequestText(req)).resolves.toEqual({
      ok: false,
      code: 'body_too_large',
    });
    expect(getReader).not.toHaveBeenCalled();
  });

  it('counts multibyte input by encoded bytes rather than JavaScript characters', async () => {
    const encoded = new TextEncoder().encode('é'.repeat(HEARTBEAT_MAX_BODY_BYTES / 2 + 1));
    const { req, reader } = streamedRequest([encoded]);

    await expect(readHeartbeatRequestText(req)).resolves.toEqual({
      ok: false,
      code: 'body_too_large',
    });
    expect(reader.cancel).toHaveBeenCalledOnce();
  });
});

describe('server-issued heartbeat presence', () => {
  it('round-trips every valid presence ID through the signed token', () => {
    fc.assert(fc.property(
      validPresenceId,
      fc.integer({ min: 1_700_000_000_000, max: 1_900_000_000_000 }),
      (presenceId, now) => {
        const created = createHeartbeatPresence({ presenceId, now, secret: 'test-secret' });
        const verified = verifyHeartbeatPresence(created.token, { now, secret: 'test-secret' });

        expect(verified.ok).toBe(true);
        expect(verified.presenceId).toBe(presenceId);
        expect(verified.expiresAt).toEqual(created.expiresAt);
        expect(created.expiresAt.getTime()).toBe(
          Math.floor(now / 1000) * 1000 + HEARTBEAT_PRESENCE_TTL_SECONDS * 1000,
        );
      },
    ), { numRuns: 250 });
  });

  it('rejects tampering and expires at the exact signed boundary', () => {
    const created = createHeartbeatPresence({
      presenceId: 'abcdefghijklmnopqrstuv',
      now: 1_800_000_000_000,
      secret: 'test-secret',
    });
    const parts = created.token.split('.');
    parts[3] = `${parts[3][0] === 'A' ? 'B' : 'A'}${parts[3].slice(1)}`;

    expect(verifyHeartbeatPresence(parts.join('.'), {
      now: 1_800_000_000_000,
      secret: 'test-secret',
    }).ok).toBe(false);
    expect(verifyHeartbeatPresence(created.token, {
      now: created.expiresAt.getTime() - 1,
      secret: 'test-secret',
    }).ok).toBe(true);
    expect(verifyHeartbeatPresence(created.token, {
      now: created.expiresAt,
      secret: 'test-secret',
    }).ok).toBe(false);
    expect(verifyHeartbeatPresence(created.token, {
      now: 1_800_000_000_000,
      secret: 'different-secret',
    }).ok).toBe(false);
  });

  it('derives a deterministic session key scoped to presence, identity, and server secret', () => {
    fc.assert(fc.property(
      validPresenceId,
      fc.stringMatching(/^[A-Za-z0-9_-]{1,40}$/),
      (presenceId, identity) => {
        const scope = `user:${identity}`;
        const first = deriveHeartbeatSessionId(presenceId, scope, { secret: 'secret-a' });

        expect(first).toBe(deriveHeartbeatSessionId(presenceId, scope, { secret: 'secret-a' }));
        expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(first).not.toBe(deriveHeartbeatSessionId(presenceId, `${scope}:other`, {
          secret: 'secret-a',
        }));
        expect(first).not.toBe(deriveHeartbeatSessionId(presenceId, scope, {
          secret: 'secret-b',
        }));
      },
    ), { numRuns: 250 });
  });

  it('fails closed without a production signing secret and sets a hardened narrow cookie', () => {
    expect(resolveHeartbeatPresenceSecret({ NODE_ENV: 'production' })).toBeNull();
    expect(resolveHeartbeatPresenceSecret({
      NODE_ENV: 'production',
      JWT_SECRET: 'jwt-secret',
    })).toBe('jwt-secret');
    expect(resolveHeartbeatPresenceSecret({
      NODE_ENV: 'production',
      JWT_SECRET: 'jwt-secret',
      HEARTBEAT_SECRET: 'dedicated-secret',
    })).toBe('dedicated-secret');
    expect(verifyHeartbeatPresence('anything', {
      env: { NODE_ENV: 'production' },
    })).toEqual({ ok: false, unavailable: true, reason: 'unconfigured' });
    expect(heartbeatPresenceCookieOptions({ NODE_ENV: 'production' })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/heartbeat',
      maxAge: HEARTBEAT_PRESENCE_TTL_SECONDS,
    });
    expect(HEARTBEAT_PRESENCE_COOKIE).toBe('nitro_hb_presence');
  });

  it('keys new-presence admission without exposing IPs or authenticated IDs', () => {
    const requestFrom = ip => ({
      headers: new Headers({ 'x-forwarded-for': `${ip}, 10.0.0.1` }),
    });
    const anonymousA = heartbeatAdmissionKey(requestFrom('203.0.113.1'), 'anonymous');
    const anonymousB = heartbeatAdmissionKey(requestFrom('203.0.113.2'), 'anonymous');
    const identifiedA = heartbeatAdmissionKey(requestFrom('203.0.113.1'), 'user:private-id');
    const identifiedB = heartbeatAdmissionKey(requestFrom('203.0.113.2'), 'user:private-id');

    expect(anonymousA).not.toBe(anonymousB);
    expect(identifiedA).toBe(identifiedB);
    expect(identifiedA).not.toContain('private-id');
    expect(anonymousA).not.toContain('203.0.113.1');
    expect(HEARTBEAT_NEW_PRESENCE_MAX).toBe(30);
    expect(HEARTBEAT_NEW_PRESENCE_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});

describe('heartbeat request origin policy', () => {
  const request = (headers = {}, url = 'https://nitro.test/api/heartbeat') => ({
    url,
    headers: new Headers(headers),
  });

  it('requires JSON and accepts same-origin browser requests', () => {
    expect(heartbeatRequestHeaderError(request({
      'content-type': 'application/json; charset=utf-8',
      origin: 'https://nitro.test',
      'sec-fetch-site': 'same-origin',
    }))).toBeNull();
    expect(heartbeatRequestHeaderError(request({
      'content-type': 'text/plain',
      origin: 'https://nitro.test',
    }))).toEqual({
      status: 415,
      error: 'Heartbeat requests must use application/json.',
    });
  });

  it('rejects cross-origin signals and malformed request URLs', () => {
    expect(heartbeatRequestHeaderError(request({
      'content-type': 'application/json',
      origin: 'https://evil.test',
    }))?.status).toBe(403);
    expect(heartbeatRequestHeaderError(request({
      'content-type': 'application/json',
      'sec-fetch-site': 'cross-site',
    }))?.status).toBe(403);
    expect(heartbeatRequestHeaderError(request({
      'content-type': 'application/json',
    }, 'not a URL'))?.status).toBe(400);
  });
});

describe('heartbeat client timing and payload', () => {
  it('uses a 150-second active window around the one-minute client interval', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(60_000);
    expect(HEARTBEAT_WRITE_COALESCE_MS).toBe(45_000);
    expect(HEARTBEAT_ACTIVE_WINDOW_MS).toBe(150_000);
    expect(HEARTBEAT_ACTIVE_WINDOW_MS).toBeGreaterThan(2 * HEARTBEAT_INTERVAL_MS);
  });

  it('sends only the normalized page and leaves presence identity to the server cookie', () => {
    const source = readFileSync(new URL('../components/heartbeat.jsx', import.meta.url), 'utf8');
    expect(source).toContain("fetch('/api/heartbeat'");
    expect(source).toContain("headers: { 'Content-Type': 'application/json' }");
    expect(source).toContain('body: JSON.stringify({ page })');
    expect(source).toContain('HEARTBEAT_INTERVAL_MS');
    expect(source).not.toContain('sessionStorage');
    expect(source).not.toMatch(/JSON\.stringify\(\{[^}]*sid/);
  });
});

describe('heartbeat monotonic persistence', () => {
  it('uses one atomic upsert fenced against older observations', async () => {
    let query;
    const db = {
      $executeRaw: vi.fn((strings, ...values) => {
        query = { sql: strings.join('?'), values };
        return 1;
      }),
    };
    const now = new Date('2026-07-17T12:00:00.000Z');

    const result = await persistHeartbeat(db, {
      sid: 'server_derived_session_id',
      page: '/dashboard/orders',
      userId: null,
      userAgent: 'Browser',
      now,
    });

    expect(result).toEqual({ written: true });
    expect(db.$executeRaw).toHaveBeenCalledOnce();
    expect(query.sql).toContain('INSERT INTO "live_sessions"');
    expect(query.sql).toContain('ON CONFLICT ("sessionId") DO UPDATE');
    expect(query.sql).toContain('"lastSeen" = GREATEST("live_sessions"."lastSeen", EXCLUDED."lastSeen")');
    expect(query.sql).toContain('WHERE EXCLUDED."lastSeen" >= "live_sessions"."lastSeen"');
    expect(query.sql).toContain('"page" IS DISTINCT FROM EXCLUDED."page"');
    expect(query.sql).toContain('"userId" IS DISTINCT FROM EXCLUDED."userId"');
    expect(query.sql).toContain('"ua" = COALESCE("live_sessions"."ua", EXCLUDED."ua")');
    expect(query.sql.split('DO UPDATE')[1]).not.toContain('"firstSeen" =');
    expect(query.values.slice(0, 6)).toEqual([
      'server_derived_session_id',
      null,
      '/dashboard/orders',
      'Browser',
      now,
      now,
    ]);
    expect(query.values.at(-1)).toEqual(new Date(now.getTime() - HEARTBEAT_WRITE_COALESCE_MS));
  });

  it('always derives the coalescing cutoff from the supplied observation time', () => {
    fc.assert(fc.asyncProperty(
      fc.integer({ min: 1_600_000_000_000, max: 2_000_000_000_000 }),
      async timestamp => {
        let values;
        const db = {
          $executeRaw: vi.fn((strings, ...parameters) => {
            values = parameters;
            return 1;
          }),
        };
        const now = new Date(timestamp);

        await persistHeartbeat(db, { sid: 'server_derived_session_id', page: '/', now });

        expect(values.at(-1).getTime()).toBe(timestamp - HEARTBEAT_WRITE_COALESCE_MS);
        expect(values[4]).toEqual(now);
        expect(values[5]).toEqual(now);
      },
    ), { numRuns: 150 });
  });

  it('reports a coalesced no-op when the atomic statement changes no row', async () => {
    const db = { $executeRaw: vi.fn().mockResolvedValue(0) };
    await expect(persistHeartbeat(db, {
      sid: 'server_derived_session_id',
      page: '/',
      now: new Date('2026-07-17T12:00:00.000Z'),
    })).resolves.toEqual({ written: false });
  });
});

describe('heartbeat retention and batched cleanup', () => {
  it('uses separate six-hour anonymous and 31-day identified cutoffs, then rechecks before delete', async () => {
    const now = new Date('2026-07-17T12:00:00.000Z');
    const findMany = vi.fn().mockResolvedValue([
      { sessionId: 'anonymous-old' },
      { sessionId: 'identified-old' },
    ]);
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });

    const result = await cleanupStaleHeartbeats({ liveSession: { findMany, deleteMany } }, now);
    const findQuery = findMany.mock.calls[0][0];
    const deleteQuery = deleteMany.mock.calls[0][0];
    const anonymousCutoff = new Date(now.getTime() - HEARTBEAT_ANONYMOUS_RETENTION_MS);
    const identifiedCutoff = new Date(now.getTime() - HEARTBEAT_RETENTION_MS);
    const staleWhere = {
      OR: [
        { userId: null, lastSeen: { lt: anonymousCutoff } },
        { userId: { not: null }, lastSeen: { lt: identifiedCutoff } },
      ],
    };

    expect(HEARTBEAT_ANONYMOUS_RETENTION_MS).toBe(6 * 60 * 60 * 1000);
    expect(HEARTBEAT_RETENTION_DAYS).toBe(31);
    expect(findQuery).toEqual({
      where: staleWhere,
      select: { sessionId: true },
      orderBy: { lastSeen: 'asc' },
      take: HEARTBEAT_CLEANUP_BATCH_SIZE,
    });
    expect(deleteQuery).toEqual({
      where: {
        sessionId: { in: ['anonymous-old', 'identified-old'] },
        ...staleWhere,
      },
    });
    expect(result).toEqual({
      checked: 2,
      deleted: 2,
      hasMore: false,
      identifiedCutoff,
      anonymousCutoff,
    });
    expect(identifiedCutoff.getTime()).toBeLessThan(staleSignupCutoff(now).getTime());
  });

  it('does not issue a delete when no stale candidates are found', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const deleteMany = vi.fn();
    const now = new Date('2026-07-17T12:00:00.000Z');

    const result = await cleanupStaleHeartbeats({ liveSession: { findMany, deleteMany } }, now);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      checked: 0,
      deleted: 0,
      hasMore: false,
      identifiedCutoff: new Date(now.getTime() - HEARTBEAT_RETENTION_MS),
      anonymousCutoff: new Date(now.getTime() - HEARTBEAT_ANONYMOUS_RETENTION_MS),
    });
  });

  it('caps each cleanup pass and reports when another batch may remain', async () => {
    const candidates = Array.from(
      { length: HEARTBEAT_CLEANUP_BATCH_SIZE },
      (_, index) => ({ sessionId: `session-${index}` }),
    );
    const findMany = vi.fn().mockResolvedValue(candidates);
    const deleteMany = vi.fn().mockResolvedValue({ count: candidates.length - 1 });

    const result = await cleanupStaleHeartbeats(
      { liveSession: { findMany, deleteMany } },
      new Date('2026-07-17T12:00:00.000Z'),
    );

    expect(findMany.mock.calls[0][0].take).toBe(1_000);
    expect(deleteMany.mock.calls[0][0].where.sessionId.in).toHaveLength(1_000);
    expect(result.checked).toBe(1_000);
    expect(result.deleted).toBe(999);
    expect(result.hasMore).toBe(true);
  });
});
