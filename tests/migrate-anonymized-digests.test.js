import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { digest, main, prepareMigration } from '../scripts/migrate-anonymized-digests.mjs';

function tombstoneEmail(userId, length) {
  return `deleted-${digest(userId, length)}@accounts.invalid`;
}

function mockPrisma(users) {
  const updates = [];
  const txUpdates = [];
  const ledgerUpdates = [];

  return {
    prisma: {
      user: {
        findMany: vi.fn().mockResolvedValue(users),
      },
      $transaction: vi.fn(async (fn) => {
        const tx = {
          user: {
            update: vi.fn(async (args) => { updates.push(args); }),
          },
          transaction: {
            updateMany: vi.fn(async (args) => { txUpdates.push(args); return { count: 1 }; }),
          },
          nitroPointLedger: {
            updateMany: vi.fn(async (args) => { ledgerUpdates.push(args); return { count: 1 }; }),
          },
        };
        return fn(tx);
      }),
    },
    updates,
    txUpdates,
    ledgerUpdates,
  };
}

const logger = { log: vi.fn() };

describe('migrate-anonymized-digests', () => {
  describe('main', () => {
    it('migrates 10-char records to 16-char', async () => {
      const userId = 'user-10char';
      const { prisma, updates, txUpdates, ledgerUpdates } = mockPrisma([
        { id: userId, email: tombstoneEmail(userId, 10) },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 1, skipped: 0 });
      expect(updates).toHaveLength(1);
      expect(updates[0].data.email).toBe(tombstoneEmail(userId, 16));
      expect(updates[0].data.referralCode).toBe(`deleted-${digest(userId, 16)}.invalid`);
      expect(updates[0].data.password).toBe(`!deleted:${digest(userId, 16)}`);
      expect(txUpdates.find(u => u.data.reference).data.reference).toBe(`ACCOUNT-CLOSURE-${digest(userId, 16)}`);
      expect(txUpdates.find(u => u.data.idempotencyKey).data.idempotencyKey).toBe(`account-closure:${digest(userId, 16)}`);
      expect(ledgerUpdates[0].data.dedupeKey).toBe(`account-closure-points:${digest(userId, 16)}`);
    });

    it('migrates 64-char records to 16-char', async () => {
      const userId = 'user-64char';
      const { prisma, updates, txUpdates, ledgerUpdates } = mockPrisma([
        { id: userId, email: tombstoneEmail(userId, 64) },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 1, skipped: 0 });
      expect(updates).toHaveLength(1);
      expect(updates[0].data.email).toBe(tombstoneEmail(userId, 16));
      expect(txUpdates.find(u => u.data.reference).data.reference).toBe(`ACCOUNT-CLOSURE-${digest(userId, 16)}`);
      expect(ledgerUpdates[0].data.dedupeKey).toBe(`account-closure-points:${digest(userId, 16)}`);
    });

    it('handles hybrid records: email=10-char, financial keys=64-char', async () => {
      const userId = 'user-hybrid';
      const { prisma, updates, txUpdates, ledgerUpdates } = mockPrisma([
        { id: userId, email: tombstoneEmail(userId, 10) },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 1, skipped: 0 });
      expect(updates).toHaveLength(1);
      expect(updates[0].data.email).toBe(tombstoneEmail(userId, 16));

      const refUpdate = txUpdates.find(u => u.data.reference);
      expect(refUpdate.where.OR).toEqual(expect.arrayContaining([
        { reference: `ACCOUNT-CLOSURE-${digest(userId, 10)}` },
        { reference: `ACCOUNT-CLOSURE-${digest(userId, 64)}` },
      ]));
      expect(refUpdate.data.reference).toBe(`ACCOUNT-CLOSURE-${digest(userId, 16)}`);

      const keyUpdate = txUpdates.find(u => u.data.idempotencyKey);
      expect(keyUpdate.where.OR).toEqual(expect.arrayContaining([
        { idempotencyKey: `account-closure:${digest(userId, 10)}` },
        { idempotencyKey: `account-closure:${digest(userId, 64)}` },
      ]));
      expect(keyUpdate.data.idempotencyKey).toBe(`account-closure:${digest(userId, 16)}`);

      const ledgerOr = ledgerUpdates[0].where.OR;
      expect(ledgerOr).toEqual(expect.arrayContaining([
        { dedupeKey: `account-closure-points:${digest(userId, 10)}` },
        { dedupeKey: `account-closure-points:${digest(userId, 64)}` },
      ]));
      expect(ledgerUpdates[0].data.dedupeKey).toBe(`account-closure-points:${digest(userId, 16)}`);
    });

    it('repairs split-field: 16-char reference with old idempotency key', async () => {
      const userId = 'user-split';
      const { prisma, updates, txUpdates } = mockPrisma([
        { id: userId, email: tombstoneEmail(userId, 16) },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 1, skipped: 0 });
      expect(updates).toHaveLength(0);

      const keyUpdate = txUpdates.find(u => u.data.idempotencyKey);
      expect(keyUpdate).toBeDefined();
      expect(keyUpdate.where.OR).toEqual(expect.arrayContaining([
        { idempotencyKey: `account-closure:${digest(userId, 10)}` },
        { idempotencyKey: `account-closure:${digest(userId, 64)}` },
      ]));
      expect(keyUpdate.data.idempotencyKey).toBe(`account-closure:${digest(userId, 16)}`);
    });

    it('migrates financial keys even when email is already 16-char', async () => {
      const userId = 'user-email-done';
      const { prisma, updates, txUpdates, ledgerUpdates } = mockPrisma([
        { id: userId, email: tombstoneEmail(userId, 16) },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 1, skipped: 0 });
      expect(updates).toHaveLength(0);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txUpdates).toHaveLength(2);
      expect(txUpdates.find(u => u.data.reference).data.reference).toBe(`ACCOUNT-CLOSURE-${digest(userId, 16)}`);
      expect(txUpdates.find(u => u.data.idempotencyKey).data.idempotencyKey).toBe(`account-closure:${digest(userId, 16)}`);
      expect(ledgerUpdates).toHaveLength(1);
      expect(ledgerUpdates[0].data.dedupeKey).toBe(`account-closure-points:${digest(userId, 16)}`);
    });

    it('does not treat a forged 16-char email as already migrated', async () => {
      const { prisma, updates } = mockPrisma([
        { id: 'user-forged', email: 'deleted-abcdef1234567890@accounts.invalid' },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 0, skipped: 1 });
      expect(updates).toHaveLength(0);
    });

    it('skips records with unrecognised email format', async () => {
      const { prisma, updates } = mockPrisma([
        { id: 'user-x', email: 'real-user@example.com' },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 0, skipped: 1 });
      expect(updates).toHaveLength(0);
    });

    it('skips records where 10-char digest does not verify against the user ID', async () => {
      const { prisma, updates } = mockPrisma([
        { id: 'user-y', email: 'deleted-0000000000@accounts.invalid' },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 0, skipped: 1 });
      expect(updates).toHaveLength(0);
    });

    it('defaults to dry-run when dryRun is not passed', async () => {
      const userId = 'user-default';
      const { prisma, updates } = mockPrisma([
        { id: userId, email: tombstoneEmail(userId, 10) },
      ]);

      const result = await main({ prisma, logger });

      expect(result).toEqual({ migrated: 1, skipped: 0 });
      expect(updates).toHaveLength(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('dry-run does not write', async () => {
      const userId = 'user-dryrun';
      const { prisma, updates } = mockPrisma([
        { id: userId, email: tombstoneEmail(userId, 10) },
      ]);

      const result = await main({ prisma, dryRun: true, logger });

      expect(result).toEqual({ migrated: 1, skipped: 0 });
      expect(updates).toHaveLength(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('handles a mixed batch of 10-char, 64-char, 16-char, and unknown records', async () => {
      const u10 = 'user-10';
      const u64 = 'user-64';
      const u16 = 'user-16';
      const { prisma } = mockPrisma([
        { id: u10, email: tombstoneEmail(u10, 10) },
        { id: u64, email: tombstoneEmail(u64, 64) },
        { id: u16, email: tombstoneEmail(u16, 16) },
        { id: 'user-unknown', email: 'someone@example.com' },
      ]);

      const result = await main({ prisma, dryRun: false, logger });

      expect(result).toEqual({ migrated: 3, skipped: 1 });
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('returns zero counts when no anonymized users exist', async () => {
      const { prisma } = mockPrisma([]);
      const result = await main({ prisma, dryRun: false, logger });
      expect(result).toEqual({ migrated: 0, skipped: 0 });
    });
  });

  describe('prepareMigration', () => {
    it('defaults to dry-run', () => {
      expect(prepareMigration({ env: {} })).toEqual({ dryRun: true });
    });

    it('accepts explicit dry-run', () => {
      expect(prepareMigration({ env: { DIGEST_MIGRATION_MODE: 'dry-run' } })).toEqual({ dryRun: true });
    });

    it('requires confirmation for apply mode', () => {
      expect(() => prepareMigration({
        env: { DIGEST_MIGRATION_MODE: 'apply' },
      })).toThrow('DIGEST_MIGRATION_CONFIRM=yes-migrate-digests');
    });

    it('rejects wrong confirmation phrase', () => {
      expect(() => prepareMigration({
        env: { DIGEST_MIGRATION_MODE: 'apply', DIGEST_MIGRATION_CONFIRM: 'wrong' },
      })).toThrow('DIGEST_MIGRATION_CONFIRM');
    });

    it('accepts correct confirmation', () => {
      expect(prepareMigration({
        env: { DIGEST_MIGRATION_MODE: 'apply', DIGEST_MIGRATION_CONFIRM: 'yes-migrate-digests' },
      })).toEqual({ dryRun: false });
    });

    it('rejects unknown mode', () => {
      expect(() => prepareMigration({
        env: { DIGEST_MIGRATION_MODE: 'force' },
      })).toThrow('dry-run or apply');
    });
  });
});
