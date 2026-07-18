import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  acquireProviderQueryLease,
  isReservedProviderQueryLeaseKey,
  providerQueryLeaseKey,
  releaseProviderQueryLease,
  renewProviderQueryLease,
} from '@/lib/provider-query-lease';

function uniqueConstraintError() {
  return Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
}

function leaseDatabase() {
  let row = null;
  const db = {
    idempotencyKey: {
      create: vi.fn(async ({ data }) => {
        if (row) throw uniqueConstraintError();
        row = { ...data };
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        if (!row || row.key !== where.key) return { count: 0 };
        if (where.batchId && row.batchId !== where.batchId) return { count: 0 };
        if (where.status && row.status !== where.status) return { count: 0 };
        if (where.expiresAt?.lte && row.expiresAt > where.expiresAt.lte) return { count: 0 };
        if (where.expiresAt?.gt && row.expiresAt <= where.expiresAt.gt) return { count: 0 };
        row = { ...row, ...data };
        return { count: 1 };
      }),
      deleteMany: vi.fn(async ({ where }) => {
        if (
          !row
          || row.key !== where.key
          || row.batchId !== where.batchId
          || row.status !== where.status
        ) {
          return { count: 0 };
        }
        row = null;
        return { count: 1 };
      }),
    },
  };
  return { db, current: () => row && { ...row } };
}

const startedAt = new Date('2026-07-17T10:00:00.000Z');

describe('provider query lease', () => {
  it('uses a reserved key without touching a Transaction idempotency key', () => {
    const key = providerQueryLeaseKey('Flutterwave', 'tx-1');
    expect(key).toBe('payment:provider-query:flutterwave:tx-1');
    expect(isReservedProviderQueryLeaseKey(key)).toBe(true);
    expect(isReservedProviderQueryLeaseKey('customer-generated-key')).toBe(false);
  });

  it('rejects the reserved namespace before the public bulk endpoint queries it', () => {
    const source = readFileSync(
      new URL('../app/api/orders/bulk/route.js', import.meta.url),
      'utf8',
    );
    const guardAt = source.indexOf('if (isReservedProviderQueryLeaseKey(idempotencyKey))');
    const lookupAt = source.indexOf('prisma.idempotencyKey.findUnique');

    expect(guardAt).toBeGreaterThan(0);
    expect(lookupAt).toBeGreaterThan(guardAt);
  });

  it('deduplicates a live cross-process lease', async () => {
    const { db, current } = leaseDatabase();
    const first = await acquireProviderQueryLease({
      provider: 'flutterwave',
      resourceId: 'tx-1',
      userId: 'user-1',
      leaseMs: 30_000,
      now: startedAt,
      token: 'worker-a',
      db,
    });
    const second = await acquireProviderQueryLease({
      provider: 'flutterwave',
      resourceId: 'tx-1',
      userId: 'user-1',
      leaseMs: 30_000,
      now: new Date(startedAt.getTime() + 1_000),
      token: 'worker-b',
      db,
    });

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(false);
    expect(current().batchId).toBe('worker-a');
  });

  it('reclaims an expired lease after a crashed worker', async () => {
    const { db, current } = leaseDatabase();
    const first = await acquireProviderQueryLease({
      provider: 'flutterwave', resourceId: 'tx-1', userId: 'user-1',
      leaseMs: 5_000, now: startedAt, token: 'worker-a', db,
    });
    const second = await acquireProviderQueryLease({
      provider: 'flutterwave', resourceId: 'tx-1', userId: 'user-1',
      leaseMs: 30_000, now: new Date(startedAt.getTime() + 5_001), token: 'worker-b', db,
    });

    expect(first.acquired).toBe(true);
    expect(second.acquired).toBe(true);
    expect(current().batchId).toBe('worker-b');
  });

  it('prevents an expired owner from applying results or releasing its successor', async () => {
    const { db, current } = leaseDatabase();
    const first = await acquireProviderQueryLease({
      provider: 'flutterwave', resourceId: 'tx-1', userId: 'user-1',
      leaseMs: 5_000, now: startedAt, token: 'worker-a', db,
    });
    const takeoverTime = new Date(startedAt.getTime() + 5_001);
    const second = await acquireProviderQueryLease({
      provider: 'flutterwave', resourceId: 'tx-1', userId: 'user-1',
      leaseMs: 30_000, now: takeoverTime, token: 'worker-b', db,
    });

    await expect(renewProviderQueryLease(first, {
      leaseMs: 30_000,
      now: takeoverTime,
      db,
    })).resolves.toBe(false);
    await expect(releaseProviderQueryLease(first, { db })).resolves.toBe(false);
    expect(current().batchId).toBe('worker-b');
    await expect(releaseProviderQueryLease(second, { db })).resolves.toBe(true);
    expect(current()).toBeNull();
  });

  it('renews only the current unexpired owner before result application', async () => {
    const { db, current } = leaseDatabase();
    const lease = await acquireProviderQueryLease({
      provider: 'flutterwave', resourceId: 'tx-1', userId: 'user-1',
      leaseMs: 5_000, now: startedAt, token: 'worker-a', db,
    });
    const renewalTime = new Date(startedAt.getTime() + 1_000);

    await expect(renewProviderQueryLease(lease, {
      leaseMs: 30_000,
      now: renewalTime,
      db,
    })).resolves.toBe(true);
    expect(current().expiresAt).toEqual(new Date(renewalTime.getTime() + 30_000));
  });
});
