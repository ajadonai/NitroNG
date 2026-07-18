import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi } from 'vitest';
import {
  SEED_DESTRUCTIVE_CONFIRMATION,
  assertSeedSafety,
  getSeedCredentials,
  runSeed,
  seedDatabase,
} from '../prisma/seed.js';

const safeEnv = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://nitro:local-password@127.0.0.1:5432/nitro_dev',
  NITRO_SEED_DATABASE_NAME: 'nitro_dev',
  NITRO_ALLOW_DESTRUCTIVE_SEED: SEED_DESTRUCTIVE_CONFIRMATION,
  NITRO_SEED_USER_PASSWORD: 'local-user-password',
  NITRO_SEED_ADMIN_PASSWORD: 'local-admin-password',
};

function createFakePrisma() {
  let id = 0;
  const makeModel = () => ({
    deleteMany: vi.fn(async () => ({ count: 0 })),
    create: vi.fn(async () => ({ id: `seed-${++id}` })),
    createMany: vi.fn(async () => ({ count: 0 })),
  });

  return {
    activityLog: makeModel(),
    admin: makeModel(),
    alert: makeModel(),
    blogPost: makeModel(),
    order: makeModel(),
    service: makeModel(),
    setting: makeModel(),
    ticket: makeModel(),
    ticketReply: makeModel(),
    transaction: makeModel(),
    user: makeModel(),
    $disconnect: vi.fn(async () => {}),
  };
}

describe('seed script safety', () => {
  it('accepts an explicitly approved local development database', () => {
    expect(assertSeedSafety(safeEnv)).toEqual({
      databaseName: 'nitro_dev',
      hostname: '127.0.0.1',
    });
  });

  it('accepts an explicitly approved loopback test database', () => {
    expect(assertSeedSafety({
      ...safeEnv,
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://nitro:local-password@[::1]:5432/nitro_test',
      NITRO_SEED_DATABASE_NAME: 'nitro_test',
    })).toEqual({ databaseName: 'nitro_test', hostname: '[::1]' });
  });

  it.each([
    ['missing configuration', {}],
    ['production mode', { ...safeEnv, NODE_ENV: 'production' }],
    ['Vercel', { ...safeEnv, VERCEL: '1' }],
    ['missing confirmation', { ...safeEnv, NITRO_ALLOW_DESTRUCTIVE_SEED: undefined }],
    ['wrong confirmation', { ...safeEnv, NITRO_ALLOW_DESTRUCTIVE_SEED: 'yes' }],
    ['a cloud database', { ...safeEnv, DATABASE_URL: 'postgresql://user:pass@db.example.com/nitro_dev' }],
    ['an IP that is not loopback', { ...safeEnv, DATABASE_URL: 'postgresql://user:pass@10.0.0.4/nitro_dev' }],
    ['a non-PostgreSQL URL', { ...safeEnv, DATABASE_URL: 'mysql://user:pass@localhost/nitro_dev' }],
    ['a URL with connection overrides', { ...safeEnv, DATABASE_URL: 'postgresql://localhost/nitro_dev?host=database.internal' }],
    ['an ambiguous database name', { ...safeEnv, NITRO_SEED_DATABASE_NAME: 'postgres', DATABASE_URL: 'postgresql://localhost/postgres' }],
    ['a database name mismatch', { ...safeEnv, NITRO_SEED_DATABASE_NAME: 'nitro_test' }],
  ])('refuses %s', (_label, env) => {
    expect(() => assertSeedSafety(env)).toThrow(/Seed refused/);
  });

  it('requires caller-supplied user and admin passwords', () => {
    expect(() => getSeedCredentials({})).toThrow(/NITRO_SEED_USER_PASSWORD/);
    expect(() => getSeedCredentials({ NITRO_SEED_USER_PASSWORD: 'long-enough-user' }))
      .toThrow(/NITRO_SEED_ADMIN_PASSWORD/);
    expect(getSeedCredentials(safeEnv)).toEqual({
      userPassword: safeEnv.NITRO_SEED_USER_PASSWORD,
      adminPassword: safeEnv.NITRO_SEED_ADMIN_PASSWORD,
    });
  });

  it('refuses unsafe configuration before creating a Prisma client', async () => {
    const createPrismaClient = vi.fn();

    await expect(runSeed({
      env: { ...safeEnv, DATABASE_URL: 'postgresql://user:pass@database.internal/nitro_dev' },
      createPrismaClient,
    })).rejects.toThrow(/localhost or a loopback address/);

    expect(createPrismaClient).not.toHaveBeenCalled();
  });

  it('refuses missing credentials before creating a Prisma client', async () => {
    const createPrismaClient = vi.fn();

    await expect(runSeed({
      env: { ...safeEnv, NITRO_SEED_ADMIN_PASSWORD: undefined },
      createPrismaClient,
    })).rejects.toThrow(/NITRO_SEED_ADMIN_PASSWORD/);

    expect(createPrismaClient).not.toHaveBeenCalled();
  });

  it('does not print supplied seed passwords', async () => {
    const prisma = createFakePrisma();
    const logger = { log: vi.fn() };
    const hashPassword = vi.fn(async (password) => `hashed:${password}`);

    await seedDatabase(prisma, getSeedCredentials(safeEnv), { logger, hashPassword });

    const output = logger.log.mock.calls.flat().join(' ');
    expect(output).not.toContain(safeEnv.NITRO_SEED_USER_PASSWORD);
    expect(output).not.toContain(safeEnv.NITRO_SEED_ADMIN_PASSWORD);
    expect(hashPassword).toHaveBeenCalledWith(safeEnv.NITRO_SEED_USER_PASSWORD);
    expect(hashPassword).toHaveBeenCalledWith(safeEnv.NITRO_SEED_ADMIN_PASSWORD);
  });

  it('keeps the blog seed script syntactically valid', () => {
    const scriptPath = fileURLToPath(new URL('../scripts/seed-blog.cjs', import.meta.url));
    const result = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });

    expect(result.status, result.stderr).toBe(0);
  });
});
