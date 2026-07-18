import { readFileSync } from 'node:fs';
import { describe, it, expect, vi } from 'vitest';
import {
  ACCOUNT_DELETION_BATCH_MAX,
  ACCOUNT_DELETION_REDACTION,
  accountDeletionTombstones,
  finalizeAccountDeletion,
  finalizeDueAccountDeletions,
  reinstatePendingAccountDeletion,
} from '@/lib/account-deletion';

const NOW = new Date('2026-07-17T12:00:00.000Z');
const FUTURE = new Date('2026-08-16T12:00:00.000Z');
const PAST = new Date('2026-07-16T12:00:00.000Z');

function pendingUser(overrides = {}) {
  return {
    id: 'user-sensitive-id',
    email: 'person@example.com',
    password: '$2b$12$secret',
    name: 'Personal Name',
    firstName: 'Personal',
    lastName: 'Name',
    phone: '+2348012345678',
    balance: 45_600,
    referralCode: 'NTR-PRIVATE',
    referredBy: 'NTR-UPSTREAM',
    emailVerified: true,
    verifyToken: 'verify-secret',
    verifyExpires: FUTURE,
    resetToken: 'reset-secret',
    resetExpires: FUTURE,
    apiKey: 'api-secret',
    notifOrders: true,
    notifPromo: true,
    notifEmail: true,
    notifClearedAt: PAST,
    notifReadAllAt: PAST,
    notifReadIds: '["private-id"]',
    themePreference: 'night',
    perPagePreference: 25,
    tourCompleted: true,
    orderTourCompleted: true,
    signupSource: 'private-campaign',
    signupIp: '203.0.113.4',
    lastIp: '203.0.113.5',
    lastUa: 'Private Browser',
    lastFbp: 'fb.1.private',
    lastFbc: 'fb.1.click.private',
    referredByMemberId: 'crew-private',
    referredByLinkId: 'link-private',
    tosAcceptedAt: PAST,
    tosVersion: 'private-version',
    firstDepositBonusPaid: true,
    winbackSentAt: PAST,
    winback30SentAt: PAST,
    winback60SentAt: PAST,
    winbackSpendFloor: 10_000,
    nudgeIdleFundsSentAt: PAST,
    nudgeComebackSentAt: PAST,
    nudgeLapsedSentAt: PAST,
    nudgeIdleBalanceSentAt: PAST,
    adActivationDay1SentAt: PAST,
    adActivationDay3SentAt: PAST,
    adActivationDay6SentAt: PAST,
    status: 'PendingDeletion',
    deletedAt: PAST,
    deletedName: 'Original Personal Name',
    deletedEmail: 'original@example.com',
    anonymizedAt: null,
    ...overrides,
  };
}

function mockDatabase(user = pendingUser()) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(user ? [{ id: user.id }] : []),
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      updateMany: vi.fn(async args => ({ count: args.where?.id ? 1 : 0 })),
    },
    ticketReply: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    ticket: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    liveSession: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    idempotencyKey: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    waitlist: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    gameReward: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    gameScore: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    gameSession: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    videoWatch: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    order: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    dripDispatch: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    transaction: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'redacted-transaction' }),
      create: vi.fn().mockResolvedValue({ id: 'closure-transaction' }),
    },
    taskSubmission: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    bonusCredit: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    nitroPointLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { pointsKobo: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'redacted-points-entry' }),
      create: vi.fn().mockResolvedValue({ id: 'points-closure' }),
    },
    crewMember: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    activityLog: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'redacted-log' }),
    },
    adminIssue: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'redacted-issue' }),
    },
  };
  const db = {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(async work => work(tx)),
  };
  return { db, tx };
}

function finalUserUpdate(tx) {
  return tx.user.updateMany.mock.calls.find(([args]) => args.where?.id)?.[0];
}

