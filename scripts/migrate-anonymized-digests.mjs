import { createHash } from 'node:crypto';

export const SCRIPT_OPERATION = 'migrate-anonymized-digests';

const TOMBSTONE_EMAIL_RE = /^deleted-([a-f0-9]+)@accounts\.invalid$/;
const TARGET_LENGTH = 16;
const KNOWN_SOURCE_LENGTHS = [10, 64];

export function digest(userId, length) {
  return createHash('sha256')
    .update(`nitro-account-deletion:v1:${userId}`)
    .digest('hex')
    .slice(0, length);
}

function tombstones(userId, length) {
  const d = digest(userId, length);
  return {
    email: `deleted-${d}@accounts.invalid`,
    referralCode: `deleted-${d}.invalid`,
    password: `!deleted:${d}`,
    closureReference: `ACCOUNT-CLOSURE-${d}`,
    closureIdempotencyKey: `account-closure:${d}`,
    pointsClosureDedupeKey: `account-closure-points:${d}`,
  };
}

function detectEmailSourceLength(email, userId) {
  const match = email.match(TOMBSTONE_EMAIL_RE);
  if (!match) return null;
  const hex = match[1];
  if (hex.length === TARGET_LENGTH && hex === digest(userId, TARGET_LENGTH)) {
    return 'already_migrated';
  }
  for (const len of KNOWN_SOURCE_LENGTHS) {
    if (hex.length === len && hex === digest(userId, len)) return len;
  }
  return null;
}

function allSourceTombstones(userId) {
  return KNOWN_SOURCE_LENGTHS.map(len => tombstones(userId, len));
}

export async function main({ prisma, dryRun = true, logger = console }) {
  const users = await prisma.user.findMany({
    where: { anonymizedAt: { not: null } },
    select: { id: true, email: true },
  });

  logger.log(`Found ${users.length} anonymized user(s)`);
  if (users.length === 0) return { migrated: 0, skipped: 0 };

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const emailSource = detectEmailSourceLength(user.email, user.id);
    const next = tombstones(user.id, TARGET_LENGTH);
    const sources = allSourceTombstones(user.id);
    const emailNeedsMigration = emailSource !== null && emailSource !== 'already_migrated';

    if (emailSource === null) {
      logger.log(`  [skip] user ${user.id}: email does not match any known tombstone format`);
      skipped++;
      continue;
    }

    if (dryRun) {
      const label = emailNeedsMigration
        ? `${emailSource}-char email → ${TARGET_LENGTH}-char`
        : 'email already migrated, checking financial keys';
      logger.log(`  [dry] user ${user.id}: ${label}`);
      migrated++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      if (emailNeedsMigration) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: next.email,
            password: next.password,
            referralCode: next.referralCode,
          },
        });
      }

      await tx.transaction.updateMany({
        where: {
          userId: user.id,
          type: 'account_closure',
          reference: { not: next.closureReference },
          OR: sources.map(s => ({ reference: s.closureReference })),
        },
        data: { reference: next.closureReference },
      });

      await tx.transaction.updateMany({
        where: {
          userId: user.id,
          type: 'account_closure',
          idempotencyKey: { not: next.closureIdempotencyKey },
          OR: sources.map(s => ({ idempotencyKey: s.closureIdempotencyKey })),
        },
        data: { idempotencyKey: next.closureIdempotencyKey },
      });

      await tx.nitroPointLedger.updateMany({
        where: {
          userId: user.id,
          type: 'account_closure',
          dedupeKey: { not: next.pointsClosureDedupeKey },
          OR: sources.map(s => ({ dedupeKey: s.pointsClosureDedupeKey })),
        },
        data: { dedupeKey: next.pointsClosureDedupeKey },
      });
    });

    const label = emailNeedsMigration ? 'user + financial keys' : 'financial keys only';
    logger.log(`  [done] user ${user.id}: migrated ${label} → ${TARGET_LENGTH}-char`);
    migrated++;
  }

  logger.log(`Migrated ${migrated}, skipped ${skipped}`);
  return { migrated, skipped };
}

export function prepareMigration({ env = process.env } = {}) {
  const mode = (env.DIGEST_MIGRATION_MODE || 'dry-run').trim();
  if (!['dry-run', 'apply'].includes(mode)) {
    throw new Error('DIGEST_MIGRATION_MODE must be dry-run or apply.');
  }
  if (mode === 'apply') {
    const confirm = (env.DIGEST_MIGRATION_CONFIRM || '').trim();
    if (confirm !== 'yes-migrate-digests') {
      throw new Error(
        'Set DIGEST_MIGRATION_CONFIRM=yes-migrate-digests to apply this migration.',
      );
    }
  }
  return { dryRun: mode !== 'apply' };
}

const isMain = import.meta.url === (await import('node:url')).pathToFileURL(
  (await import('node:path')).resolve(process.argv[1] || ''),
).href;

if (isMain) {
  const { dryRun } = prepareMigration();
  console.log(`[migrate-anonymized-digests] mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await main({ prisma, dryRun });
  } finally {
    await prisma.$disconnect();
  }
}
