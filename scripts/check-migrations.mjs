import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateMigrationChecksumManifest } from './lib/migration-checksums.mjs';
import { reportCliOperationalFailure } from './lib/operational-monitoring.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsRoot = join(root, 'prisma', 'migrations');
const lockPath = join(migrationsRoot, 'migration_lock.toml');
const checksumPath = join(migrationsRoot, 'checksums.json');
const requireTracked = process.argv.includes('--require-tracked');
const errors = [];

if (!existsSync(migrationsRoot)) {
  errors.push('prisma/migrations is missing');
}

if (!existsSync(lockPath)) {
  errors.push('prisma/migrations/migration_lock.toml is missing');
} else if (!/^provider\s*=\s*["']postgresql["']\s*$/m.test(readFileSync(lockPath, 'utf8'))) {
  errors.push('prisma/migrations/migration_lock.toml must lock the postgresql provider');
}

const migrationDirectories = existsSync(migrationsRoot)
  ? readdirSync(migrationsRoot)
    .filter((entry) => statSync(join(migrationsRoot, entry)).isDirectory())
    .sort()
  : [];

if (migrationDirectories.length === 0) {
  errors.push('no migration directories were found');
}

const trackedCandidates = [lockPath, checksumPath];
const migrationSql = new Map();
for (const directory of migrationDirectories) {
  if (directory !== '0_init' && !/^\d{14}_[a-z0-9_]+$/.test(directory)) {
    errors.push(`${directory} is not a valid migration directory name`);
  }

  const sqlPath = join(migrationsRoot, directory, 'migration.sql');
  trackedCandidates.push(sqlPath);
  if (!existsSync(sqlPath)) {
    errors.push(`${directory}/migration.sql is missing`);
    continue;
  }
  const sql = readFileSync(sqlPath);
  migrationSql.set(directory, sql);
  if (!sql.toString('utf8').trim()) {
    errors.push(`${directory}/migration.sql is empty`);
  }
}

if (!existsSync(checksumPath)) {
  errors.push('prisma/migrations/checksums.json is missing');
} else {
  let checksumManifest;
  try {
    checksumManifest = JSON.parse(readFileSync(checksumPath, 'utf8'));
  } catch {
    errors.push('prisma/migrations/checksums.json must contain valid JSON');
  }
  if (checksumManifest) {
    errors.push(...validateMigrationChecksumManifest({
      migrationDirectories,
      migrationSql,
      manifest: checksumManifest,
    }));
  }
}

if (requireTracked && existsSync(join(root, '.git'))) {
  for (const path of trackedCandidates) {
    const repoPath = relative(root, path);
    const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', repoPath], {
      cwd: root,
      stdio: 'ignore',
    });
    if (result.status !== 0) errors.push(`${repoPath} is not tracked by git`);
  }

  const workflow = '.github/workflows/ci.yml';
  const workflowResult = spawnSync('git', ['ls-files', '--error-unmatch', '--', workflow], {
    cwd: root,
    stdio: 'ignore',
  });
  if (workflowResult.status !== 0) errors.push(`${workflow} is not tracked by git`);
}

if (errors.length > 0) {
  reportCliOperationalFailure({
    signal: 'migration_manifest_failed',
    reason: 'manifest_validation',
    data: { errorCount: errors.length },
  });
  console.error(`Migration manifest check failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exit(1);
}

console.log(`Migration manifest check passed (${migrationDirectories.length} migrations).`);
