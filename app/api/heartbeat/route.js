import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import {
  HEARTBEAT_ACTIVE_WINDOW_MS,
  normalizeHeartbeatUserAgent,
  parseHeartbeatPayloadText,
  persistBoundedAnonymousHeartbeat,
  persistHeartbeat,
  readHeartbeatRequestText,
} from '@/lib/heartbeat';
import { resolveHeartbeatActor } from '@/lib/heartbeat-actor';
import {
  createHeartbeatPresence,
  deriveAnonymousHeartbeatSessionId,
  deriveHeartbeatSessionId,
  heartbeatAdmissionKey,
  heartbeatAnonymousSessionPrefix,
  heartbeatSourceKey,
  HEARTBEAT_NEW_PRESENCE_MAX,
  HEARTBEAT_NEW_PRESENCE_WINDOW_MS,
  HEARTBEAT_PRESENCE_COOKIE,
  heartbeatPresenceCookieOptions,
  heartbeatRequestHeaderError,
  verifyHeartbeatPresence,
} from '@/lib/heartbeat-presence';
import {
  rateLimit,
  rateLimitUnavailable,
  tooManyRequests,
} from '@/lib/rate-limit';

const HEARTBEAT_RATE_LIMIT_MAX = 120;
const HEARTBEAT_RATE_LIMIT_WINDOW_MS = 60_000;

export async function POST(req) {
  let limit;
  try {
    limit = await rateLimit(req, {
      maxAttempts: HEARTBEAT_RATE_LIMIT_MAX,
      windowMs: HEARTBEAT_RATE_LIMIT_WINDOW_MS,
    });
  } catch {
    return rateLimitUnavailable('Heartbeat protection is temporarily unavailable.');
  }
  if (limit.unavailable) {
    return rateLimitUnavailable('Heartbeat protection is temporarily unavailable.', limit.retryAfter);
  }
  if (limit.limited) {
    return tooManyRequests('Too many heartbeat requests.', limit.retryAfter);
  }

  const headerError = heartbeatRequestHeaderError(req);
  if (headerError) {
    return Response.json(
      { ok: false, error: headerError.error },
      { status: headerError.status },
    );
  }

  let parsed;
  try {
    const body = await readHeartbeatRequestText(req);
    parsed = body.ok
      ? parseHeartbeatPayloadText(body.text)
      : { ok: false, code: body.code };
  } catch {
    parsed = { ok: false, code: 'invalid_payload' };
  }

  if (!parsed.ok) {
    const tooLarge = parsed.code === 'body_too_large';
    return Response.json(
      { ok: false, error: tooLarge ? 'Heartbeat payload is too large.' : 'Invalid heartbeat payload.' },
      { status: tooLarge ? 413 : 400 },
    );
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('nitro_token')?.value;
    const adminToken = cookieStore.get('nitro_admin_token')?.value;
    const actor = await resolveHeartbeatActor(prisma, {
      page: parsed.value.page,
      userToken: token,
      adminToken,
    });
    const identityScope = actor?.identityScope || 'anonymous';

    let presence = verifyHeartbeatPresence(
      cookieStore.get(HEARTBEAT_PRESENCE_COOKIE)?.value,
    );
    if (presence.unavailable) {
      return rateLimitUnavailable('Heartbeat identity is temporarily unavailable.');
    }

    let mintedPresence = null;
    if (!presence.ok) {
      let admission;
      try {
        admission = await rateLimit(req, {
          maxAttempts: HEARTBEAT_NEW_PRESENCE_MAX,
          windowMs: HEARTBEAT_NEW_PRESENCE_WINDOW_MS,
          key: heartbeatAdmissionKey(req, identityScope),
        });
      } catch {
        return rateLimitUnavailable('Heartbeat identity protection is temporarily unavailable.');
      }
      if (admission.unavailable) {
        return rateLimitUnavailable(
          'Heartbeat identity protection is temporarily unavailable.',
          admission.retryAfter,
        );
      }
      if (admission.limited) {
        return tooManyRequests('Too many new heartbeat sessions.', admission.retryAfter);
      }
      mintedPresence = createHeartbeatPresence();
      presence = { ok: true, presenceId: mintedPresence.presenceId };
    }

    const sourceKey = actor ? null : heartbeatSourceKey(req);
    const sourcePrefix = sourceKey
      ? heartbeatAnonymousSessionPrefix(sourceKey)
      : null;
    const sid = actor
      ? deriveHeartbeatSessionId(presence.presenceId, identityScope)
      : deriveAnonymousHeartbeatSessionId(presence.presenceId, sourceKey);

    const observation = {
      sid,
      page: parsed.value.page,
      userAgent: normalizeHeartbeatUserAgent(req.headers.get('user-agent')),
    };
    const result = actor
      ? await persistHeartbeat(prisma, { ...observation, userId: actor.id })
      : await persistBoundedAnonymousHeartbeat(prisma, {
          ...observation,
          sourcePrefix,
        });
    if (result.admitted === false) {
      return tooManyRequests(
        'Anonymous heartbeat capacity is temporarily full.',
        Math.ceil(HEARTBEAT_ACTIVE_WINDOW_MS / 1000),
      );
    }

    const response = NextResponse.json({ ok: true, written: result.written });
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    if (mintedPresence) {
      response.cookies.set(
        HEARTBEAT_PRESENCE_COOKIE,
        mintedPresence.token,
        heartbeatPresenceCookieOptions(),
      );
    }
    return response;
  } catch (err) {
    log.error('Heartbeat', err.message);
    return Response.json({ ok: false }, { status: 500 });
  }
}
