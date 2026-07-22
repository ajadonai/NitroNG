const SENSITIVE_KEY = /(?:authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key|dsn|email|phone|customer|first[-_]?name|last[-_]?name|user[-_]?(?:id|name)|account|bank|card|amount|balance|reference|tx[-_]?ref|payment[-_]?(?:id|address)|gateway[-_]?url)/i;
const SENSITIVE_EXACT_KEY = /^(?:headers|ip|ipaddress|name|query_string|user)$/i;

const REDACTION = '[redacted]';
const MAX_TEXT_LENGTH = 16_000;
const MAX_DEPTH = 8;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;

/**
 * Remove common credentials, customer identifiers, network addresses, and
 * payment references from free-form diagnostics before they reach monitoring.
 */
export function redactSensitiveText(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  const bounded = value.length > MAX_TEXT_LENGTH
    ? `${value.slice(0, MAX_TEXT_LENGTH)}[truncated]`
    : value;

  return bounded
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTION}`)
    .replace(/([?&](?:access_token|authorization|code|cookie|email|hash|invite|key|password|phone|reference|refresh_token|reset|secret|session|sig|signature|token|tx_ref)=)[^&#\s]*/gi, `$1${REDACTION}`)
    .replace(/\b(?:password|passwd|secret|token|authorization|cookie|api[-_]?key|dsn|amount|balance|account(?:[-_]?number)?|reference|tx[-_]?ref|payment[-_]?id)\s*[:=]\s*[^,;\s]+/gi, match => {
      const separator = match.search(/[:=]/);
      return `${match.slice(0, separator + 1)}${REDACTION}`;
    })
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\bNTR-[A-Z0-9-]+\b/gi, '[redacted-reference]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted-ip]')
    .replace(/\[(?:[A-F0-9]{0,4}:){2,}[A-F0-9]{0,4}\]/gi, '[redacted-ip]')
    .replace(/(^|[^\w:])::1(?=$|[^\w])/g, '$1[redacted-ip]')
    .replace(/\+?234[ -]?(?:\d[ -]?){10}\b/g, '[redacted-phone]')
    .replace(/\b0[789][01]\d{8}\b/g, '[redacted-phone]')
    .replace(/(?:₦|\b(?:NGN|USD|USDT|BTC|ETH)\s+)[\d,.]+/gi, '[redacted-amount]');
}

function sanitizeValue(value, key, depth, seen) {
  if (SENSITIVE_KEY.test(key) || SENSITIVE_EXACT_KEY.test(key)) return REDACTION;
  if (typeof value === 'string') return redactSensitiveText(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value === undefined) return undefined;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: redactSensitiveText(value.name || 'Error'),
      message: redactSensitiveText(value.message || ''),
      stack: redactSensitiveText(value.stack || ''),
    };
  }
  if (typeof value !== 'object') return '[unsupported]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map(item => sanitizeValue(item, '', depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_OBJECT_KEYS)
      .map(([childKey, child]) => [
        childKey,
        sanitizeValue(child, childKey, depth + 1, seen),
      ]),
  );
}

export function sanitizeMonitoringValue(value) {
  return sanitizeValue(value, '', 0, new WeakSet());
}

export function sanitizeError(error) {
  if (!(error instanceof Error)) {
    return new Error(redactSensitiveText(String(error || 'Unknown server error')));
  }

  const clean = new Error(redactSensitiveText(error.message || 'Server request failed'));
  clean.name = redactSensitiveText(error.name || 'Error');
  if (error.stack) clean.stack = redactSensitiveText(error.stack);
  if (typeof error.digest === 'string') clean.digest = redactSensitiveText(error.digest);
  return clean;
}

export function requestPathOnly(value) {
  if (typeof value !== 'string' || value.length === 0) return '/unknown';
  let path;
  try {
    path = new URL(value, 'https://monitoring.invalid').pathname;
  } catch {
    path = value.replace(/[?#].*$/, '');
  }
  return redactSensitiveText(path)
    .replace(/^(\/api\/orders\/bulk\/status\/)[^/]+/i, '$1[redacted]')
    .replace(/^(\/pit\/join\/)[^/]+/i, '$1[redacted]');
}

/**
 * Last line of defence for server and edge Sentry events. Default request PII
 * is disabled separately; this also scrubs manually attached data.
 */
export function scrubSentryEvent(event) {
  if (!event || typeof event !== 'object') return event;
  const safeEvent = sanitizeMonitoringValue(event);

  delete safeEvent.user;
  if (safeEvent.request && typeof safeEvent.request === 'object') {
    safeEvent.request = {
      method: safeEvent.request.method,
      url: requestPathOnly(safeEvent.request.url),
    };
  }
  return safeEvent;
}

export function scrubSentryBreadcrumb(breadcrumb) {
  const safeBreadcrumb = sanitizeMonitoringValue(breadcrumb);
  if (safeBreadcrumb?.data && typeof safeBreadcrumb.data === 'object') {
    for (const key of ['from', 'to', 'url']) {
      if (typeof safeBreadcrumb.data[key] === 'string') {
        safeBreadcrumb.data[key] = requestPathOnly(safeBreadcrumb.data[key]);
      }
    }
  }
  return safeBreadcrumb;
}
