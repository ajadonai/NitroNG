import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';
import {
  getFlutterwaveSecretKey,
  reconcileFlutterwaveDeposit,
} from '@/lib/flutterwave-payment';
import {
  getNowPaymentsApiKey,
  NOWPAYMENTS_RECONCILABLE_STATUSES,
  reconcileNowPaymentsDeposit,
} from '@/lib/nowpayments-payment';

const RECOVERY_PROVIDER_TIMEOUT_MS = 8_000;
const RECOVERY_CONCURRENCY = 4;
const RECOVERY_ROTATION_SLOT_MS = 5 * 60 * 1000;
const RECOVERY_BUCKET_LIMITS = Object.freeze({
  flutterwavePending: 4,
  flutterwaveProcessing: 3,
  flutterwaveExpired: 3,
  cryptoUnsettled: 3,
  cryptoReviewedAudit: 1,
  cryptoCompletedAudit: 1,
});

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

async function findRotatingPaymentBucket({
  where,
  limit,
  slot,
  orderBy = FLUTTERWAVE_RECOVERY_ORDER,
}) {
  const eligibleCount = await prisma.transaction.count({ where });
  if (eligibleCount === 0) return [];

  if (eligibleCount <= limit) {
    return prisma.transaction.findMany({
      where,
      take: limit,
      orderBy,
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
      orderBy,
    }),
    prisma.transaction.findMany({
      where,
      skip: rotatingSkip,
      take: rotatingLimit,
      orderBy,
    }),
  ]);
  return [...newest, ...rotatingWindow];
}

