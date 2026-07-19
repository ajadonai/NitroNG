import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const LOCAL_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);
const LOCAL_DATABASE_NAME = /^[a-zA-Z0-9_-]+(?:_local|_dev|_test)$/i;
const OPERATION_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function value(env, key) {
  const configured = env?.[key];
  return typeof configured === 'string' ? configured.trim() : '';
}

function safeOperationName(operation) {
  if (typeof operation !== 'string' || !OPERATION_NAME.test(operation)) {
    throw new TypeError('A lowercase, hyphenated operation name is required.');
  }
  return operation;
}

export function operationalScriptConfirmation(operation, databaseName) {
  const safeOperation = safeOperationName(operation);
  if (typeof databaseName !== 'string' || !LOCAL_DATABASE_NAME.test(databaseName)) {
    throw new TypeError('A local/test database name is required for confirmation.');
  }
  return `APPLY_${safeOperation.replaceAll('-', '_').toUpperCase()}_TO_${databaseName}`;
}

/**
 * Fail closed before an operational script creates a Prisma client.
 *
 * These legacy scripts are intentionally limited to disposable local/test
 * databases. Merely running one is a dry run. Writes require both an explicit
 * apply mode and the operation-and-database-specific confirmation phrase.
 */
export function prepareGuardedScript({ operation, env = process.env } = {}) {
  const safeOperation = safeOperationName(operation);
  const nodeEnv = value(env, 'NODE_ENV');
  if (!['development', 'test'].includes(nodeEnv)) {
    throw new Error('Operational script refused: NODE_ENV must be development or test.');
  }
  if (value(env, 'VERCEL') || value(env, 'VERCEL_ENV')) {
    throw new Error('Operational script refused: scripts cannot run inside Vercel.');
  }

  const rawDatabaseUrl = value(env, 'DATABASE_URL');
  if (!rawDatabaseUrl) {
    throw new Error('Operational script refused: DATABASE_URL is required.');
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error('Operational script refused: DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('Operational script refused: DATABASE_URL must use PostgreSQL.');
  }
  if (!LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname.toLowerCase())) {
    throw new Error('Operational script refused: DATABASE_URL must use a loopback host.');
  }
  if (databaseUrl.search || databaseUrl.hash) {
    throw new Error('Operational script refused: DATABASE_URL cannot contain connection overrides.');
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  } catch {
    throw new Error('Operational script refused: DATABASE_URL contains an invalid database name.');
  }
  if (!databaseName || databaseName.includes('/') || !LOCAL_DATABASE_NAME.test(databaseName)) {
    throw new Error('Operational script refused: database name must end in _local, _dev, or _test.');
  }

  const approvedDatabaseName = value(env, 'NITRO_SCRIPT_DATABASE_NAME');
  if (!approvedDatabaseName || approvedDatabaseName !== databaseName) {
    throw new Error(
      'Operational script refused: NITRO_SCRIPT_DATABASE_NAME must exactly match the URL database.',
    );
  }

  const mode = value(env, 'NITRO_SCRIPT_MODE') || 'dry-run';
  if (!['dry-run', 'apply'].includes(mode)) {
    throw new Error('Operational script refused: NITRO_SCRIPT_MODE must be dry-run or apply.');
  }

  const expectedConfirmation = operationalScriptConfirmation(safeOperation, databaseName);
  if (mode === 'apply' && value(env, 'NITRO_SCRIPT_CONFIRM') !== expectedConfirmation) {
    throw new Error(
      `Operational script refused: set NITRO_SCRIPT_CONFIRM=${expectedConfirmation} for this command.`,
    );
  }

  return Object.freeze({
    operation: safeOperation,
    databaseName,
    dryRun: mode !== 'apply',
    expectedConfirmation,
  });
}

export function isMainModule(metaUrl, argvEntry = process.argv[1]) {
  if (!argvEntry) return false;
  return metaUrl === pathToFileURL(resolve(argvEntry)).href;
}

export async function runGuardedPrismaScript({
  operation,
  main,
  env = process.env,
  logger = console,
  prismaFactory,
} = {}) {
  if (typeof main !== 'function') throw new TypeError('A script main function is required.');

  const guard = prepareGuardedScript({ operation, env });
  logger.log(
    `[safety] ${guard.operation} targeting ${guard.databaseName} in ${guard.dryRun ? 'DRY-RUN' : 'APPLY'} mode`,
  );
  if (guard.dryRun) {
    logger.log(
      `[safety] To apply: NITRO_SCRIPT_MODE=apply NITRO_SCRIPT_CONFIRM=${guard.expectedConfirmation}`,
    );
  }

  const createPrisma = prismaFactory || (async () => {
    const { PrismaClient } = await import('@prisma/client');
    return new PrismaClient();
  });
  const prisma = await createPrisma();
  try {
    return await main({ prisma, dryRun: guard.dryRun, guard, logger });
  } finally {
    await prisma?.$disconnect?.();
  }
}
