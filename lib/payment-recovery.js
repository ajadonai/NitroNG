import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { finalizeDeposit } from '@/lib/deposit-finalization';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';
import {
  getFlutterwaveSecretKey,
  reconcileFlutterwaveDeposit,
} from '@/lib/flutterwave-payment';

const RECOVERY_PROVIDER_TIMEOUT_MS = 8_000;
const RECOVERY_CONCURRENCY = 4;
const RECOVERY_ROTATION_SLOT_MS = 5 * 60 * 1000;
const RECOVERY_BUCKET_LIMITS = Object.freeze({
  flutterwavePending: 4,
  flutterwaveProcessing: 3,
  flutterwaveExpired: 3,
  cryptoPending: 2,
});

async function verifyNowPayments(reference, timeoutMs = RECOVERY_PROVIDER_TIMEOUT_MS) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) return { paid: false };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const res = await fetch(`https://api.nowpayments.io/v1/payment/${reference}`, {
      headers: { 'x-api-key': apiKey },
      signal: controller.signal,
    });
    if (!res.ok) return { paid: false };
    const data = await res.json();
    if (data.payment_status === 'finished' || data.payment_status === 'confirmed') {
      return { paid: true, actuallyPaid: data.actually_paid };
    }
    if (data.payment_status === 'expired' || data.payment_status === 'failed') {
      return { paid: false, failed: true };
    }
    return { paid: false };
  } finally {
    clearTimeout(timeout);
  }
}

function interleaveBuckets(buckets) {
  const queue = [];
  const largestBucket = Math.max(0, ...buckets.map(bucket => bucket.length));
  for (let index = 0; index < largestBucket; index++) {
    for (const bucket of buckets) {
      if (bucket[index]) queue.push(bucket[index]);
    }
  }
  return queue;
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      await worker(items[currentIndex]);
    }
  });
  await Promise.all(workers);
}

const FLUTTERWAVE_RECOVERY_ORDER = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

async function findRotatingFlutterwaveBucket({ where, limit, slot }) {
  const eligibleCount = await prisma.transaction.count({ where });
  if (eligibleCount === 0) return [];

  if (eligibleCount <= limit) {
    return prisma.transaction.findMany({
      where,
      take: limit,
      orderBy: FLUTTERWAVE_RECOVERY_ORDER,
    });
  }

  // One place is always reserved for the newest row. The rest move through
  // non-overlapping windows, so a stable backlog is fully covered once per
  // rotation without making new deposits wait for the cursor to wrap.
  const rotatingLimit = limit - 1;
  const rotatingCount = eligibleCount - 1;
  const windowCount = Math.ceil(rotatingCount / rotatingLimit);
  const windowIndex = slot % windowCount;
  const rotatingSkip = 1 + (windowIndex * rotatingLimit);
  const [newest, rotatingWindow] = await Promise.all([
    prisma.transaction.findMany({
      where,
      take: 1,
      orderBy: FLUTTERWAVE_RECOVERY_ORDER,
    }),
    prisma.transaction.findMany({
      where,
      skip: rotatingSkip,
      take: rotatingLimit,
      orderBy: FLUTTERWAVE_RECOVERY_ORDER,
    }),
  ]);
  return [...newest, ...rotatingWindow];
}

