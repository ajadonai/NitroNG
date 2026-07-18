import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';

const LEASE_KEY_PREFIX = 'payment:provider-query:';
const LEASE_STATUS = 'processing';
const DEFAULT_LEASE_MS = 30_000;
const MIN_LEASE_MS = 5_000;
const MAX_LEASE_MS = 120_000;

export function isReservedProviderQueryLeaseKey(value) {
  return typeof value === 'string' && value.startsWith(LEASE_KEY_PREFIX);
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function normalizedLeaseMs(value) {
  if (!Number.isFinite(value)) return DEFAULT_LEASE_MS;
  return Math.min(MAX_LEASE_MS, Math.max(MIN_LEASE_MS, Math.ceil(value)));
}

export function providerQueryLeaseKey(provider, resourceId) {
  const safeProvider = String(provider || '').trim().toLowerCase();
  const safeResourceId = String(resourceId || '').trim();
  if (!safeProvider || !safeResourceId) {
    throw new TypeError('Provider and resource ID are required for a query lease');
  }
  return `${LEASE_KEY_PREFIX}${safeProvider}:${safeResourceId}`;
}

/**
 * Atomically acquires a short-lived, cross-process provider-query lease.
 *
 * A unique insert wins a new lease. If a prior worker crashed, updateMany can
 * replace that lease only after its expiry. The random owner token prevents an
 * older worker from releasing a newer worker's lease after a takeover.
 */
export async function acquireProviderQueryLease({
  provider,
  resourceId,
  userId,
  leaseMs = DEFAULT_LEASE_MS,
  now = new Date(),
  db = prisma,
  token = randomUUID(),
} = {}) {
  if (!userId) throw new TypeError('User ID is required for a query lease');

  const key = providerQueryLeaseKey(provider, resourceId);
  const expiresAt = new Date(now.getTime() + normalizedLeaseMs(leaseMs));
  const data = {
    key,
    userId,
    batchId: token,
    status: LEASE_STATUS,
    expiresAt,
  };

  try {
    await db.idempotencyKey.create({ data });
    return { acquired: true, key, token, expiresAt };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
  }

  const takeover = await db.idempotencyKey.updateMany({
    where: {
      key,
      expiresAt: { lte: now },
    },
    data: {
      userId,
      batchId: token,
      status: LEASE_STATUS,
      expiresAt,
    },
  });
  if (takeover.count > 0) return { acquired: true, key, token, expiresAt };

  // The old row may have been released between our insert and takeover. One
  // final insert closes that harmless race without ever stealing a live lease.
  try {
    await db.idempotencyKey.create({ data });
    return { acquired: true, key, token, expiresAt };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return { acquired: false, key, token: null, expiresAt: null };
  }
}

export async function releaseProviderQueryLease(lease, { db = prisma } = {}) {
  if (!lease?.acquired || !lease.key || !lease.token) return false;
  const released = await db.idempotencyKey.deleteMany({
    where: {
      key: lease.key,
      batchId: lease.token,
      status: LEASE_STATUS,
    },
  });
  return released.count > 0;
}

/**
 * Fences result application. A worker may use a provider response only if it
 * still owns an unexpired lease, and renewal keeps another worker from taking
 * over while the short database finalization step runs.
 */
export async function renewProviderQueryLease(lease, {
  leaseMs = DEFAULT_LEASE_MS,
  now = new Date(),
  db = prisma,
} = {}) {
  if (!lease?.acquired || !lease.key || !lease.token) return false;
  const renewed = await db.idempotencyKey.updateMany({
    where: {
      key: lease.key,
      batchId: lease.token,
      status: LEASE_STATUS,
      expiresAt: { gt: now },
    },
    data: {
      expiresAt: new Date(now.getTime() + normalizedLeaseMs(leaseMs)),
    },
  });
  return renewed.count > 0;
}
