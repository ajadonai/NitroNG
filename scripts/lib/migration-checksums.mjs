import { createHash } from 'node:crypto';

const SHA256 = /^[a-f0-9]{64}$/;

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Validate an immutable migration checksum manifest.
 *
 * Key-set equality is deliberate: a migration cannot be added without an
 * explicit manifest entry, and a deleted migration leaves an equally visible
 * stale entry. Existing digest values must never be changed after this
 * baseline is committed.
 */
export function validateMigrationChecksumManifest({
  migrationDirectories,
  migrationSql,
  manifest,
} = {}) {
  const errors = [];
  if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object') {
    return ['migration checksum manifest must be a JSON object'];
  }
  if (manifest.algorithm !== 'sha256') {
    errors.push('migration checksum manifest algorithm must be sha256');
  }
  if (!manifest.migrations
    || Array.isArray(manifest.migrations)
    || typeof manifest.migrations !== 'object') {
    errors.push('migration checksum manifest must contain a migrations object');
    return errors;
  }

  const directories = [...new Set(migrationDirectories || [])].sort();
  const expectedKeys = Object.keys(manifest.migrations).sort();
  const directorySet = new Set(directories);
  const expectedSet = new Set(expectedKeys);

  for (const directory of directories) {
    if (!expectedSet.has(directory)) {
      errors.push(`${directory} is missing from the migration checksum manifest`);
    }
  }
  for (const directory of expectedKeys) {
    if (!directorySet.has(directory)) {
      errors.push(`${directory} is present in the checksum manifest but has no migration directory`);
    }
  }

  for (const directory of directories) {
    if (!expectedSet.has(directory)) continue;
    const expected = manifest.migrations[directory];
    if (typeof expected !== 'string' || !SHA256.test(expected)) {
      errors.push(`${directory} has an invalid sha256 checksum in the manifest`);
      continue;
    }
    const sql = migrationSql?.get?.(directory);
    if (sql === undefined) continue;
    if (sha256(sql) !== expected) {
      errors.push(`${directory}/migration.sql does not match its committed sha256 checksum`);
    }
  }

  return errors;
}
