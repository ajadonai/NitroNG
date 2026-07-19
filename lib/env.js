const DEVELOPMENT_RUNTIME_REQUIRED = Object.freeze([
  'DATABASE_URL',
]);

export const PRODUCTION_RUNTIME_REQUIRED = Object.freeze([
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_APP_URL',
  'JWT_SECRET',
  'JWT_ADMIN_SECRET',
  'CRON_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'FLUTTERWAVE_WEBHOOK_HASH',
  'NOWPAYMENTS_IPN_SECRET',
  'BREVO_API_KEY',
  'MTP_API_KEY',
  'JAP_API_KEY',
  'DAOSMM_API_KEY',
  'NEXT_PUBLIC_SENTRY_DSN',
  'IP_HASH_SALT',
]);

export const PRODUCTION_BUILD_REQUIRED = Object.freeze([
  ...PRODUCTION_RUNTIME_REQUIRED,
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
]);

const APP_URL_ALIASES = Object.freeze([
  'APP_URL',
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_URL',
]);

const SECRET_REQUIREMENTS = Object.freeze({
  JWT_SECRET: 32,
  JWT_ADMIN_SECRET: 32,
  CRON_SECRET: 32,
  GOOGLE_CLIENT_SECRET: 16,
  UPSTASH_REDIS_REST_TOKEN: 16,
  FLUTTERWAVE_WEBHOOK_HASH: 16,
  FLUTTERWAVE_SECRET_KEY: 16,
  FLUTTERWAVE_PUBLIC_KEY: 8,
  NOWPAYMENTS_IPN_SECRET: 16,
  NOWPAYMENTS_API_KEY: 16,
  BREVO_API_KEY: 16,
  MTP_API_KEY: 8,
  JAP_API_KEY: 8,
  DAOSMM_API_KEY: 8,
  SENTRY_AUTH_TOKEN: 16,
  IP_HASH_SALT: 32,
  INTERNAL_DASHBOARD_SECRET: 32,
  HEARTBEAT_SECRET: 32,
  ANALYTICS_READ_TOKEN: 32,
});

const PLACEHOLDER_SECRET = /(?:change[-_ ]?me|placeholder|example|your[-_ ]?(?:secret|token|key|salt)|dev(?:elopment)?[-_ ]?(?:secret|token|key|salt)|test[-_ ]?(?:secret|token|key|salt)|ci[-_ ]?build[-_ ]?only)/i;
const DEVELOPMENT_IP_HASH_SALT = 'nitro-development-ip-hash-salt';
const HTTPS_ENDPOINT_KEYS = Object.freeze([
  'MTP_API_URL',
  'JAP_API_URL',
  'DAOSMM_API_URL',
]);
const WHITESPACE_SENSITIVE_KEYS = Object.freeze(new Set([
  ...PRODUCTION_BUILD_REQUIRED,
  ...APP_URL_ALIASES,
  ...Object.keys(SECRET_REQUIREMENTS),
  ...HTTPS_ENDPOINT_KEYS,
  'FLUTTERWAVE_PUBLIC_KEY',
  'FLUTTERWAVE_SECRET_KEY',
  'NOWPAYMENTS_API_KEY',
  'INTERNAL_DASHBOARD_SECRET',
  'HEARTBEAT_SECRET',
]));