describe('account deletion tombstones', () => {
  it('uses deterministic, unique .invalid identities without embedding the user ID', () => {
    const first = accountDeletionTombstones('person@example.com');
    const same = accountDeletionTombstones('person@example.com');
    const other = accountDeletionTombstones('other@example.com');

    expect(first).toEqual(same);
    expect(first.email).toMatch(/^deleted-[a-f0-9]{64}@accounts\.invalid$/);
    expect(first.referralCode).toMatch(/^deleted-[a-f0-9]{64}\.invalid$/);
    expect(first.email).not.toContain('person@example.com');
    expect(first.referralCode).not.toBe(other.referralCode);
    expect(first.closureReference).not.toBe(other.closureReference);
  });

  it('adds the nullable anonymization marker through a dedicated migration', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf8');
    const migration = readFileSync(
      'prisma/migrations/20260717020400_add_user_anonymized_at/migration.sql',
      'utf8',
    );

    expect(schema).toContain('anonymizedAt           DateTime?');
    expect(migration).toContain('ADD COLUMN "anonymizedAt" TIMESTAMP(3)');
    expect(migration).toContain('CONSTRAINT "users_deleted_balance_zero"');
    expect(migration).toContain('"status" <> \'Deleted\' AND "anonymizedAt" IS NULL');
    expect(migration).toContain('CONSTRAINT "users_deleted_identity_anonymized"');
    expect(migration).toContain("email LIKE 'deleted-%@accounts.invalid'");
    expect(migration).toContain('"signupIp" IS NULL');
    expect(migration).toContain('"lastUa" IS NULL');
    expect(migration).toContain('NOT VALID');
  });
});