export async function recoverStalePendingPayments({ now = new Date() } = {}) {
  const nowMs = now.getTime();
  const rotationSlot = Math.floor(nowMs / RECOVERY_ROTATION_SLOT_MS);
  const twoMinAgo = new Date(nowMs - 2 * 60 * 1000);
  const fifteenMinAgo = new Date(nowMs - 15 * 60 * 1000);
  const sixHoursAgo = new Date(nowMs - 6 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(nowMs - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);

  const abandoned = await prisma.transaction.updateMany({
    where: {
      type: 'deposit',
      status: 'Pending',
      createdAt: { lt: twentyFourHoursAgo },
      OR: [{ method: 'flutterwave' }, { method: null }],
    },
    data: { status: 'Cancelled' },
  });
  if (abandoned.count > 0) {
    log.info('Payment Recovery', `Cancelled ${abandoned.count} abandoned Flutterwave deposit(s) older than 24h`);
  }

  // Reserve capacity for each state so a backlog of old retryable deposits
  // cannot crowd newer Pending or legacy Processing deposits out of every run.
  // A rotating window prevents the same rows from monopolizing those reserved
  // places, while each bucket also keeps one place for its newest eligible row.
  const [
    flutterwavePending,
    flutterwaveProcessing,
    flutterwaveExpired,
    cryptoUnsettled,
    cryptoReviewedAudit,
    cryptoCompletedAudit,
  ] = await Promise.all([
    findRotatingPaymentBucket({
      where: {
        type: 'deposit',
        status: 'Pending',
        createdAt: { gt: twentyFourHoursAgo, lt: fifteenMinAgo },
        OR: [{ method: 'flutterwave' }, { method: null }],
      },
      limit: RECOVERY_BUCKET_LIMITS.flutterwavePending,
      slot: rotationSlot,
    }),
    findRotatingPaymentBucket({
      where: {
        type: 'deposit',
        status: 'Processing',
        createdAt: { gt: thirtyDaysAgo, lt: twoMinAgo },
        OR: [{ method: 'flutterwave' }, { method: null }],
      },
      limit: RECOVERY_BUCKET_LIMITS.flutterwaveProcessing,
      slot: rotationSlot,
    }),
    findRotatingPaymentBucket({
      where: {
        type: 'deposit',
        status: 'Expired',
        createdAt: { gt: thirtyDaysAgo, lt: fifteenMinAgo },
        OR: [{ method: 'flutterwave' }, { method: null }],
      },
      limit: RECOVERY_BUCKET_LIMITS.flutterwaveExpired,
      slot: rotationSlot,
    }),
    findRotatingPaymentBucket({
      where: {
        type: 'deposit',
        method: 'crypto',
        status: {
          in: NOWPAYMENTS_RECONCILABLE_STATUSES,
          notIn: ['Review', 'Rejected'],
        },
        createdAt: { gt: thirtyDaysAgo, lt: fifteenMinAgo },
      },
      limit: RECOVERY_BUCKET_LIMITS.cryptoUnsettled,
      slot: rotationSlot,
    }),
    prisma.transaction.findMany({
      where: {
        type: 'deposit',
        method: 'crypto',
        status: { in: ['Review', 'Rejected'] },
        createdAt: { gt: thirtyDaysAgo, lt: fifteenMinAgo },
        AND: [
          {
            OR: [
              { providerPaymentId: { not: null } },
              { note: { contains: '[np:' } },
            ],
          },
          {
            OR: [
              { paymentReconciliationAttemptAt: null },
              { paymentReconciliationAttemptAt: { lt: sixHoursAgo } },
            ],
          },
        ],
      },
      take: RECOVERY_BUCKET_LIMITS.cryptoReviewedAudit,
      orderBy: [
        {
          paymentReconciliationAttemptAt: {
            sort: 'asc',
            nulls: 'first',
          },
        },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    }),
    prisma.transaction.findMany({
      where: {
        type: 'deposit',
        method: 'crypto',
        status: 'Completed',
        createdAt: { gt: thirtyDaysAgo },
        AND: [
          {
            OR: [
              { providerPaymentId: { not: null } },
              { note: { contains: '[np:' } },
            ],
          },
          {
            OR: [
              { paymentReconciliationAttemptAt: null },
              { paymentReconciliationAttemptAt: { lt: sixHoursAgo } },
            ],
          },
        ],
      },
      take: RECOVERY_BUCKET_LIMITS.cryptoCompletedAudit,
      orderBy: [
        {
          paymentReconciliationAttemptAt: {
            sort: 'asc',
            nulls: 'first',
          },
        },
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
    }),
  ]);

  const staleTxns = interleaveBuckets([
    flutterwavePending,
    flutterwaveProcessing,
    flutterwaveExpired,
    cryptoUnsettled,
    cryptoReviewedAudit,
    cryptoCompletedAudit,
  ]);

  const stats = {
    checked: staleTxns.length,
    recovered: 0,
    alreadyCredited: 0,
    pending: 0,
    verifying: 0,
    retryable: 0,
    failed: 0,
    review: 0,
    refunded: 0,
    abandoned: abandoned.count,
    audited: cryptoCompletedAudit.length,
    reviewAudited: cryptoReviewedAudit.length,
    // Retained for response compatibility. Phase 4 preserves expired rows so
    // late confirmations can still be reconciled safely.
    expired: 0,
    errors: [],
  };
  if (staleTxns.length === 0) return stats;

  let flutterwaveSecretKeyPromise;
  let nowPaymentsApiKeyPromise;

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

      if (gateway === 'crypto') {
        nowPaymentsApiKeyPromise ||= getNowPaymentsApiKey();
        const apiKey = await nowPaymentsApiKeyPromise;
        if (!apiKey) {
          log.warn('Payment Recovery', 'NOWPayments verification key is not configured');
        }

        const result = await reconcileNowPaymentsDeposit({
          transaction: tx,
          apiKey: apiKey || '',
          recoveredBy: 'cron',
          timeoutMs: RECOVERY_PROVIDER_TIMEOUT_MS,
          auditCompleted: tx.status === 'Completed',
          ...(tx.status === 'Rejected' ? { auditRejected: true } : {}),
          now,
        });

        if (result.paymentState === 'credited') {
          if (result.newlyFinalized && result.finalization) {
            stats.recovered++;
            log.info('Payment Recovery', `Recovered crypto deposit ${tx.reference}`);
            try {
              await notifyDepositFinalized(result.finalization, { channel: 'Crypto' });
            } catch (notifyError) {
              stats.errors.push(`${tx.reference}: notification failed: ${notifyError.message}`);
              log.warn('Payment Recovery notifications', `${tx.reference}: ${notifyError.message}`);
            }
          } else {
            stats.alreadyCredited++;
          }
        } else if (result.paymentState === 'review') {
          stats.review++;
        } else if (result.paymentState === 'provider_pending') {
          stats.pending++;
        } else if (result.paymentState === 'verifying') {
          stats.verifying++;
        } else if (result.paymentState === 'retryable') {
          stats.retryable++;
        } else if (result.paymentState === 'failed') {
          if (result.reason === 'refunded' || result.transactionStatus === 'Refunded') {
            stats.refunded++;
          } else {
            stats.failed++;
          }
        } else {
          stats.retryable++;
          stats.errors.push(`${tx.reference}: unknown reconciliation state`);
        }
      }
    } catch (err) {
      stats.errors.push(`${tx.reference}: ${err.message}`);
      log.error('Payment Recovery', `Failed to recover ${tx.reference}: ${err.message}`);
    }
  });

  log.info(
    'Payment Recovery',
    `Checked ${stats.checked}: ${stats.recovered} recovered, ${stats.alreadyCredited} already credited, ${stats.pending} pending, ${stats.retryable} retryable, ${stats.failed} failed, ${stats.review} in review, ${stats.refunded} refunded`,
  );
  return stats;
}