function configuredValue(env, key) {
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedOrigin(url) {
  return url.origin.toLowerCase();
}

function isLocalHostname(hostname) {
  // URL.hostname keeps brackets around IPv6 literals and permits a trailing
  // root dot. Normalize both before applying the loopback checks.
  const host = hostname.toLowerCase().replace(/\.+$/, '').replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  if (/^127(?:\.|$)/.test(host)) return true;

  // WHATWG URL canonicalizes ::ffff:127.0.0.1 to ::ffff:7f00:1. Support
  // both that canonical form and an unparsed dotted-quad spelling.
  const mapped = host.match(/^::ffff:(.+)$/)?.[1];
  if (!mapped) return false;
  if (/^127(?:\.|$)/.test(mapped)) return true;
  const [highWord, lowWord, ...rest] = mapped.split(':');
  if (rest.length > 0 || !/^[a-f0-9]{1,4}$/.test(highWord || '')
    || !/^[a-f0-9]{1,4}$/.test(lowWord || '')) return false;
  return (Number.parseInt(highWord, 16) >>> 8) === 0x7f;
}

function validateSurroundingWhitespace(env, errors) {
  for (const key of WHITESPACE_SENSITIVE_KEYS) {
    const raw = env?.[key];
    if (typeof raw === 'string' && raw !== raw.trim()) {
      errors.push(`${key} must not contain surrounding whitespace`);
    }
  }
}

function parseUrl(value, key, errors) {
  try {
    return new URL(value);
  } catch {
    errors.push(`${key} must be a valid absolute URL`);
    return null;
  }
}

function validateApplicationUrl(env, errors, production) {
  const value = configuredValue(env, 'NEXT_PUBLIC_APP_URL');
  if (!value) return;
  const url = parseUrl(value, 'NEXT_PUBLIC_APP_URL', errors);
  if (!url) return;

  if (production && url.protocol !== 'https:') {
    errors.push('NEXT_PUBLIC_APP_URL must use HTTPS in production');
  } else if (!production && !['http:', 'https:'].includes(url.protocol)) {
    errors.push('NEXT_PUBLIC_APP_URL must use HTTP or HTTPS');
  }
  if (url.username || url.password) {
    errors.push('NEXT_PUBLIC_APP_URL must not contain credentials');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    errors.push('NEXT_PUBLIC_APP_URL must be an origin without a path, query, or fragment');
  }
  if (production && isLocalHostname(url.hostname)) {
    errors.push('NEXT_PUBLIC_APP_URL must not point to a local host in production');
  }

  for (const alias of APP_URL_ALIASES) {
    const aliasValue = configuredValue(env, alias);
    if (!aliasValue) continue;
    const aliasUrl = parseUrl(aliasValue, alias, errors);
    if (!aliasUrl) continue;
    if (normalizedOrigin(aliasUrl) !== normalizedOrigin(url)
      || aliasUrl.pathname !== '/'
      || aliasUrl.search
      || aliasUrl.hash) {
      errors.push(`${alias} must match NEXT_PUBLIC_APP_URL exactly`);
    }
  }
}

/**
 * Return the one canonical public origin used in links, redirects, callbacks,
 * and same-origin configuration. Production never guesses this value.
 */
export function getApplicationUrl(
  env = process.env,
  { production = env.NODE_ENV === 'production' } = {},
) {
  const value = configuredValue(env, 'NEXT_PUBLIC_APP_URL');
  if (!value) {
    if (production) {
      throw new EnvironmentValidationError(
        ['NEXT_PUBLIC_APP_URL is required'],
        'runtime',
      );
    }
    return 'http://localhost:3000';
  }

  const errors = [];
  validateApplicationUrl(env, errors, production);
  if (errors.length > 0) throw new EnvironmentValidationError(errors, 'runtime');
  return new URL(value).origin;
}

/**
 * Resolve the salt used to pseudonymize visitor IPs. A predictable value is
 * acceptable only for local development and tests, never in production.
 */
export function getIpHashSalt(
  env = process.env,
  { production = env.NODE_ENV === 'production' } = {},
) {
  const value = configuredValue(env, 'IP_HASH_SALT');
  if (!value) {
    if (production) {
      throw new EnvironmentValidationError(['IP_HASH_SALT is required'], 'runtime');
    }
    return DEVELOPMENT_IP_HASH_SALT;
  }

  if (production) {
    const errors = [];
    validateSecret(env, 'IP_HASH_SALT', SECRET_REQUIREMENTS.IP_HASH_SALT, errors);
    if (errors.length > 0) throw new EnvironmentValidationError(errors, 'runtime');
  }
  return value;
}

function validateDatabaseUrl(env, key, errors, production) {
  const value = configuredValue(env, key);
  if (!value) return;
  const url = parseUrl(value, key, errors);
  if (!url) return;
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    errors.push(`${key} must use the postgres or postgresql protocol`);
  }
  if (!url.hostname) errors.push(`${key} must include a database host`);
  if (!url.pathname || url.pathname === '/' || !url.pathname.slice(1).trim()) {
    errors.push(`${key} must include a database name`);
  }
  if (production && isLocalHostname(url.hostname)) {
    errors.push(`${key} must not point to a local database in production`);
  }
  if (production) {
    const hostEnforcesTls = url.hostname.toLowerCase().endsWith('.neon.tech');
    if (!hostEnforcesTls) {
      const sslModes = url.searchParams.getAll('sslmode').map(mode => mode.toLowerCase());
      if (sslModes.length !== 1 || !['require', 'verify-full'].includes(sslModes[0])) {
        errors.push(`${key} must set sslmode=require or sslmode=verify-full in production`);
      }
    }
  }
  if (key === 'DIRECT_URL') {
    const hostname = url.hostname.toLowerCase();
    if (/(?:^|[.-])(?:pooler|pgbouncer)(?:[.-]|$)/.test(hostname)) {
      errors.push('DIRECT_URL must use a direct database host, not a pooler');
    }
    if (url.searchParams.getAll('pgbouncer').some(value => value.toLowerCase() === 'true')) {
      errors.push('DIRECT_URL must not enable pgbouncer');
    }
  }
}

