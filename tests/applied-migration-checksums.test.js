import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { validateAppliedMigrationChecksums } from '../scripts/lib/applied-migration-checksums.mjs';
import {
  readSuccessfulAppliedMigrations,
  verifyAppliedMigrationChecksums,
} from '../scripts/verify-applied-migration-checksums.mjs';

const CHECKSUM_A = 'a'.repeat(64);
const CHECKSUM_B = 'b'.repeat(64);

function manifest(migrations = { '0_init': CHECKSUM_A }) {
  return { algorithm: 'sha256', migrations };
}

function applied(migrationName = '0_init', checksum = CHECKSUM_A) {
  return { migration_name: migrationName, checksum };
}

describe('applied migration checksum validation', () => {
  it('accepts an exact migration-name and checksum match', () => {
    expect(validateAppliedMigrationChecksums({
      manifest: manifest({
        '0_init': CHECKSUM_A,
        '20260719000000_example': CHECKSUM_B,
      }),
      appliedMigrations: [
        applied(),
        applied('20260719000000_example', CHECKSUM_B),
      ],
    })).toEqual([]);
  });

  it('rejects checksum drift without printing either digest', () => {
    const errors = validateAppliedMigrationChecksums({
      manifest: manifest(),
      appliedMigrations: [applied('0_init', CHECKSUM_B)],
    });

    expect(errors).toEqual(['0_init checksum differs from the immutable manifest']);
    expect(errors.join('\n')).not.toContain(CHECKSUM_A);
    expect(errors.join('\n')).not.toContain(CHECKSUM_B);
  });

  it('accepts a DB checksum that matches the file hash even when an appliedOverride exists', () => {
    expect(validateAppliedMigrationChecksums({
      manifest: { algorithm: 'sha256', migrations: { '0_init': CHECKSUM_A }, appliedOverrides: { '0_init': CHECKSUM_B } },
      appliedMigrations: [applied('0_init', CHECKSUM_A)],
    })).toEqual([]);
  });

  it('accepts a DB checksum that matches the appliedOverride', () => {
    expect(validateAppliedMigrationChecksums({
      manifest: { algorithm: 'sha256', migrations: { '0_init': CHECKSUM_A }, appliedOverrides: { '0_init': CHECKSUM_B } },
      appliedMigrations: [applied('0_init', CHECKSUM_B)],
    })).toEqual([]);
  });

  it('rejects a DB checksum matching neither file hash nor appliedOverride', () => {
    const CHECKSUM_C = 'c'.repeat(64);
    const errors = validateAppliedMigrationChecksums({
      manifest: { algorithm: 'sha256', migrations: { '0_init': CHECKSUM_A }, appliedOverrides: { '0_init': CHECKSUM_B } },
      appliedMigrations: [applied('0_init', CHECKSUM_C)],
    });
    expect(errors).toEqual(['0_init checksum differs from the immutable manifest']);
  });

  it('requires exact name equality and rejects duplicate successful rows', () => {
    expect(validateAppliedMigrationChecksums({
      manifest: manifest({
        '0_init': CHECKSUM_A,
        '20260719000000_missing': CHECKSUM_B,
      }),
      appliedMigrations: [
        applied(),
        applied(),
        applied('20260719000000_database_only', CHECKSUM_B),
      ],
    })).toEqual([
      '0_init has multiple successful migration history rows',
      '20260719000000_database_only is applied in the database but absent from the checksum manifest',
      '20260719000000_missing has not been successfully applied to the database',
    ]);
  });

  it('can verify the already-applied subset before deploying pending migrations', () => {
    expect(validateAppliedMigrationChecksums({
      manifest: manifest({
        '0_init': CHECKSUM_A,
        '20260719000000_pending': CHECKSUM_B,
      }),
      appliedMigrations: [applied()],
      allowPending: true,
    })).toEqual([]);

    expect(validateAppliedMigrationChecksums({
      manifest: manifest({ '0_init': CHECKSUM_A }),
      appliedMigrations: [applied('20260719000000_database_only', CHECKSUM_B)],
      allowPending: true,
    })).toContain(
      '20260719000000_database_only is applied in the database but absent from the checksum manifest',
    );
  });

  it('does not reflect an unsafe database migration name into errors', () => {
    const unsafeName = 'bad\u001b[31m\nDATABASE_URL=secret';
    const errors = validateAppliedMigrationChecksums({
      manifest: manifest(),
      appliedMigrations: [applied(unsafeName)],
    });

    expect(errors).toContain('database migration history contains an invalid migration name');
    expect(errors.join('\n')).not.toContain(unsafeName);
  });
});

describe('applied migration checksum CLI', () => {
  it('uses one read-only query limited to successful, non-rolled-back rows', async () => {
    const queryRaw = vi.fn().mockResolvedValue([applied()]);
    await readSuccessfulAppliedMigrations({ $queryRaw: queryRaw });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0].join(' ');
    expect(sql).toMatch(/^\s*SELECT\b/i);
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i);
    expect(sql).toMatch(/"finished_at"\s+IS\s+NOT\s+NULL/i);
    expect(sql).toMatch(/"rolled_back_at"\s+IS\s+NULL/i);
  });

  it('disconnects after a successful check', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([applied()]),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const logger = { log: vi.fn(), error: vi.fn() };

    await expect(verifyAppliedMigrationChecksums({
      readFileImpl: vi.fn().mockResolvedValue(JSON.stringify(manifest())),
      prismaFactory: vi.fn().mockResolvedValue(prisma),
      logger,
    })).resolves.toBe(true);

    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('fails safely and disconnects when the database query rejects', async () => {
    const secretError = new Error('postgresql://operator:password@production.example/nitro');
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(secretError),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const logger = { log: vi.fn(), error: vi.fn() };

    await expect(verifyAppliedMigrationChecksums({
      readFileImpl: vi.fn().mockResolvedValue(JSON.stringify(manifest())),
      prismaFactory: vi.fn().mockResolvedValue(prisma),
      logger,
    })).resolves.toBe(false);

    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      'Applied migration checksum verification failed: unable to read migration history.',
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(secretError.message);
  });
});

describe('applied checksum deployment wiring', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const deploymentGate = readFileSync(
    new URL('../scripts/deployment-gate.mjs', import.meta.url),
    'utf8',
  );
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  it('defines the applied-history verification command', () => {
    expect(packageJson.scripts['migrations:verify:applied']).toBe(
      'node scripts/verify-applied-migration-checksums.mjs',
    );
    expect(packageJson.scripts['migrations:verify:applied:pending']).toBe(
      'node scripts/verify-applied-migration-checksums.mjs --allow-pending',
    );
  });

  it('applies migrations then verifies checksums in the production gate', () => {
    expect(deploymentGate).toMatch(
      /run\('db:deploy'\);\s*run\('db:status'\);\s*run\('migrations:verify:applied'\);/,
    );
  });

  it('runs the verifier after CI migration status and before schema comparison', () => {
    const statusPosition = workflow.indexOf('npm run db:status');
    const checksumPosition = workflow.indexOf('npm run migrations:verify:applied');
    const diffPosition = workflow.indexOf('prisma migrate diff --exit-code');

    expect(statusPosition).toBeGreaterThan(-1);
    expect(checksumPosition).toBeGreaterThan(statusPosition);
    expect(diffPosition).toBeGreaterThan(checksumPosition);
  });
});
