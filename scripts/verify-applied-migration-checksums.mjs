import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAppliedMigrationChecksums } from './lib/applied-migration-checksums.mjs';
import { isMainModule } from './lib/guarded-operation.mjs';
import { reportCliOperationalFailure } from './lib/operational-monitoring.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = resolve(root, 'prisma', 'migrations', 'checksums.json');

export async function readSuccessfulAppliedMigrations(prisma) {
  return prisma.$queryRaw`
    SELECT "migration_name", "checksum"
    FROM "_prisma_migrations"
    WHERE "finished_at" IS NOT NULL
      AND "rolled_back_at" IS NULL
    ORDER BY "migration_name" ASC
  `;
}

export async function verifyAppliedMigrationChecksums({
  manifestPath = defaultManifestPath,
  readFileImpl = readFile,
  prismaFactory,
  logger = console,
  allowPending = false,
} = {}) {
  const reportFailure = (reason, data) => reportCliOperationalFailure({
    signal: 'migration_checksum_failed',
    reason,
    data,
    logger,
  });
  let manifest;
  try {
    manifest = JSON.parse(await readFileImpl(manifestPath, 'utf8'));
  } catch {
    logger.error('Applied migration checksum verification failed: unable to read the checksum manifest.');
    reportFailure('manifest_unreadable');
    return false;
  }

  const createPrisma = prismaFactory || (async () => {
    const { PrismaClient } = await import('@prisma/client');
    return new PrismaClient();
  });

  let prisma;
  let passed = false;
  try {
    prisma = await createPrisma();
    const appliedMigrations = await readSuccessfulAppliedMigrations(prisma);
    const errors = validateAppliedMigrationChecksums({
      manifest,
      appliedMigrations,
      allowPending,
    });
    if (errors.length > 0) {
      logger.error(
        `Applied migration checksum verification failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`,
      );
      reportFailure('checksum_mismatch', { errorCount: errors.length });
      return false;
    }

    logger.log(`Applied migration checksum verification passed (${appliedMigrations.length} migrations).`);
    passed = true;
  } catch {
    logger.error('Applied migration checksum verification failed: unable to read migration history.');
    reportFailure('history_unavailable');
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {
        logger.error('Applied migration checksum verification failed: unable to close the database connection.');
        reportFailure('disconnect_failed');
        passed = false;
      }
    }
  }

  return passed;
}

if (isMainModule(import.meta.url)) {
  const passed = await verifyAppliedMigrationChecksums({
    allowPending: process.argv.includes('--allow-pending'),
  });
  if (!passed) process.exitCode = 1;
}