function decodedDatabaseIdentity(env, key, errors) {
  const value = configuredValue(env, key);
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;

  try {
    const schemaValues = url.searchParams.getAll('schema');
    if (schemaValues.length > 1) {
      errors.push(`${key} must not configure the database schema more than once`);
      return null;
    }
    if (schemaValues.length === 1 && !schemaValues[0]) {
      errors.push(`${key} must not configure an empty database schema`);
      return null;
    }
    return {
      username: decodeURIComponent(url.username),
      databaseName: decodeURIComponent(url.pathname.slice(1)),
      hostname: url.hostname.toLowerCase().replace(/\.+$/, ''),
      port: url.port || '5432',
      schema: schemaValues.length === 0 ? 'public' : schemaValues[0],
    };
  } catch {
    errors.push(`${key} must contain valid URL-encoded database credentials and name`);
    return null;
  }
}

function normalizedDatabaseClusterHost(hostname) {
  // Neon uses the same endpoint label with an explicit `-pooler` marker for
  // pooled connections. Do not guess at any other provider's host mapping.
  if (/^[^.]+-pooler(?:\..+)?\.neon\.tech$/.test(hostname)) {
    return hostname.replace(/^([^.]+)-pooler\./, '$1.');
  }
  return hostname;
}

function validateDatabaseCoherence(env, errors) {
  const runtime = decodedDatabaseIdentity(env, 'DATABASE_URL', errors);
  const direct = decodedDatabaseIdentity(env, 'DIRECT_URL', errors);
  if (!runtime || !direct) return;

  if (runtime.databaseName !== direct.databaseName) {
    errors.push('DATABASE_URL and DIRECT_URL must use the same decoded database name');
  }
  if (runtime.username !== direct.username) {
    errors.push('DATABASE_URL and DIRECT_URL must use the same decoded database username');
  }
  if (normalizedDatabaseClusterHost(runtime.hostname)
    !== normalizedDatabaseClusterHost(direct.hostname)) {
    errors.push('DATABASE_URL and DIRECT_URL must target the same database host');
  }
  if (runtime.port !== direct.port) {
    errors.push('DATABASE_URL and DIRECT_URL must use the same database port');
  }
  if (runtime.schema !== direct.schema) {
    errors.push('DATABASE_URL and DIRECT_URL must use the same database schema');
  }
}

function validateHttpsUrl(env, key, errors, { allowUsername = false } = {}) {
  const value = configuredValue(env, key);
  if (!value) return;
  const url = parseUrl(value, key, errors);
  if (!url) return;
  if (url.protocol !== 'https:') errors.push(`${key} must use HTTPS`);
  if ((!allowUsername && url.username) || url.password) {
    errors.push(`${key} must not contain credentials`);
  }
}

function validateProviderUrl(env, key, errors, production) {
  const value = configuredValue(env, key);
  if (!value) return;
  const url = parseUrl(value, key, errors);
  if (!url) return;
  if (production && url.protocol !== 'https:') {
    errors.push(`${key} must use HTTPS in production`);
  } else if (!production && !['http:', 'https:'].includes(url.protocol)) {
    errors.push(`${key} must use HTTP or HTTPS`);
  }
  if (url.username || url.password) errors.push(`${key} must not contain credentials`);
}

function validateSecret(env, key, minimumLength, errors) {
  const value = configuredValue(env, key);
  if (!value) return;
  if (value.length < minimumLength) {
    errors.push(`${key} must contain at least ${minimumLength} characters`);
  }
  if (PLACEHOLDER_SECRET.test(value)) {
    errors.push(`${key} must not use a placeholder or development value`);
  }
}

