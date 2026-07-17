import { createHash } from 'node:crypto';

// Retention policy: keep the internal user ID, financial amounts/references,
// order/provider facts, points/credit ledgers, timestamps, and accepted Terms
// evidence. Remove customer identity, credentials, tracking/device data, order
// targets, free-form proofs, and session/operational records that are no longer
// needed. The retained rows remain linked only to the anonymised user tombstone.

export const ACCOUNT_DELETION_BATCH_DEFAULT = 100;
export const ACCOUNT_DELETION_BATCH_MAX = 250;
export const ACCOUNT_DELETION_REDACTION = '[redacted: account deleted]';

const ACCOUNT_DELETION_RETRIES = 3;
const ACCOUNT_CLOSURE_PREFIX = 'account-closure:';
const POINTS_CLOSURE_PREFIX = 'account-closure-points:';
const ISSUE_IDENTIFIER_BATCH = 50;

export function isAccountDeletionGraceActive(user, now = new Date()) {
  return user?.status === 'PendingDeletion'
    && user.deletedAt instanceof Date
    && Number.isFinite(user.deletedAt.getTime())
    && user.deletedAt > now;
}

class AccountDeletionRaceError extends Error {
  constructor() {
    super('Account deletion state changed');
    this.name = 'AccountDeletionRaceError';
  }
}

function anonymizedDigest(userId) {
  return createHash('sha256')
    .update(`nitro-account-deletion:v1:${userId}`)
    .digest('hex');
}

export function accountDeletionTombstones(userId) {
  const digest = anonymizedDigest(userId);
  return {
    email: `deleted-${digest}@accounts.invalid`,
    referralCode: `deleted-${digest}.invalid`,
    password: `!deleted:${digest}`,
    closureReference: `ACCOUNT-CLOSURE-${digest}`,
    closureIdempotencyKey: `${ACCOUNT_CLOSURE_PREFIX}${digest}`,
    pointsClosureDedupeKey: `${POINTS_CLOSURE_PREFIX}${digest}`,
  };
}

function isRetryableDeletionError(error) {
  return error instanceof AccountDeletionRaceError
    || error?.code === 'P2034'
    || error?.meta?.code === '40001'
    || error?.meta?.code === '40P01';
}

async function serializableRetry(db, work) {
  for (let attempt = 0; attempt < ACCOUNT_DELETION_RETRIES; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isRetryableDeletionError(error) || attempt === ACCOUNT_DELETION_RETRIES - 1) {
        throw error;
      }
    }
  }

  throw new Error('Account deletion retry limit reached');
}

function deletionEligibility(user, now) {
  if (!user) return 'not_found';
  if (user.anonymizedAt) return 'already_anonymized';
  if (user.status === 'Deleted') return null;
  if (user.status !== 'PendingDeletion') return 'not_eligible';
  if (!user.deletedAt || user.deletedAt > now) return 'not_due';
  return null;
}

async function normalizeLegacyReferralNotes(tx) {
  // Legacy referral notes embedded a customer's display name without a durable
  // link back to that customer. Normalize the whole legacy format; current
  // `[ref-marker:<id>]` notes are already opaque and do not match this prefix.
  await tx.transaction.updateMany({
    where: {
      type: 'referral',
      note: { startsWith: 'Referral bonus:' },
    },
    data: { note: 'Referral bonus: account deposited' },
  });
}