describe('finalizeAccountDeletion', () => {
  it('atomically erases ephemeral data and redacts every retained personal surface', async () => {
    const user = pendingUser();
    const { db, tx } = mockDatabase(user);

    const result = await finalizeAccountDeletion(db, user.id, NOW);

    expect(result).toEqual({ finalized: true, closedBalance: 45_600 });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { referredBy: user.referralCode },
      data: { referredBy: null },
    });
    expect(tx.ticketReply.deleteMany).toHaveBeenCalledWith({ where: { ticket: { userId: user.id } } });
    for (const model of [
      'ticket', 'session', 'liveSession', 'idempotencyKey', 'waitlist',
      'gameReward', 'gameScore', 'gameSession', 'videoWatch',
    ]) {
      expect(tx[model].deleteMany, model).toHaveBeenCalledWith({ where: { userId: user.id } });
    }

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id },
      data: {
        link: ACCOUNT_DELETION_REDACTION,
        comments: null,
        lastError: null,
        deletedAt: NOW,
      },
    });
    expect(tx.dripDispatch.updateMany).toHaveBeenCalledWith({
      where: { order: { userId: user.id } },
      data: { lastError: null },
    });
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id },
      data: { gatewayUrl: null, providerPayAddress: null },
    });
    expect(tx.taskSubmission.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id },
      data: { proof: ACCOUNT_DELETION_REDACTION, rejectionReason: null },
    });
    expect(tx.taskSubmission.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, status: 'pending' },
      data: {
        status: 'cancelled',
        creditedAmount: null,
        reviewedAt: NOW,
        reviewedBy: null,
      },
    });
    expect(tx.bonusCredit.updateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        amountRemaining: { gt: 0 },
        expiredAt: null,
      },
      data: { amountRemaining: 0, expiredAt: NOW },
    });
    expect(tx.crewMember.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id },
      data: { userId: null },
    });

    const update = finalUserUpdate(tx);
    const tombstones = accountDeletionTombstones(user.id);
    expect(update.where).toEqual({
      id: user.id,
      balance: user.balance,
      anonymizedAt: null,
      OR: [
        { status: 'PendingDeletion', deletedAt: { lte: NOW } },
        { status: 'Deleted' },
      ],
    });
    expect(update.data).toMatchObject({
      status: 'Deleted',
      anonymizedAt: NOW,
      deletedAt: NOW,
      deletedName: null,
      deletedEmail: null,
      email: tombstones.email,
      referralCode: tombstones.referralCode,
      password: tombstones.password,
      name: 'Deleted User',
      balance: 0,
      emailVerified: false,
      notifOrders: false,
      notifPromo: false,
      notifEmail: false,
      themePreference: 'auto',
      perPagePreference: 10,
      tourCompleted: false,
      orderTourCompleted: false,
      firstDepositBonusPaid: false,
      winbackSpendFloor: 0,
    });
    for (const field of [
      'firstName', 'lastName', 'phone', 'referredBy', 'verifyToken', 'verifyExpires',
      'resetToken', 'resetExpires', 'apiKey', 'notifClearedAt', 'notifReadAllAt',
      'notifReadIds', 'signupSource', 'signupIp', 'lastIp', 'lastUa', 'lastFbp',
      'lastFbc', 'referredByMemberId', 'referredByLinkId', 'winbackSentAt',
      'winback30SentAt', 'winback60SentAt',
      'nudgeIdleFundsSentAt', 'nudgeComebackSentAt', 'nudgeLapsedSentAt',
      'nudgeIdleBalanceSentAt', 'adActivationDay1SentAt', 'adActivationDay3SentAt',
      'adActivationDay6SentAt',
    ]) {
      expect(update.data[field], field).toBeNull();
    }
    expect(update.data).not.toHaveProperty('tosAcceptedAt');
    expect(update.data).not.toHaveProperty('tosVersion');
  });

  it('records a durable negative wallet closure before zeroing a positive balance', async () => {
    const user = pendingUser({ balance: 12_345 });
    const { db, tx } = mockDatabase(user);
    const tombstones = accountDeletionTombstones(user.id);

    await finalizeAccountDeletion(db, user.id, NOW);

    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        type: 'account_closure',
        amount: -12_345,
        method: 'system',
        reference: tombstones.closureReference,
        idempotencyKey: tombstones.closureIdempotencyKey,
        status: 'Completed',
        note: 'Wallet balance closed during account anonymization',
      },
    });
    expect(tx.transaction.create.mock.invocationCallOrder[0])
      .toBeLessThan(finalUserUpdate(tx) && tx.user.updateMany.mock.invocationCallOrder.at(-1));
  });

  it('does not invent a closure transaction for a zero balance', async () => {
    const { db, tx } = mockDatabase(pendingUser({ balance: 0 }));

    const result = await finalizeAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(result).toEqual({ finalized: true, closedBalance: 0 });
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(finalUserUpdate(tx).data.balance).toBe(0);
  });

  it('records the balancing adjustment when closing a negative wallet', async () => {
    const user = pendingUser({ balance: -500 });
    const { db, tx } = mockDatabase(user);
    const tombstones = accountDeletionTombstones(user.id);

    const result = await finalizeAccountDeletion(db, user.id, NOW);

    expect(result).toEqual({ finalized: true, closedBalance: -500 });
    expect(tx.transaction.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        type: 'account_closure',
        amount: 500,
        method: 'system',
        reference: tombstones.closureReference,
        idempotencyKey: tombstones.closureIdempotencyKey,
        status: 'Completed',
        note: 'Wallet balance closed during account anonymization',
      },
    });
    expect(finalUserUpdate(tx).data.balance).toBe(0);
  });

  it('closes the derived points balance with a retained audit entry', async () => {
    const user = pendingUser({ balance: 0 });
    const { db, tx } = mockDatabase(user);
    tx.nitroPointLedger.aggregate.mockResolvedValue({ _sum: { pointsKobo: 87_500 } });
    const tombstones = accountDeletionTombstones(user.id);

    await finalizeAccountDeletion(db, user.id, NOW);

    expect(tx.nitroPointLedger.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        type: 'account_closure',
        pointsKobo: -87_500,
        dedupeKey: tombstones.pointsClosureDedupeKey,
        reason: 'Points balance closed during account anonymization',
      },
    });
  });

  it('does not add a points closure entry when the ledger is already zero', async () => {
    const { db, tx } = mockDatabase(pendingUser({ balance: 0 }));

    const result = await finalizeAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(result.finalized).toBe(true);
    expect(tx.nitroPointLedger.create).not.toHaveBeenCalled();
  });

  it('normalizes legacy cross-account referral notes without changing amounts', async () => {
    const user = pendingUser();
    const { db, tx } = mockDatabase(user);

    await finalizeAccountDeletion(db, user.id, NOW);

    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        type: 'referral',
        note: { startsWith: 'Referral bonus:' },
      },
      data: { note: 'Referral bonus: account deposited' },
    });
    for (const [args] of tx.transaction.updateMany.mock.calls) {
      expect(args.data).not.toHaveProperty('amount');
      expect(args.data).not.toHaveProperty('status');
    }
  });

  it('removes manual-deposit sender references while retaining the transaction', async () => {
    const { db, tx } = mockDatabase();
    tx.transaction.findMany.mockResolvedValue([
      {
        id: 'manual-deposit',
        note: 'Bank transfer [user_confirmed:Personal Sender 0123456789] [approved_by:Admin]',
      },
    ]);

    await finalizeAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(tx.transaction.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-sensitive-id' },
      select: {
        id: true,
        reference: true,
        note: true,
        gatewayUrl: true,
        providerPayAddress: true,
      },
    });
    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: 'manual-deposit' },
      data: { note: 'Bank transfer [user_confirmed] [approved_by:Admin]' },
    });
    expect(tx.transaction.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: expect.anything() }),
    }));
  });

  it('redacts exact PII and order targets from every linked retained text surface', async () => {
    const user = pendingUser();
    const { db, tx } = mockDatabase(user);
    const privateLink = 'https://x.com/private-customer/status/123';
    const privateComments = '@private_customer, private campaign phrase';
    const privateGateway = 'https://gateway.example/private-session';
    const privatePayAddress = '0xprivatepayaddress';

    tx.order.findMany.mockResolvedValue([{
      id: 'order-db-1',
      orderId: 'NTR-PRIVATE-1',
      link: privateLink,
      comments: privateComments,
    }]);
    tx.transaction.findMany.mockResolvedValue([{
      id: 'transaction-1',
      reference: 'PAY-PRIVATE-1',
      note: `Refund for ${privateLink} to ${user.deletedEmail} [user_confirmed:Private Sender]`,
      gatewayUrl: privateGateway,
      providerPayAddress: privatePayAddress,
    }]);
    tx.nitroPointLedger.findMany.mockResolvedValue([{
      id: 'points-1',
      reason: `Goodwill for ${user.deletedName} on ${privateLink}`,
    }]);
    tx.adminIssue.findMany.mockResolvedValue([
      {
        id: 'issue-private',
        title: `Order NTR-PRIVATE-1 for ${user.deletedName}`,
        message: `Provider saw ${privateLink}; gateway ${privateGateway}; pay address ${privatePayAddress}`,
        metadata: JSON.stringify({
          orderId: 'NTR-PRIVATE-1',
          link: privateLink,
          comments: privateComments,
          payAddress: privatePayAddress,
          provider: 'mtp',
        }),
      },
      {
        id: 'issue-audit-only',
        title: 'Order NTR-PRIVATE-1 provider capacity',
        message: 'Provider retry required',
        metadata: JSON.stringify({ orderId: 'NTR-PRIVATE-1', provider: 'mtp' }),
      },
    ]);

    await finalizeAccountDeletion(db, user.id, NOW);

    expect(tx.transaction.update).toHaveBeenCalledWith({
      where: { id: 'transaction-1' },
      data: {
        note: `Refund for ${ACCOUNT_DELETION_REDACTION} to ${ACCOUNT_DELETION_REDACTION} [user_confirmed]`,
      },
    });
    expect(tx.nitroPointLedger.update).toHaveBeenCalledWith({
      where: { id: 'points-1' },
      data: {
        reason: `Goodwill for ${ACCOUNT_DELETION_REDACTION} on ${ACCOUNT_DELETION_REDACTION}`,
      },
    });

    const issueUpdate = tx.adminIssue.update.mock.calls.find(([args]) => args.where.id === 'issue-private')?.[0];
    expect(issueUpdate).toBeDefined();
    expect(issueUpdate.data.title).toBe(`Order NTR-PRIVATE-1 for ${ACCOUNT_DELETION_REDACTION}`);
    expect(issueUpdate.data.message).toBe(
      `Provider saw ${ACCOUNT_DELETION_REDACTION}; gateway ${ACCOUNT_DELETION_REDACTION}; pay address ${ACCOUNT_DELETION_REDACTION}`,
    );
    expect(JSON.parse(issueUpdate.data.metadata)).toEqual({
      orderId: 'NTR-PRIVATE-1',
      link: ACCOUNT_DELETION_REDACTION,
      comments: ACCOUNT_DELETION_REDACTION,
      payAddress: ACCOUNT_DELETION_REDACTION,
      provider: 'mtp',
    });
    expect(tx.adminIssue.update).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'issue-audit-only' },
    }));

    const retainedWrites = [
      ...tx.transaction.update.mock.calls,
      ...tx.nitroPointLedger.update.mock.calls,
      ...tx.adminIssue.update.mock.calls,
    ].map(([args]) => args.data);
    for (const data of retainedWrites) {
      expect(data).not.toHaveProperty('amount');
      expect(data).not.toHaveProperty('status');
    }
  });

  it('removes names, emails, and phone numbers from retained admin activity', async () => {
    const user = pendingUser();
    const { db, tx } = mockDatabase(user);
    tx.activityLog.findMany.mockResolvedValue([
      {
        id: 'activity-1',
        action: 'Edited Original Personal Name (original@example.com), phone +2348012345678',
      },
    ]);

    await finalizeAccountDeletion(db, user.id, NOW);

    expect(tx.activityLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, action: true },
    }));
    const update = tx.activityLog.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'activity-1' });
    expect(update.data.action).toBe('Edited Deleted account (Deleted account), phone Deleted account');
    expect(update.data.action).not.toContain(user.deletedName);
    expect(update.data.action).not.toContain(user.deletedEmail);
    expect(update.data.action).not.toContain(user.phone);
  });

  it('supports legacy Deleted rows that were never anonymized', async () => {
    const user = pendingUser({ status: 'Deleted', deletedAt: null, anonymizedAt: null });
    const { db, tx } = mockDatabase(user);

    const result = await finalizeAccountDeletion(db, user.id, NOW);

    expect(result.finalized).toBe(true);
    expect(finalUserUpdate(tx).where.OR).toContainEqual({ status: 'Deleted' });
  });

  it.each([
    [null, 'not_found'],
    [pendingUser({ deletedAt: FUTURE }), 'not_due'],
    [pendingUser({ status: 'Active' }), 'not_eligible'],
    [pendingUser({ status: 'Deleted', anonymizedAt: PAST }), 'already_anonymized'],
  ])('does nothing when eligibility resolves to %s', async (user, reason) => {
    const { db, tx } = mockDatabase(user);

    const result = await finalizeAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(result).toEqual({ finalized: false, reason });
    expect(tx.ticket.deleteMany).not.toHaveBeenCalled();
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('retries a serializable conflict without leaking it into the result', async () => {
    const { db, tx } = mockDatabase();
    const conflict = Object.assign(new Error('private database detail'), { code: 'P2034' });
    db.$transaction.mockRejectedValueOnce(conflict).mockImplementation(async work => work(tx));

    const result = await finalizeAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(result.finalized).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it('retries a failed final CAS so all preceding writes roll back and are re-evaluated', async () => {
    const { db, tx } = mockDatabase();
    let claims = 0;
    tx.user.updateMany.mockImplementation(async args => {
      if (!args.where?.id) return { count: 1 };
      claims++;
      return { count: claims === 1 ? 0 : 1 };
    });

    const result = await finalizeAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(result.finalized).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(claims).toBe(2);
  });
});

describe('finalizeDueAccountDeletions', () => {
  it('selects a bounded due/legacy batch and returns only aggregate outcomes', async () => {
    const { db, tx } = mockDatabase();
    db.user.findMany.mockResolvedValue([{ id: 'due' }, { id: 'raced' }, { id: 'failed' }]);
    let attempt = 0;
    db.$transaction.mockImplementation(async work => {
      attempt++;
      if (attempt === 3) throw new Error('person@example.com private failure');
      if (attempt === 2) {
        tx.user.findUnique.mockResolvedValueOnce(pendingUser({ id: 'raced', deletedAt: FUTURE }));
      } else {
        tx.user.findUnique.mockResolvedValueOnce(pendingUser({ id: 'due' }));
      }
      return work(tx);
    });

    const result = await finalizeDueAccountDeletions(db, NOW, { limit: 9999 });

    expect(db.user.findMany).toHaveBeenCalledWith({
      where: {
        anonymizedAt: null,
        OR: [
          { status: 'PendingDeletion', deletedAt: { lte: NOW } },
          { status: 'Deleted' },
        ],
      },
      select: { id: true },
      orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
      take: ACCOUNT_DELETION_BATCH_MAX,
    });
    expect(result).toEqual({ checked: 3, finalized: 1, skipped: 1, failed: 1 });
    expect(JSON.stringify(result)).not.toContain('person@example.com');
    expect(result).not.toHaveProperty('errors');
  });
});

describe('reinstatePendingAccountDeletion', () => {
  it('restores only a still-live PendingDeletion account with a final CAS', async () => {
    const user = pendingUser({ deletedAt: FUTURE });
    const { db, tx } = mockDatabase(user);

    const result = await reinstatePendingAccountDeletion(db, user.id, NOW);

    expect(result).toEqual({
      reinstated: true,
      user: { id: user.id, name: user.deletedName, email: user.deletedEmail },
    });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: user.id,
        status: 'PendingDeletion',
        deletedAt: { gt: NOW },
        anonymizedAt: null,
      },
      data: {
        status: 'Active',
        name: user.deletedName,
        email: user.deletedEmail,
        deletedAt: null,
        deletedName: null,
        deletedEmail: null,
      },
    });
  });

  it.each([
    [null, 'not_found'],
    [pendingUser({ status: 'Active', deletedAt: FUTURE }), 'not_pending'],
    [pendingUser({ deletedAt: null }), 'grace_expired'],
    [pendingUser({ deletedAt: PAST }), 'grace_expired'],
    [pendingUser({ deletedAt: NOW }), 'grace_expired'],
  ])('refuses invalid reinstatement state with reason %s', async (user, reason) => {
    const { db, tx } = mockDatabase(user);

    const result = await reinstatePendingAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(result).toEqual({ reinstated: false, reason });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it('reports a final CAS loss without activating the account', async () => {
    const { db, tx } = mockDatabase(pendingUser({ deletedAt: FUTURE }));
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    const result = await reinstatePendingAccountDeletion(db, 'user-sensitive-id', NOW);

    expect(result).toEqual({ reinstated: false, reason: 'state_changed' });
  });
});
