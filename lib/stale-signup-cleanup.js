export const STALE_SIGNUP_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function staleSignupCutoff(now = new Date()) {
  return new Date(now.getTime() - STALE_SIGNUP_DAYS * DAY_MS);
}

// Only legacy verification signups can qualify. Current signups are verified at
// creation, so the expired token is an explicit signal that this is an abandoned
// account rather than an active customer whose verification flag is incomplete.
export function staleSignupWhere(cutoff, ids) {
  return {
    ...(ids ? { id: { in: ids } } : {}),
    createdAt: { lt: cutoff },
    updatedAt: { lt: cutoff },
    deletedAt: null,
    balance: 0,
    emailVerified: false,
    status: 'Active',
    verifyToken: { not: null },
    verifyExpires: { lt: cutoff },
    apiKey: null,
    resetToken: null,
    resetExpires: null,
    tourCompleted: false,
    orderTourCompleted: false,
    notifClearedAt: null,
    notifReadAllAt: null,
    notifReadIds: null,
    orders: { none: {} },
    transactions: { none: {} },
    tickets: { none: {} },
    waitlist: { none: {} },
    gameSessions: { none: {} },
    gameScores: { none: {} },
    gameRewards: { none: {} },
    videoWatches: { none: {} },
    bonusCredits: { none: {} },
    taskSubmissions: { none: {} },
    nitroPointLedger: { none: {} },
    crewMember: { is: null },
    sessions: {
      none: {
        OR: [
          { lastActive: { gte: cutoff } },
          { createdAt: { gte: cutoff } },
        ],
      },
    },
  };
}

export async function countStaleSignups(db, now = new Date()) {
  return db.user.count({ where: staleSignupWhere(staleSignupCutoff(now)) });
}

export async function cleanupStaleSignups(db, now = new Date()) {
  const cutoff = staleSignupCutoff(now);

  return db.$transaction(async tx => {
    const candidates = await tx.user.findMany({
      where: staleSignupWhere(cutoff),
      select: { id: true, referralCode: true },
      orderBy: { createdAt: 'asc' },
      take: 250,
    });

    if (candidates.length === 0) return { checked: 0, deleted: 0 };

    const ids = candidates.map(user => user.id);
    const referralCodes = candidates.map(user => user.referralCode);
    const [idempotencyRecords, liveSessions, referredUsers] = await Promise.all([
      tx.idempotencyKey.findMany({
        where: { userId: { in: ids } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      tx.liveSession.findMany({
        where: { userId: { in: ids }, lastSeen: { gte: cutoff } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      tx.user.findMany({
        where: { referredBy: { in: referralCodes } },
        select: { referredBy: true },
        distinct: ['referredBy'],
      }),
    ]);

    const protectedIds = new Set([
      ...idempotencyRecords.map(record => record.userId),
      ...liveSessions.map(session => session.userId),
    ]);
    const usedReferralCodes = new Set(referredUsers.map(user => user.referredBy));
    const eligibleIds = candidates
      .filter(user => !protectedIds.has(user.id) && !usedReferralCodes.has(user.referralCode))
      .map(user => user.id);

    if (eligibleIds.length === 0) return { checked: candidates.length, deleted: 0 };

    // This repeats every safety condition at deletion time. Session rows are
    // removed by the database cascade only after the user deletion succeeds.
    const { count } = await tx.user.deleteMany({
      where: staleSignupWhere(cutoff, eligibleIds),
    });

    return { checked: candidates.length, deleted: count };
  }, { isolationLevel: 'Serializable' });
}