function personalLogValues(user) {
  return [...new Set([
    user.deletedEmail,
    user.email,
    user.phone,
    user.deletedName,
    user.name,
  ].filter(value => typeof value === 'string' && value.trim().length >= 3))]
    .sort((left, right) => right.length - left.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exactValues(values) {
  return [...new Set(values
    .filter(value => typeof value === 'string')
    .map(value => value.trim())
    .filter(value => value.length >= 3 && value !== ACCOUNT_DELETION_REDACTION))]
    .sort((left, right) => right.length - left.length);
}

function freeformValues(value) {
  if (typeof value !== 'string') return [];
  return [value, ...value.split(/[\r\n,]+/)].map(part => part.trim()).filter(Boolean);
}

function retainedSensitiveValues(user, orders, transactions) {
  return exactValues([
    ...personalLogValues(user),
    user.firstName,
    user.lastName,
    user.signupIp,
    user.lastIp,
    user.lastUa,
    user.lastFbp,
    user.lastFbc,
    ...orders.flatMap(order => [order.link, ...freeformValues(order.comments)]),
    ...transactions.flatMap(transaction => [transaction.gatewayUrl, transaction.providerPayAddress]),
  ]);
}

function redactExactValues(value, sensitiveValues) {
  if (typeof value !== 'string' || !value) return value;
  let redacted = value;
  for (const sensitive of sensitiveValues) {
    redacted = redacted.replace(
      new RegExp(escapeRegExp(sensitive), 'gi'),
      ACCOUNT_DELETION_REDACTION,
    );
  }
  return redacted;
}

function redactIssueMetadata(metadata, sensitiveValues) {
  if (typeof metadata !== 'string' || !metadata) return metadata;
  try {
    const parsed = JSON.parse(metadata);
    let changed = false;
    const visit = value => {
      if (typeof value === 'string') {
        const redacted = redactExactValues(value, sensitiveValues);
        if (redacted !== value) changed = true;
        return redacted;
      }
      if (Array.isArray(value)) return value.map(visit);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
      }
      return value;
    };
    const redacted = visit(parsed);
    return changed ? JSON.stringify(redacted) : metadata;
  } catch {
    return redactExactValues(metadata, sensitiveValues);
  }
}

async function redactActivityLogs(tx, user) {
  const values = personalLogValues(user);
  if (values.length === 0) return;

  const rows = await tx.activityLog.findMany({
    where: {
      OR: values.map(value => ({ action: { contains: value, mode: 'insensitive' } })),
    },
    select: { id: true, action: true },
  });
  for (const row of rows) {
    let action = row.action;
    for (const value of values) {
      action = action.replace(new RegExp(escapeRegExp(value), 'gi'), 'Deleted account');
    }
    if (action !== row.action) {
      await tx.activityLog.update({ where: { id: row.id }, data: { action } });
    }
  }
}

function batches(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function redactLinkedAdminIssues(tx, user, orders, transactions, sensitiveValues) {
  const identifiers = exactValues([
    user.id,
    ...orders.flatMap(order => [order.id, order.orderId]),
    ...transactions.flatMap(transaction => [transaction.id, transaction.reference]),
  ]);
  const issues = new Map();
  for (const identifierBatch of batches(identifiers, ISSUE_IDENTIFIER_BATCH)) {
    const rows = await tx.adminIssue.findMany({
      where: {
        OR: identifierBatch.flatMap(identifier => [
          { metadata: { contains: identifier } },
          { title: { contains: identifier, mode: 'insensitive' } },
          { message: { contains: identifier, mode: 'insensitive' } },
        ]),
      },
      select: { id: true, title: true, message: true, metadata: true },
    });
    for (const row of rows) issues.set(row.id, row);
  }

  for (const issue of issues.values()) {
    const data = {
      title: redactExactValues(issue.title, sensitiveValues),
      message: redactExactValues(issue.message, sensitiveValues),
      metadata: redactIssueMetadata(issue.metadata, sensitiveValues),
    };
    if (
      data.title !== issue.title
      || data.message !== issue.message
      || data.metadata !== issue.metadata
    ) {
      await tx.adminIssue.update({ where: { id: issue.id }, data });
    }
  }
}

async function redactTransactionNotes(tx, transactions, sensitiveValues) {
  for (const transaction of transactions) {
    let note = transaction.note?.replace(
      /\[user_confirmed:[^\]]*\]/g,
      '[user_confirmed]',
    ) || null;
    note = redactExactValues(note, sensitiveValues);
    if (note !== transaction.note) {
      await tx.transaction.update({
        where: { id: transaction.id },
        data: { note },
      });
    }
  }
}

async function redactPointReasons(tx, userId, sensitiveValues) {
  const entries = await tx.nitroPointLedger.findMany({
    where: { userId, reason: { not: null } },
    select: { id: true, reason: true },
  });
  for (const entry of entries) {
    const reason = redactExactValues(entry.reason, sensitiveValues);
    if (reason !== entry.reason) {
      await tx.nitroPointLedger.update({
        where: { id: entry.id },
        data: { reason },
      });
    }
  }
}

async function eraseEphemeralData(tx, userId) {
  await tx.ticketReply.deleteMany({ where: { ticket: { userId } } });
  await tx.ticket.deleteMany({ where: { userId } });
  await tx.session.deleteMany({ where: { userId } });
  await tx.liveSession.deleteMany({ where: { userId } });
  await tx.idempotencyKey.deleteMany({ where: { userId } });
  await tx.waitlist.deleteMany({ where: { userId } });
  await tx.gameReward.deleteMany({ where: { userId } });
  await tx.gameScore.deleteMany({ where: { userId } });
  await tx.gameSession.deleteMany({ where: { userId } });
  await tx.videoWatch.deleteMany({ where: { userId } });
}

async function redactRetainedData(tx, user, now) {
  const userId = user.id;
  const [orders, transactions] = await Promise.all([
    tx.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderId: true,
        link: true,
        comments: true,
      },
    }),
    tx.transaction.findMany({
      where: { userId },
      select: {
        id: true,
        reference: true,
        note: true,
        gatewayUrl: true,
        providerPayAddress: true,
      },
    }),
  ]);
  const sensitiveValues = retainedSensitiveValues(user, orders, transactions);

  await redactLinkedAdminIssues(tx, user, orders, transactions, sensitiveValues);
  await redactTransactionNotes(tx, transactions, sensitiveValues);
  await redactPointReasons(tx, userId, sensitiveValues);

  await tx.order.updateMany({
    where: { userId },
    data: {
      link: ACCOUNT_DELETION_REDACTION,
      comments: null,
      lastError: null,
      deletedAt: now,
    },
  });
  await tx.dripDispatch.updateMany({
    where: { order: { userId } },
    data: { lastError: null },
  });
  await tx.transaction.updateMany({
    where: { userId },
    data: {
      gatewayUrl: null,
      providerPayAddress: null,
    },
  });
  await tx.taskSubmission.updateMany({
    where: { userId },
    data: {
      proof: ACCOUNT_DELETION_REDACTION,
      rejectionReason: null,
    },
  });
  await tx.taskSubmission.updateMany({
    where: { userId, status: 'pending' },
    data: {
      status: 'cancelled',
      creditedAmount: null,
      reviewedAt: now,
      reviewedBy: null,
    },
  });
  // Keep the grant record for audit, but remove every unspent entitlement.
  // The wallet's corresponding liability is already captured by the single
  // account_closure transaction, so no second financial row is created here.
  await tx.bonusCredit.updateMany({
    where: {
      userId,
      amountRemaining: { gt: 0 },
      expiredAt: null,
    },
    data: {
      amountRemaining: 0,
      expiredAt: now,
    },
  });
  await tx.crewMember.updateMany({
    where: { userId },
    data: { userId: null },
  });
}

