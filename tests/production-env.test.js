import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EnvironmentValidationError,
  getApplicationUrl,
  getIpHashSalt,
  validateEnv,
  validateProductionBuildEnv,
  validateProductionEnv,
} from '../lib/env.js';

function strongSecret(label, length = 48) {
  return `${label}-${'x'.repeat(length)}`;
}

function validProductionEnv() {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://nitro:password@ep-nitro-pooler.eu-west-2.aws.neon.tech:5432/nitro?sslmode=require',
    DIRECT_URL: 'postgresql://nitro:password@ep-nitro.eu-west-2.aws.neon.tech:5432/nitro?sslmode=require',
    NEXT_PUBLIC_APP_URL: 'https://nitro.example',
    JWT_SECRET: strongSecret('customer-jwt'),
    JWT_ADMIN_SECRET: strongSecret('admin-jwt'),
    CRON_SECRET: strongSecret('cron'),
    GOOGLE_CLIENT_ID: '123456789.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: strongSecret('google'),
    UPSTASH_REDIS_REST_URL: 'https://redis.example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: strongSecret('redis'),
    FLUTTERWAVE_WEBHOOK_HASH: strongSecret('flutterwave'),
    NOWPAYMENTS_IPN_SECRET: strongSecret('nowpayments'),
    BREVO_API_KEY: strongSecret('brevo'),
    MTP_API_KEY: strongSecret('mtp'),
    JAP_API_KEY: strongSecret('jap'),
    DAOSMM_API_KEY: strongSecret('dao'),
    NEXT_PUBLIC_SENTRY_DSN: 'https://public-key@o123.ingest.sentry.io/456',
    IP_HASH_SALT: strongSecret('ip-hash'),
    SENTRY_ORG: 'nitro-org',
    SENTRY_PROJECT: 'nitro-web',
    SENTRY_AUTH_TOKEN: strongSecret('sentry-upload'),
  };
}

