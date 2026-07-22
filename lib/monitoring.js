import * as SentryCore from '@sentry/core';
import { captureRequestError } from '@sentry/nextjs';
import {
  redactSensitiveText,
  requestPathOnly,
  sanitizeError,
  sanitizeMonitoringValue,
} from './monitoring-redaction.js';

const DEFAULT_ALERT_THROTTLE_MS = 5 * 60 * 1000;
const SIGNAL_PATTERN = /^[a-z][a-z0-9_]{2,63}$/;
const DEDUPE_KEY_PATTERN = /^[a-z][a-z0-9_.:-]{2,95}$/;
const SENTRY_LEVELS = new Set(['debug', 'info', 'log', 'warning', 'error', 'fatal']);

function requestMethod(value) {
  return typeof value === 'string' && /^[A-Z]{3,10}$/.test(value)
    ? value
    : 'UNKNOWN';
}

function controlFlowDigest(error) {
  return error?.digest || error?.cause?.digest || '';
}

export function isExpectedRequestControlFlow(error) {
  return /^(?:NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;(?:401|403|404)|NEXT_UNAUTHORIZED|NEXT_FORBIDDEN)(?:;|$)/
    .test(controlFlowDigest(error));
}

export function forwardServerRequestError(
  error,
  request,
  context,
  { sentry = { captureRequestError } } = {},
) {
  if (isExpectedRequestControlFlow(error)) return false;
  if (typeof sentry.captureRequestError !== 'function') return false;

  const safeRequest = {
    // Prefer Next's route template so dynamic tokens/keys never become event data.
    path: requestPathOnly(context?.routePath || request?.path || request?.url),
    method: requestMethod(request?.method),
    // Never forward Cookie, Authorization, IP, or provider-signature headers.
    headers: {},
  };
  const safeContext = {
    routerKind: redactSensitiveText(String(context?.routerKind || 'unknown')),
    routePath: requestPathOnly(context?.routePath),
    routeType: redactSensitiveText(String(context?.routeType || 'unknown')),
  };

  try {
    sentry.captureRequestError(sanitizeError(error), safeRequest, safeContext);
    return true;
  } catch {
    // Monitoring must never turn an already-failing request into another error.
    return false;
  }
}

export function createOperationalReporter({
  sentry = SentryCore,
  now = Date.now,
  defaultThrottleMs = DEFAULT_ALERT_THROTTLE_MS,
} = {}) {
  // This throttle is intentionally best-effort per warm runtime. Sentry's
  // stable fingerprint provides cross-instance grouping without making outage
  // reporting depend on Redis (which is itself one of the monitored systems).
  const lastCapturedAt = new Map();

  return function reportOperationalFailure(signal, {
    error,
    level = 'error',
    data = {},
    dedupeKey = signal,
    throttleMs = defaultThrottleMs,
  } = {}) {
    if (typeof signal !== 'string' || !SIGNAL_PATTERN.test(signal)) return false;
    if (typeof sentry.isInitialized === 'function' && !sentry.isInitialized()) return false;

    const safeDedupeKey = typeof dedupeKey === 'string' && DEDUPE_KEY_PATTERN.test(dedupeKey)
      ? dedupeKey
      : signal;
    const safeLevel = SENTRY_LEVELS.has(level) ? level : 'error';
    const clockValue = Number(now());
    const current = Number.isFinite(clockValue) ? clockValue : Date.now();
    const interval = Number.isFinite(throttleMs)
      ? Math.max(0, throttleMs)
      : defaultThrottleMs;
    const previous = lastCapturedAt.get(safeDedupeKey);
    if (Number.isFinite(previous) && current - previous < interval) return false;

    try {
      sentry.withScope(scope => {
        scope.setLevel(safeLevel);
        scope.setTag('operational.signal', signal);
        scope.setFingerprint(['nitro-operational', signal, safeDedupeKey]);
        scope.setContext('operational', sanitizeMonitoringValue({ ...data, signal }));
        if (error) scope.captureException(sanitizeError(error));
        else scope.captureMessage(`Operational alert: ${signal}`, safeLevel);
      });
      lastCapturedAt.set(safeDedupeKey, current);
      return true;
    } catch {
      return false;
    }
  };
}

export const reportOperationalFailure = createOperationalReporter();
