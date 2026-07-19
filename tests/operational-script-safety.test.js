import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  operationalScriptConfirmation,
  prepareGuardedScript,
  runGuardedPrismaScript,
} from '../scripts/lib/guarded-operation.mjs';
import {
  loadTestConfirmation,
  main as runLoadTest,
  prepareLoadTest,
} from '../scripts/load-test.js';

const SAFE_ENV = Object.freeze({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://nitro:local-password@127.0.0.1:5432/nitro_dev',
  NITRO_SCRIPT_DATABASE_NAME: 'nitro_dev',
});

describe('operational script target guard', () => {
  it('defaults to dry-run and returns a command-and-database-specific confirmation', () => {
    const result = prepareGuardedScript({
      operation: 'cleanup-seed-data',
      env: SAFE_ENV,
    });

    expect(result).toEqual({
      operation: 'cleanup-seed-data',
      databaseName: 'nitro_dev',
      dryRun: true,
      expectedConfirmation: 'APPLY_CLEANUP_SEED_DATA_TO_nitro_dev',
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('requires both apply mode and the exact per-command confirmation', () => {
    const expected = operationalScriptConfirmation('migrate-display-ids', 'nitro_dev');
    const applyEnv = { ...SAFE_ENV, NITRO_SCRIPT_MODE: 'apply' };

    expect(() => prepareGuardedScript({ operation: 'migrate-display-ids', env: applyEnv }))
      .toThrow(`NITRO_SCRIPT_CONFIRM=${expected}`);
    expect(() => prepareGuardedScript({
      operation: 'migrate-display-ids',
      env: { ...applyEnv, NITRO_SCRIPT_CONFIRM: 'APPLY_CLEANUP_SEED_DATA_TO_nitro_dev' },
    })).toThrow(`NITRO_SCRIPT_CONFIRM=${expected}`);

    expect(prepareGuardedScript({
      operation: 'migrate-display-ids',
      env: { ...applyEnv, NITRO_SCRIPT_CONFIRM: expected },
    })).toMatchObject({ dryRun: false, expectedConfirmation: expected });
  });

  it.each([
    ['production mode', { NODE_ENV: 'production' }, /NODE_ENV must be development or test/],
    ['Vercel', { VERCEL: '1' }, /cannot run inside Vercel/],
    ['a remote database', { DATABASE_URL: 'postgresql://nitro:password@db.example.com/nitro_dev' }, /loopback host/],
    ['a non-PostgreSQL URL', { DATABASE_URL: 'mysql://nitro:password@127.0.0.1/nitro_dev' }, /must use PostgreSQL/],
    ['connection overrides', { DATABASE_URL: 'postgresql://nitro:password@127.0.0.1/nitro_dev?host=db.example.com' }, /connection overrides/],
    ['an unsafe database name', {
      DATABASE_URL: 'postgresql://nitro:password@127.0.0.1/postgres',
      NITRO_SCRIPT_DATABASE_NAME: 'postgres',
    }, /database name must end/],
    ['a mismatched approval', { NITRO_SCRIPT_DATABASE_NAME: 'nitro_test' }, /must exactly match/],
    ['an unknown mode', { NITRO_SCRIPT_MODE: 'live' }, /must be dry-run or apply/],
  ])('refuses %s before Prisma is created', async (_label, override, pattern) => {
    const prismaFactory = vi.fn();
    const env = { ...SAFE_ENV, ...override };

    await expect(runGuardedPrismaScript({
      operation: 'seed-test-user',
      env,
      main: vi.fn(),
      logger: { log: vi.fn() },
      prismaFactory,
    })).rejects.toThrow(pattern);
    expect(prismaFactory).not.toHaveBeenCalled();
  });

  it('never includes database credentials in a refusal', () => {
    const password = 'do-not-print-this-password';
    const env = {
      ...SAFE_ENV,
      DATABASE_URL: `postgresql://nitro:${password}@db.example.com/nitro_dev`,
    };

    let error;
    try {
      prepareGuardedScript({ operation: 'cleanup-seed-data', env });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain(password);
    expect(error.message).not.toContain(env.DATABASE_URL);
  });

  it('passes dry-run state to the script and always disconnects the injected client', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const prisma = { $disconnect: disconnect };
    const main = vi.fn().mockResolvedValue('previewed');

    await expect(runGuardedPrismaScript({
      operation: 'fix-ntr-1578',
      env: SAFE_ENV,
      main,
      logger: { log: vi.fn() },
      prismaFactory: vi.fn().mockResolvedValue(prisma),
    })).resolves.toBe('previewed');

    expect(main).toHaveBeenCalledWith(expect.objectContaining({
      prisma,
      dryRun: true,
    }));
    expect(disconnect).toHaveBeenCalledOnce();
  });
});

describe('tracked mutating script entrypoints', () => {
  const scripts = [
    ['cleanup-seed-data.js', 'cleanup-seed-data'],
    ['fix-ntr-1578.mjs', 'fix-ntr-1578'],
    ['migrate-ids.mjs', 'migrate-display-ids'],
    ['seed-testuser.js', 'seed-test-user'],
    ['seed-blog.cjs', 'seed-blog-content'],
    ['backfill-referral-attribution.mjs', 'backfill-referral-attribution'],
  ];

  it.each(scripts)('%s uses the shared guard before its first mutation', (filename, operation) => {
    const source = readFileSync(new URL(`../scripts/${filename}`, import.meta.url), 'utf8');
    const firstDryRunFence = source.indexOf('if (dryRun)');
    const firstMutation = source.search(/\.(?:create|createMany|update|updateMany|delete|deleteMany|\$transaction)\s*\(/);

    expect(source).toContain('runGuardedPrismaScript');
    expect(source).toContain(`SCRIPT_OPERATION = '${operation}'`);
    expect(source).not.toMatch(/new\s+PrismaClient\s*\(/);
    expect(source).not.toMatch(/\bmain\s*\(\s*\)\s*\.catch/);
    expect(firstDryRunFence).toBeGreaterThan(-1);
    expect(firstMutation).toBeGreaterThan(firstDryRunFence);
  });

  it('can import every guarded script without opening a database connection', async () => {
    for (const [filename, operation] of scripts) {
      const module = await import(new URL(`../scripts/${filename}`, import.meta.url));
      const exports = module.SCRIPT_OPERATION ? module : module.default;
      expect(exports.SCRIPT_OPERATION).toBe(operation);
      expect(exports.main).toBeTypeOf('function');
    }
  });

  it('keeps the completed launch-weekend financial backfill non-executable', async () => {
    const relativePath = '../scripts/backfill-nitro-launch-weekend-points.mjs';
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    const module = await import(new URL(relativePath, import.meta.url));

    expect(module.EXECUTION_RETIRED).toBe(true);
    expect(() => module.refuseRetiredExecution()).toThrow(/retired and cannot be executed/);
    expect(source).not.toMatch(/PrismaClient|CONFIRM\s*===?\s*['"]1['"]/);
    expect(source).not.toMatch(/\.(?:create|createMany|update|updateMany|delete|deleteMany|\$transaction)\s*\(/);
  });
});

describe('HTTP load-test safety', () => {
  const TARGET = 'https://staging.nitro.example';
  const SAFE_LOAD_ENV = Object.freeze({
    NITRO_LOAD_TEST_TARGET: TARGET,
    NITRO_LOAD_TEST_MODE: 'apply',
    NITRO_LOAD_TEST_CONFIRM: `APPLY_LOAD_TEST_TO_${TARGET}`,
    TEST_EMAIL: 'load-test@example.test',
    TEST_PASSWORD: 'dedicated-test-password',
  });

  it('requires an exact non-production target, apply mode, and target-bound confirmation', () => {
    expect(loadTestConfirmation(TARGET)).toBe(`APPLY_LOAD_TEST_TO_${TARGET}`);
    expect(prepareLoadTest({ env: SAFE_LOAD_ENV })).toEqual({
      target: TARGET,
      email: 'load-test@example.test',
      password: 'dedicated-test-password',
      expectedConfirmation: `APPLY_LOAD_TEST_TO_${TARGET}`,
    });

    expect(() => prepareLoadTest({ env: {} })).toThrow(/there is no default/);
    expect(() => prepareLoadTest({
      env: { ...SAFE_LOAD_ENV, NITRO_LOAD_TEST_MODE: 'dry-run' },
    })).toThrow(/MODE must be apply/);
    expect(() => prepareLoadTest({
      env: { ...SAFE_LOAD_ENV, NITRO_LOAD_TEST_CONFIRM: 'APPLY_LOAD_TEST_TO_https:\/\/other.example' },
    })).toThrow(/for this exact target/);
  });

  it.each([
    'https://nitro.ng',
    'https://www.nitro.ng',
    'https://admin.nitro.ng',
    'https://nitro.ng.',
    'https://thenitro.ng',
    'https://preview.thenitro.ng',
  ])('permanently refuses the production domain %s', target => {
    expect(() => prepareLoadTest({
      env: {
        ...SAFE_LOAD_ENV,
        NITRO_LOAD_TEST_TARGET: target,
        NITRO_LOAD_TEST_CONFIRM: `APPLY_LOAD_TEST_TO_${target}`,
      },
    })).toThrow(/production domains are permanently blocked/);
  });

  it('fails every guard before issuing a login or any other request', async () => {
    const fetchImpl = vi.fn();

    await expect(runLoadTest({
      env: { ...SAFE_LOAD_ENV, NITRO_LOAD_TEST_CONFIRM: '' },
      fetchImpl,
      logger: { log: vi.fn() },
    })).rejects.toThrow(/for this exact target/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses only the confirmed origin and never logs session cookies', async () => {
    const logger = { log: vi.fn() };
    const headers = new Headers({ 'set-cookie': 'session=do-not-log; Path=/; HttpOnly' });
    headers.getSetCookie = () => ['session=do-not-log; Path=/; HttpOnly'];
    const fetchImpl = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'expected test stop' }),
      { status: 401, headers },
    ));

    await expect(runLoadTest({ env: SAFE_LOAD_ENV, fetchImpl, logger }))
      .rejects.toThrow(/without authentication/);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${TARGET}/api/auth/login`,
      expect.objectContaining({ method: 'POST' }),
    );
    expect(logger.log.mock.calls.flat().join('\n')).not.toContain('do-not-log');
  });
});

describe('retired production seed', () => {
  it('preserves the historical payload only as comments with no executable SQL', () => {
    const source = readFileSync(new URL('../scripts/seed-production.sql', import.meta.url), 'utf8');
    const executable = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*--.*$/gm, '')
      .trim();

    expect(source).toContain('RETIRED: historical seed source retained for audit context only');
    expect(source).toContain('NITRO SEED: 6,823 users + ~25,200 orders');
    expect(executable).toBe('');
  });
});