describe('production environment validation', () => {
  it('accepts a complete production build configuration', () => {
    expect(validateProductionEnv(validProductionEnv(), { phase: 'build' })).toEqual({
      ok: true,
      phase: 'build',
      production: true,
    });
  });

  it('keeps build-only Sentry upload credentials out of the runtime profile', () => {
    const env = validProductionEnv();
    delete env.SENTRY_ORG;
    delete env.SENTRY_PROJECT;
    delete env.SENTRY_AUTH_TOKEN;

    expect(validateProductionEnv(env, { phase: 'runtime' })).toMatchObject({
      ok: true,
      phase: 'runtime',
    });
    expect(() => validateProductionEnv(env, { phase: 'build' }))
      .toThrow(/SENTRY_ORG is required/);
  });

  it('reports every missing production variable without exposing configured values', () => {
    const sensitiveValue = 'sensitive-production-value';
    const env = {
      NODE_ENV: 'production',
      JWT_SECRET: sensitiveValue,
    };

    let thrown;
    try {
      validateProductionEnv(env, { phase: 'build' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EnvironmentValidationError);
    expect(thrown.message).toContain('DATABASE_URL is required');
    expect(thrown.message).toContain('NEXT_PUBLIC_APP_URL is required');
    expect(thrown.message).toContain('SENTRY_AUTH_TOKEN is required');
    expect(thrown.message).toContain('JWT_SECRET must contain at least 32 characters');
    expect(thrown.message).not.toContain(sensitiveValue);
  });

  it('rejects local or malformed production endpoints', () => {
    const env = {
      ...validProductionEnv(),
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000/dashboard?from=config',
      DATABASE_URL: 'postgresql://nitro:password@127.0.0.1:5432/nitro',
      DIRECT_URL: 'mysql://nitro:password@direct.db.internal:3306/nitro',
      UPSTASH_REDIS_REST_URL: 'http://redis.internal',
      NEXT_PUBLIC_SENTRY_DSN: 'http://sentry.internal/123',
    };

    expect(() => validateProductionEnv(env, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'NEXT_PUBLIC_APP_URL must use HTTPS in production',
          'NEXT_PUBLIC_APP_URL must be an origin without a path, query, or fragment',
          'NEXT_PUBLIC_APP_URL must not point to a local host in production',
          'DATABASE_URL must not point to a local database in production',
          'DIRECT_URL must use the postgres or postgresql protocol',
          'UPSTASH_REDIS_REST_URL must use HTTPS',
          'NEXT_PUBLIC_SENTRY_DSN must use HTTPS',
        ]),
      }),
    );
  });

  it('rejects bracketed IPv6 loopback application and database URLs in production', () => {
    const env = {
      ...validProductionEnv(),
      NEXT_PUBLIC_APP_URL: 'https://[::1]',
      DATABASE_URL: 'postgresql://nitro:password@[::1]:5432/nitro?sslmode=require',
      DIRECT_URL: 'postgresql://nitro:password@[::1]:5432/nitro?sslmode=require',
    };

    expect(() => validateProductionEnv(env, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'NEXT_PUBLIC_APP_URL must not point to a local host in production',
          'DATABASE_URL must not point to a local database in production',
          'DIRECT_URL must not point to a local database in production',
        ]),
      }),
    );
    expect(() => getApplicationUrl(env))
      .toThrow(/must not point to a local host in production/);
  });

  it.each([
    'https://localhost.',
    'https://api.localhost',
    'https://127.0.0.2',
    'https://127.255.255.255',
    'https://[0:0:0:0:0:0:0:1]',
    'https://[::ffff:127.0.0.2]',
    'https://[::ffff:7f7f:ffff]',
  ])('rejects production application loopback variant %s', value => {
    expect(() => getApplicationUrl({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: value,
    })).toThrow(/must not point to a local host in production/);
  });

  it.each([
    'postgresql://nitro:password@localhost.:5432/nitro?sslmode=require',
    'postgresql://nitro:password@db.localhost:5432/nitro?sslmode=require',
    'postgresql://nitro:password@127.0.0.2:5432/nitro?sslmode=require',
    'postgresql://nitro:password@[::ffff:127.0.0.2]:5432/nitro?sslmode=require',
  ])('rejects production database loopback variant %s', value => {
    expect(() => validateProductionEnv({
      ...validProductionEnv(),
      DATABASE_URL: value,
    }, { phase: 'build' })).toThrow(/DATABASE_URL must not point to a local database/);
  });

  it('rejects partial Redis configuration, placeholder secrets, and secret reuse', () => {
    const env = {
      ...validProductionEnv(),
      UPSTASH_REDIS_REST_TOKEN: '',
      GOOGLE_CLIENT_SECRET: 'change-me-google-secret',
      JWT_ADMIN_SECRET: strongSecret('shared'),
      CRON_SECRET: strongSecret('shared'),
    };

    expect(() => validateProductionEnv(env, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'UPSTASH_REDIS_REST_TOKEN is required',
          'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured together',
          'GOOGLE_CLIENT_SECRET must not use a placeholder or development value',
          'CRON_SECRET must not reuse JWT_ADMIN_SECRET',
        ]),
      }),
    );
  });

  it('rejects credentials in Upstash URLs and passwords in Sentry DSNs', () => {
    const env = {
      ...validProductionEnv(),
      UPSTASH_REDIS_REST_URL: 'https://user:password@redis.example.upstash.io',
      NEXT_PUBLIC_SENTRY_DSN: 'https://public-key:private-value@sentry.example/123',
    };

    expect(() => validateProductionEnv(env, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'UPSTASH_REDIS_REST_URL must not contain credentials',
          'NEXT_PUBLIC_SENTRY_DSN must not contain credentials',
        ]),
      }),
    );
  });

  it('validates optional DB-managed gateway environment fallbacks when supplied', () => {
    const env = {
      ...validProductionEnv(),
      FLUTTERWAVE_SECRET_KEY: 'change-me',
      FLUTTERWAVE_PUBLIC_KEY: 'short',
      NOWPAYMENTS_API_KEY: 'development-secret',
    };

    expect(() => validateProductionEnv(env, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'FLUTTERWAVE_SECRET_KEY must contain at least 16 characters',
          'FLUTTERWAVE_SECRET_KEY must not use a placeholder or development value',
          'FLUTTERWAVE_PUBLIC_KEY must contain at least 8 characters',
          'NOWPAYMENTS_API_KEY must not use a placeholder or development value',
        ]),
      }),
    );
  });

  it('requires supplied provider endpoints to use HTTPS without URL credentials', () => {
    const env = {
      ...validProductionEnv(),
      MTP_API_URL: 'http://morethanpanel.example/api/v2',
      JAP_API_URL: 'https://api-user:api-password@jap.example/api/v2',
      DAOSMM_API_URL: 'not-a-url',
    };

    expect(() => validateProductionEnv(env, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'MTP_API_URL must use HTTPS in production',
          'JAP_API_URL must not contain credentials',
          'DAOSMM_API_URL must be a valid absolute URL',
        ]),
      }),
    );
  });

  it('allows credential-free HTTP mock provider endpoints outside production', () => {
    expect(validateEnv({
      env: {
        NODE_ENV: 'test',
        MTP_API_URL: 'http://127.0.0.1:4101/api/v2',
        JAP_API_URL: 'http://localhost:4102/mock',
        DAOSMM_API_URL: 'https://provider.example/api/v2',
      },
      phase: 'runtime',
    })).toMatchObject({ ok: true, production: false });
  });

  it('validates an optional analytics token for strength, placeholders, and secret reuse', () => {
    expect(() => validateProductionEnv({
      ...validProductionEnv(),
      ANALYTICS_READ_TOKEN: 'change-me',
    }, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'ANALYTICS_READ_TOKEN must contain at least 32 characters',
          'ANALYTICS_READ_TOKEN must not use a placeholder or development value',
        ]),
      }),
    );

    const reused = validProductionEnv();
    reused.ANALYTICS_READ_TOKEN = reused.CRON_SECRET;
    expect(() => validateProductionEnv(reused, { phase: 'build' }))
      .toThrow(/ANALYTICS_READ_TOKEN must not reuse CRON_SECRET/);
  });

  it('rejects surrounding whitespace before trimmed values can diverge from runtime auth', () => {
    const secret = strongSecret('whitespace-sensitive');
    const env = {
      ...validProductionEnv(),
      CRON_SECRET: ` ${secret}`,
      MTP_API_URL: 'https://morethanpanel.example/api/v2 ',
    };

    let thrown;
    try {
      validateProductionEnv(env, { phase: 'build' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      errors: expect.arrayContaining([
        'CRON_SECRET must not contain surrounding whitespace',
        'MTP_API_URL must not contain surrounding whitespace',
      ]),
    });
    expect(thrown.message).not.toContain(secret);
  });

  it('requires obsolete URL aliases, when present, to agree with the canonical origin', () => {
    const env = {
      ...validProductionEnv(),
      NEXT_PUBLIC_BASE_URL: 'https://old.example',
    };

    expect(() => validateProductionEnv(env, { phase: 'build' }))
      .toThrow(/NEXT_PUBLIC_BASE_URL must match NEXT_PUBLIC_APP_URL exactly/);
  });

  it('only enforces the production build profile when explicitly marked', () => {
    expect(validateProductionBuildEnv({ NODE_ENV: 'production' })).toMatchObject({
      ok: true,
      skipped: true,
      production: false,
    });
    expect(() => validateProductionBuildEnv({ VERCEL_ENV: 'production' }))
      .toThrow(/DATABASE_URL is required/);
    expect(() => validateProductionBuildEnv({ NITRO_VALIDATE_PRODUCTION_ENV: '1' }))
      .toThrow(/DATABASE_URL is required/);
  });

  it('requires named, TLS-protected production databases and a direct migration connection', () => {
    const missingName = {
      ...validProductionEnv(),
      DATABASE_URL: 'postgresql://nitro:password@primary.db.internal/?sslmode=require',
    };
    expect(() => validateProductionEnv(missingName, { phase: 'build' }))
      .toThrow(/DATABASE_URL must include a database name/);

    const weakTls = {
      ...validProductionEnv(),
      DATABASE_URL: 'postgresql://nitro:password@primary.db.internal:5432/nitro?sslmode=prefer',
    };
    expect(() => validateProductionEnv(weakTls, { phase: 'build' }))
      .toThrow(/DATABASE_URL must set sslmode=require or sslmode=verify-full/);

    const pooledDirect = {
      ...validProductionEnv(),
      DIRECT_URL: 'postgresql://nitro:password@ep-example-pooler.neon.tech:5432/nitro?sslmode=require&pgbouncer=true',
    };
    expect(() => validateProductionEnv(pooledDirect, { phase: 'build' })).toThrow(
      expect.objectContaining({
        errors: expect.arrayContaining([
          'DIRECT_URL must use a direct database host, not a pooler',
          'DIRECT_URL must not enable pgbouncer',
        ]),
      }),
    );
  });

  it.each([
    [
      'database name',
      'postgresql://nitro:password@ep-nitro.eu-west-2.aws.neon.tech:5432/other?sslmode=require',
      /same decoded database name/,
    ],
    [
      'database username',
      'postgresql://other-user:password@ep-nitro.eu-west-2.aws.neon.tech:5432/nitro?sslmode=require',
      /same decoded database username/,
    ],
    [
      'non-Neon host',
      'postgresql://nitro:password@different.db.example:5432/nitro?sslmode=require',
      /same database host/,
    ],
    [
      'database schema',
      'postgresql://nitro:password@ep-nitro.eu-west-2.aws.neon.tech:5432/nitro?sslmode=require&schema=private',
      /same database schema/,
    ],
  ])('rejects a DIRECT_URL targeting a different %s', (_label, directUrl, pattern) => {
    expect(() => validateProductionEnv({
      ...validProductionEnv(),
      DIRECT_URL: directUrl,
    }, { phase: 'build' })).toThrow(pattern);
  });

  it('compares decoded database names and usernames', () => {
    expect(validateProductionEnv({
      ...validProductionEnv(),
      DATABASE_URL: 'postgresql://nitro%2Dapp:password@ep-nitro-pooler.eu-west-2.aws.neon.tech:5432/nitro%2Dprod?sslmode=require',
      DIRECT_URL: 'postgresql://nitro-app:password@ep-nitro.eu-west-2.aws.neon.tech:5432/nitro-prod?sslmode=require',
    }, { phase: 'build' })).toMatchObject({ ok: true, production: true });
  });

  it('normalizes an absent Prisma schema query parameter to public', () => {
    expect(validateProductionEnv({
      ...validProductionEnv(),
      DATABASE_URL: `${validProductionEnv().DATABASE_URL}&schema=public`,
    }, { phase: 'build' })).toMatchObject({ ok: true, production: true });
  });

  it('rejects empty or repeated Prisma schema query parameters', () => {
    const base = validProductionEnv();
    expect(() => validateProductionEnv({
      ...base,
      DIRECT_URL: `${base.DIRECT_URL}&schema=`,
    }, { phase: 'build' })).toThrow(/must not configure an empty database schema/);
    expect(() => validateProductionEnv({
      ...base,
      DIRECT_URL: `${base.DIRECT_URL}&schema=public&schema=public`,
    }, { phase: 'build' })).toThrow(/must not configure the database schema more than once/);
  });

  it('keeps ordinary test and local build validation workable', () => {
    expect(validateEnv({ env: { NODE_ENV: 'test' }, phase: 'runtime' }))
      .toMatchObject({ ok: true, production: false });
    expect(validateEnv({ env: { NODE_ENV: 'production' }, phase: 'build', production: false }))
      .toMatchObject({ ok: true, production: false });
  });

  it('provides a fail-closed production validation command', () => {
    const script = fileURLToPath(new URL('../scripts/validate-production-env.mjs', import.meta.url));
    const passing = spawnSync(process.execPath, [script], {
      env: validProductionEnv(),
      encoding: 'utf8',
    });
    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('Production environment validation passed.');

    const sensitiveValue = 'sensitive-runtime-value';
    const failing = spawnSync(process.execPath, [script], {
      env: { NODE_ENV: 'production', JWT_SECRET: sensitiveValue },
      encoding: 'utf8',
    });
    expect(failing.status).toBe(1);
    expect(failing.stderr).toContain('DATABASE_URL is required');
    expect(failing.stderr).not.toContain(sensitiveValue);
  });
});

