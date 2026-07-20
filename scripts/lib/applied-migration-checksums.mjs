const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_MIGRATION_NAME = /^(?:0_init|\d{14}_[a-z0-9_]+)$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function safeMigrationName(value) {
  return typeof value === 'string' && SAFE_MIGRATION_NAME.test(value)
    ? value
    : '<invalid migration name>';
}

/**
 * Compare Prisma's successful, non-rolled-back migration history with the
 * repository's immutable checksum manifest.
 *
 * The comparison is exact in both directions. A database-only migration,
 * manifest-only migration, duplicate successful row, or checksum difference
 * fails the release gate. Digest values are deliberately never included in
 * errors so deployment logs cannot become a source of database metadata.
 */
export function validateAppliedMigrationChecksums({
  manifest,
  appliedMigrations,
  allowPending = false,
} = {}) {
  const errors = [];

  if (!isObject(manifest)) {
    return ['migration checksum manifest must be a JSON object'];
  }
  if (manifest.algorithm !== 'sha256') {
    errors.push('migration checksum manifest algorithm must be sha256');
  }
  if (!isObject(manifest.migrations)) {
    errors.push('migration checksum manifest must contain a migrations object');
    return errors;
  }
  if (!Array.isArray(appliedMigrations)) {
    errors.push('applied migration history must be an array');
    return errors;
  }

  const expectedNames = Object.keys(manifest.migrations).sort();
  const expectedNameSet = new Set(expectedNames);
  const seen = new Set();

  for (const name of expectedNames) {
    if (!SAFE_MIGRATION_NAME.test(name)) {
      errors.push('migration checksum manifest contains an invalid migration name');
      continue;
    }
    if (!SHA256.test(manifest.migrations[name])) {
      errors.push(`${name} has an invalid sha256 checksum in the manifest`);
    }
  }

  for (const row of appliedMigrations) {
    if (!isObject(row)
      || typeof row.migration_name !== 'string'
      || typeof row.checksum !== 'string') {
      errors.push('database migration history contains a malformed row');
      continue;
    }

    const name = row.migration_name;
    const safeName = safeMigrationName(name);
    if (!SAFE_MIGRATION_NAME.test(name)) {
      errors.push('database migration history contains an invalid migration name');
      continue;
    }
    if (seen.has(name)) {
      errors.push(`${safeName} has multiple successful migration history rows`);
      continue;
    }
    seen.add(name);

    if (!expectedNameSet.has(name)) {
      errors.push(`${safeName} is applied in the database but absent from the checksum manifest`);
      continue;
    }
    if (!SHA256.test(row.checksum)) {
      errors.push(`${safeName} has an invalid checksum in the database migration history`);
      continue;
    }
    const fileChecksum = manifest.migrations[name];
    const overrideChecksum = manifest.appliedOverrides?.[name];
    if (row.checksum !== fileChecksum && row.checksum !== overrideChecksum) {
      errors.push(`${safeName} checksum differs from the immutable manifest`);
    }
  }

  if (!allowPending) {
    for (const name of expectedNames) {
      if (SAFE_MIGRATION_NAME.test(name) && !seen.has(name)) {
        errors.push(`${name} has not been successfully applied to the database`);
      }
    }
  }

  return errors;
}