function anonymizedUserData(userId, now) {
  const tombstones = accountDeletionTombstones(userId);
  return {
    status: 'Deleted',
    anonymizedAt: now,
    deletedAt: now,
    deletedName: null,
    deletedEmail: null,
    email: tombstones.email,
    password: tombstones.password,
    name: 'Deleted User',
    firstName: null,
    lastName: null,
    phone: null,
    balance: 0,
    referralCode: tombstones.referralCode,
    referredBy: null,
    emailVerified: false,
    verifyToken: null,
    verifyExpires: null,
    resetToken: null,
    resetExpires: null,
    apiKey: null,
    notifOrders: false,
    notifPromo: false,
    notifEmail: false,
    notifClearedAt: null,
    notifReadAllAt: null,
    notifReadIds: null,
    themePreference: 'auto',
    perPagePreference: 10,
    tourCompleted: false,
    orderTourCompleted: false,
    signupSource: null,
    signupIp: null,
    lastIp: null,
    lastUa: null,
    lastFbp: null,
    lastFbc: null,
    referredByMemberId: null,
    referredByLinkId: null,
    firstDepositBonusPaid: false,
    winbackSentAt: null,
    winback30SentAt: null,
    winback60SentAt: null,
    winbackSpendFloor: 0,
    nudgeIdleFundsSentAt: null,
    nudgeComebackSentAt: null,
    nudgeLapsedSentAt: null,
    nudgeIdleBalanceSentAt: null,
    adActivationDay1SentAt: null,
    adActivationDay3SentAt: null,
    adActivationDay6SentAt: null,
  };
}