describe('canonical application URL', () => {
  it('uses localhost only outside production when no URL is configured', () => {
    expect(getApplicationUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(() => getApplicationUrl({ NODE_ENV: 'production' }))
      .toThrow(/NEXT_PUBLIC_APP_URL is required/);
  });

  it('normalizes a configured origin and rejects unsafe production values', () => {
    expect(getApplicationUrl({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://Nitro.Example',
    })).toBe('https://nitro.example');

    expect(() => getApplicationUrl({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    })).toThrow(/must use HTTPS|must not point to a local host/);
  });

  it('is the sole URL source for production links and callback consumers', () => {
    const routes = [
      'app/api/auth/forgot-password/route.js',
      'app/api/pit/auth/forgot-password/route.js',
      'app/api/auth/google/route.js',
      'app/api/auth/google/callback/route.js',
      'app/api/payments/initialize/route.js',
      'app/api/payments/crypto/route.js',
      'app/api/pit/team/route.js',
      'app/api/cron/orders/route.js',
    ];

    for (const relativePath of routes) {
      const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
      expect(source, `${relativePath} must use the canonical URL resolver`)
        .toMatch(/\bgetApplicationUrl\s*\(/);
      expect(source, `${relativePath} must not retain a localhost production-link fallback`)
        .not.toMatch(/NEXT_PUBLIC_(?:APP_URL|BASE_URL|URL)\s*\|\|/);
    }

    const config = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
    expect(config).toMatch(/validateProductionBuildEnv\s*\(\s*\)/);
    expect(config).toMatch(/getApplicationUrl\s*\(/);
    expect(config).toMatch(/disable:\s*process\.env\.GITHUB_ACTIONS\s*===\s*['"]true['"]/);
  });
});

describe('IP hash salt resolution', () => {
  it('uses an explicit development-only salt outside production', () => {
    expect(getIpHashSalt({ NODE_ENV: 'test' })).toBe('nitro-development-ip-hash-salt');
  });

  it('fails closed on missing or weak production salts', () => {
    expect(() => getIpHashSalt({ NODE_ENV: 'production' }))
      .toThrow(/IP_HASH_SALT is required/);
    expect(() => getIpHashSalt({ NODE_ENV: 'production', IP_HASH_SALT: 'change-me' }))
      .toThrow(/IP_HASH_SALT must contain at least 32 characters/);
  });

  it('is used by both click-recording entry points without a literal fallback', () => {
    for (const relativePath of ['app/go/[slug]/route.js', 'app/api/click/route.js']) {
      const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
      expect(source).toMatch(/\bgetIpHashSalt\s*\(/);
      expect(source).not.toContain('nitro-click-default-salt');
    }
  });
});