export async function recoverStalePendingPayments({ now = new Date() } = {}) {
  const nowMs = now.getTime();
  const rotationSlot = Math.floor(nowMs / RECOVERY_ROTATION_SLOT_MS);
  const twoMinAgo = new Date(nowMs - 2 * 60 * 1000);
  const fifteenMinAgo = new Date(nowMs - 15 * 60 * 1000);
  const twentyFourHoursAgo = new Date(nowMs - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);

  // Reserve capacity for each state so a backlog of old retryable deposits
  // cannot crowd newer Pending or legacy Processing deposits out of every run.
  // A rotating window prevents the same rows from monopolizing those reserved
  // places, while each bucket also keeps one place for its newest eligible row.
  const [flutterwavePending, flutterwaveProcessing, flutterwaveExpired, cryptoPending] = await Promise.all([
    findRotatingFlutterwaveBucket({
      where: {
        type: 'deposit',
        status: 'Pending',
        createdAt: { gt: twentyFourHoursAgo, lt: fifteenMinAgo },
        OR: [{ method: 'flutterwave' }, { method: null }],
      },
      limit: RECOVERY_BUCKET_LIMITS.flutterwavePending,
      slot: rotationSlot,
    }),
    findRotatingFlutterwaveBucket({
      where: {
        type: 'deposit',
        status: 'Processing',
        createdAt: { gt: thirtyDaysAgo, lt: twoMinAgo },
        OR: [{ method: 'flutterwave' }, { method: null }],
      },
      limit: RECOVERY_BUCKET_LIMITS.flutterwaveProcessing,
      slot: rotationSlot,
    }),
    findRotatingFlutterwaveBucket({
      where: {
        type: 'deposit',
        status: 'Expired',
        createdAt: { gt: thirtyDaysAgo, lt: fifteenMinAgo },
        OR: [{ method: 'flutterwave' }, { method: null }],
      },
      limit: RECOVERY_BUCKET_LIMITS.flutterwaveExpired,
      slot: rotationSlot,
    }),
    prisma.transaction.findMany({
      where: {
        type: 'deposit',
        method: 'crypto',
        status: 'Pending',
        createdAt: { gt: twentyFourHoursAgo, lt: fifteenMinAgo },
      },
      take: RECOVERY_BUCKET_LIMITS.cryptoPending,
      // Keep the existing oldest-first crypto recovery priority until Phase 4.
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const staleTxns = interleaveBuckets([
    flutterwavePending,
    flutterwaveProcessing,
    flutterwaveExpired,
    cryptoPending,
  ]);

  const stats = {
    checked: staleTxns.length,
    recovered: 0,
    alreadyCredited: 0,
    pending: 0,
    verifying: 0,
    retryable: 0,
    failed: 0,
    // Kept for the existing crypto recovery response until Phase 4 owns it.
    expired: 0,
    errors: [],
  };
  if (staleTxns.length === 0) return stats;

  let flutterwaveSecretKeyPromise;

  await runWithConcurrency(staleTxns, RECOVERY_CONCURRENCY, async tx => {
    try {
      const gateway = tx.method || 'flutterwave';

      if (gateway === 'flutterwave') {
        flutterwaveSecretKeyPromise ||= getFlutterwaveSecretKey();
        const secretKey = await flutterwaveSecretKeyPromise;
        if (!secretKey) {
          log.warn('Payment Recovery', 'Flutterwave verification key is not configured');
        }

        const result = await reconcileFlutterwaveDeposit({
          transaction: tx,
          secretKey: secretKey || '',
          recoveredBy: 'cron',
          timeoutMs: RECOVERY_PROVIDER_TIMEOUT_MS,
        });

        if (result.paymentState === 'credited') {
          if (result.newlyFinalized && result.finalization) {
            stats.recovered++;
            log.info('Payment Recovery', `Recovered Flutterwave deposit ${tx.reference}`);
            try {
              await notifyDepositFinalized(result.finalization, { channel: 'Flutterwave' });
            } catch (notifyError) {
              stats.errors.push(`${tx.reference}: notification failed: ${notifyError.message}`);
              log.warn('Payment Recovery notifications', `${tx.reference}: ${notifyError.message}`);
            }
          } else {
            stats.alreadyCredited++;
          }
        } else if (result.paymentState === 'provider_pending') {
          stats.pending++;
        } else if (result.paymentState === 'verifying') {
          stats.verifying++;
        } else if (result.paymentState === 'retryable') {
          stats.retryable++;
        } else if (result.paymentState === 'failed') {
          stats.failed++;
        } else {
          stats.retryable++;
          stats.errors.push(`${tx.reference}: unknown reconciliation state`);
        }
        return;
      }

      // Preserve the legacy crypto recovery path until Phase 4 replaces its
      // provider validation. Its terminal write is status-guarded so it cannot
      // overwrite a concurrent Completed deposit.
      if (gateway === 'crypto') {
        const result = await verifyNowPayments(tx.reference, RECOVERY_PROVIDER_TIMEOUT_MS);
        if (result.paid) {
          const finalized = await finalizeDeposit({
            transactionId: tx.id,
            paidAmountKobo: tx.amount,
            claimableStatuses: ['Pending'],
            recoveredBy: 'cron',
          });
          if (finalized.finalized) {
            stats.recovered++;
            log.info('Payment Recovery', `Recovered crypto deposit ${tx.reference}`);
            try {
              await notifyDepositFinalized(finalized, { channel: 'Crypto' });
            } catch (notifyError) {
              stats.errors.push(`${tx.reference}: notification failed: ${notifyError.message}`);
              log.warn('Payment Recovery notifications', `${tx.reference}: ${notifyError.message}`);
            }
          } else if (finalized.reason === 'already_completed') {
            stats.alreadyCredited++;
          }
        } else if (result.failed) {
          const cancelled = await prisma.transaction.updateMany({
            where: { id: tx.id, status: 'Pending' },
            data: { status: 'Cancelled', note: `${tx.note || ''} [expired-by-cron]`.trim() },
          });
          stats.expired += cancelled.count;
        } else {
          stats.pending++;
        }
      }
    } catch (err) {
      stats.errors.push(`${tx.reference}: ${err.message}`);
      log.error('Payment Recovery', `Failed to recover ${tx.reference}: ${err.message}`);
    }
  });

  log.info(
    'Payment Recovery',
    `Checked ${stats.checked}: ${stats.recovered} recovered, ${stats.alreadyCredited} already credited, ${stats.pending} pending, ${stats.retryable} retryable, ${stats.failed} failed, ${stats.expired} crypto expired`,
  );
  return stats;
}