function validateDistinctSecrets(env, errors) {
  const keys = [
    'JWT_SECRET',
    'JWT_ADMIN_SECRET',
    'CRON_SECRET',
    'IP_HASH_SALT',
    'FLUTTERWAVE_WEBHOOK_HASH',
    'FLUTTERWAVE_SECRET_KEY',
    'NOWPAYMENTS_IPN_SECRET',
    'NOWPAYMENTS_API_KEY',
    'BREVO_API_KEY',
    'MTP_API_KEY',
    'JAP_API_KEY',
    'DAOSMM_API_KEY',
    'GOOGLE_CLIENT_SECRET',
    'UPSTASH_REDIS_REST_TOKEN',
    'SENTRY_AUTH_TOKEN',
    'INTERNAL_DASHBOARD_SECRET',
    'HEARTBEAT_SECRET',
    'ANALYTICS_READ_TOKEN',
  ];
  const owners = new Map();
  for (const key of keys) {
    const value = configuredValue(env, key);
    if (!value) continue;
    const previous = owners.get(value);
    if (previous) errors.push(`${key} must not reuse ${previous}`);
    else owners.set(value, key);
  }
}

function validateRedisPair(env, errors) {
  const url = configuredValue(env, 'UPSTASH_REDIS_REST_URL');
  const token = configuredValue(env, 'UPSTASH_REDIS_REST_TOKEN');
  if (Boolean(url) !== Boolean(token)) {
    errors.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together');
  }
  if (url) validateHttpsUrl(env, 'UPSTASH_REDIS_REST_URL', errors);
}

function validateSentry(env, errors, phase) {
  // A Sentry DSN intentionally carries its public key in URL.username, but it
  // must never contain a password/private credential.
  validateHttpsUrl(env, 'NEXT_PUBLIC_SENTRY_DSN', errors, { allowUsername: true });
  if (phase !== 'build') return;
  for (const key of ['SENTRY_ORG', 'SENTRY_PROJECT']) {
    const value = configuredValue(env, key);
    if (value && !/^[a-zA-Z0-9_-]+$/.test(value)) {
      errors.push(`${key} must contain only letters, numbers, underscores, or hyphens`);
    }
  }
}

export class EnvironmentValidationError extends Error {
  constructor(errors, phase) {
    super(
      `Invalid ${phase} environment configuration:\n${errors.map(error => `  - ${error}`).join('\n')}`,
    );
    this.name = 'EnvironmentValidationError';
    this.errors = [...errors];
    this.phase = phase;
  }
}

/**
 * Validate Nitro configuration without ever including secret values in errors.
 * Unit tests and the development runtime skip production-only requirements;
 * production runtimes and production builds fail closed.
 */
export function validateEnv({
  env = process.env,
  phase = 'runtime',
  production = env.NODE_ENV === 'production',
} = {}) {
  if (!['runtime', 'build'].includes(phase)) {
    throw new TypeError('Environment validation phase must be runtime or build');
  }

  const errors = [];
  validateSurroundingWhitespace(env, errors);
  const required = production
    ? (phase === 'build' ? PRODUCTION_BUILD_REQUIRED : PRODUCTION_RUNTIME_REQUIRED)
    : (phase === 'runtime' && env.NODE_ENV === 'development'
      ? DEVELOPMENT_RUNTIME_REQUIRED
      : []);

  for (const key of required) {
    if (!configuredValue(env, key)) errors.push(`${key} is required`);
  }

  validateApplicationUrl(env, errors, production);
  validateDatabaseUrl(env, 'DATABASE_URL', errors, production);
  validateDatabaseUrl(env, 'DIRECT_URL', errors, production);
  validateDatabaseCoherence(env, errors);
  validateRedisPair(env, errors);
  validateSentry(env, errors, phase);
  for (const key of HTTPS_ENDPOINT_KEYS) validateProviderUrl(env, key, errors, production);

  if (production) {
    for (const [key, minimumLength] of Object.entries(SECRET_REQUIREMENTS)) {
      validateSecret(env, key, minimumLength, errors);
    }
    validateDistinctSecrets(env, errors);
  }

  if (errors.length > 0) throw new EnvironmentValidationError(errors, phase);
  return { ok: true, phase, production };
}

export function validateProductionEnv(env = process.env, { phase = 'build' } = {}) {
  return validateEnv({ env, phase, production: true });
}

export function shouldValidateProductionBuild(env = process.env) {
  return env.NITRO_VALIDATE_PRODUCTION_ENV === '1'
    || env.VERCEL_ENV === 'production';
}

export function validateProductionBuildEnv(env = process.env) {
  if (!shouldValidateProductionBuild(env)) {
    return { ok: true, phase: 'build', production: false, skipped: true };
  }
  return validateProductionEnv(env, { phase: 'build' });
}