export async function finalizeAccountDeletion(db, userId, now = new Date()) {
  if (!userId) throw new TypeError('User ID is required');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('A valid deletion time is required');

  return serializableRetry(db, async tx => {
    // Lock the account before reading any state that will be closed. Deposit,
    // order, refund, bonus and points writers all touch this same row, so the
    // deletion snapshot cannot miss a value committed concurrently.
    const lockedRows = await tx.$queryRaw`
      SELECT id FROM users WHERE id = ${userId} FOR UPDATE
    `;
    if (lockedRows.length === 0) return { finalized: false, reason: 'not_found' };

    const user = await tx.user.findUnique({ where: { id: userId } });
    const ineligibleReason = deletionEligibility(user, now);
    if (ineligibleReason) return { finalized: false, reason: ineligibleReason };

    const tombstones = accountDeletionTombstones(user.id);
    const closedBalance = user.balance;
    const points = await tx.nitroPointLedger.aggregate({
      where: { userId: user.id },
      _sum: { pointsKobo: true },
    });
    const closedPointsKobo = points._sum.pointsKobo || 0;

    // Capture and unlink the actual referral code before replacing it with the
    // irreversible tombstone. `referredBy` stores this code, not the user ID.
    await tx.user.updateMany({
      where: { referredBy: user.referralCode },
      data: { referredBy: null },
    });

    await normalizeLegacyReferralNotes(tx);
    await redactActivityLogs(tx, user);
    await eraseEphemeralData(tx, user.id);
    await redactRetainedData(tx, user, now);

    if (closedBalance !== 0) {
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'account_closure',
          amount: -closedBalance,
          method: 'system',
          reference: tombstones.closureReference,
          idempotencyKey: tombstones.closureIdempotencyKey,
          status: 'Completed',
          note: 'Wallet balance closed during account anonymization',
        },
      });
    }
    if (closedPointsKobo !== 0) {
      await tx.nitroPointLedger.create({
        data: {
          userId: user.id,
          type: 'account_closure',
          pointsKobo: -closedPointsKobo,
          dedupeKey: tombstones.pointsClosureDedupeKey,
          reason: 'Points balance closed during account anonymization',
        },
      });
    }

    const claimed = await tx.user.updateMany({
      where: {
        id: user.id,
        balance: user.balance,
        anonymizedAt: null,
        OR: [
          { status: 'PendingDeletion', deletedAt: { lte: now } },
          { status: 'Deleted' },
        ],
      },
      data: anonymizedUserData(user.id, now),
    });
    if (claimed.count !== 1) throw new AccountDeletionRaceError();

    return { finalized: true, closedBalance };
  });
}

function boundedBatchLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return ACCOUNT_DELETION_BATCH_DEFAULT;
  return Math.min(parsed, ACCOUNT_DELETION_BATCH_MAX);
}

export async function finalizeDueAccountDeletions(db, now = new Date(), { limit } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('A valid deletion time is required');
  const take = boundedBatchLimit(limit);
  const candidates = await db.user.findMany({
    where: {
      anonymizedAt: null,
      OR: [
        { status: 'PendingDeletion', deletedAt: { lte: now } },
        { status: 'Deleted' },
      ],
    },
    select: { id: true },
    orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
    take,
  });

  let finalized = 0;
  let skipped = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      const result = await finalizeAccountDeletion(db, candidate.id, now);
      if (result.finalized) finalized++;
      else skipped++;
    } catch {
      // The caller receives only aggregate operational data. In particular, do
      // not carry an email, name, raw database error, or other PII into logs.
      failed++;
    }
  }

  return { checked: candidates.length, finalized, skipped, failed };
}

export async function reinstatePendingAccountDeletion(db, userId, now = new Date()) {
  if (!userId) throw new TypeError('User ID is required');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('A valid reinstatement time is required');

  return serializableRetry(db, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return { reinstated: false, reason: 'not_found' };
    if (user.status !== 'PendingDeletion') return { reinstated: false, reason: 'not_pending' };
    if (!user.deletedAt || user.deletedAt <= now) return { reinstated: false, reason: 'grace_expired' };

    const name = user.deletedName || user.name;
    const email = user.deletedEmail || user.email;
    const claimed = await tx.user.updateMany({
      where: {
        id: user.id,
        status: 'PendingDeletion',
        deletedAt: { gt: now },
        anonymizedAt: null,
      },
      data: {
        status: 'Active',
        name,
        email,
        deletedAt: null,
        deletedName: null,
        deletedEmail: null,
      },
    });
    if (claimed.count !== 1) return { reinstated: false, reason: 'state_changed' };

    return { reinstated: true, user: { id: user.id, name, email } };
  });
}
