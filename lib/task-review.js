// Approving or rejecting a task submission, shared by the admin dashboard and
// the Telegram buttons. One implementation because approval moves money: it
// credits the wallet, mints an expiring bonus credit and writes a transaction,
// and a second copy of that would drift.
import prisma from '@/lib/prisma';

const DEFAULT_EXPIRY_DAYS = 14;

async function creditExpiryDays() {
  const row = await prisma.setting.findUnique({ where: { key: 'task_credit_expiry_days' } });
  return row ? parseInt(row.value, 10) || DEFAULT_EXPIRY_DAYS : DEFAULT_EXPIRY_DAYS;
}

/**
 * Approve a pending submission and pay its reward.
 * Returns { ok, error, alreadyReviewed, status, amount, userName, taskTitle }.
 * Never throws for an already-reviewed submission: two admins racing on the same
 * card is expected, and the second one wants a clear answer, not a failure.
 */
export async function approveSubmission(id, reviewedBy) {
  const sub = await prisma.taskSubmission.findUnique({
    where: { id },
    include: { task: true, user: { select: { name: true, email: true } } },
  });
  if (!sub) return { ok: false, error: 'Submission not found' };
  if (sub.status !== 'pending') {
    return { ok: false, alreadyReviewed: true, status: sub.status, reviewedBy: sub.reviewedBy, error: 'Already reviewed' };
  }

  const amount = sub.task.reward;
  const expiresAt = new Date(Date.now() + (await creditExpiryDays()) * 86400000);

  await prisma.$transaction([
    prisma.taskSubmission.update({
      where: { id },
      data: { status: 'approved', creditedAmount: amount, reviewedAt: new Date(), reviewedBy },
    }),
    prisma.user.update({ where: { id: sub.userId }, data: { balance: { increment: amount } } }),
    prisma.bonusCredit.create({
      data: { userId: sub.userId, source: 'task', amountGranted: amount, amountRemaining: amount, expiresAt },
    }),
    prisma.transaction.create({
      data: { userId: sub.userId, type: 'bonus', amount, status: 'Completed', note: `Task reward: ₦${(amount / 100).toLocaleString()}` },
    }),
  ]);

  return { ok: true, amount, userName: sub.user?.name || sub.user?.email, taskTitle: sub.task.title };
}

/** Reject a pending submission. Reason is optional; Telegram sends none. */
export async function rejectSubmission(id, reviewedBy, reason = null) {
  const sub = await prisma.taskSubmission.findUnique({
    where: { id },
    include: { task: true, user: { select: { name: true, email: true } } },
  });
  if (!sub) return { ok: false, error: 'Submission not found' };
  if (sub.status !== 'pending') {
    return { ok: false, alreadyReviewed: true, status: sub.status, reviewedBy: sub.reviewedBy, error: 'Already reviewed' };
  }

  await prisma.taskSubmission.update({
    where: { id },
    data: { status: 'rejected', rejectionReason: reason || null, reviewedAt: new Date(), reviewedBy },
  });
  return { ok: true, userName: sub.user?.name || sub.user?.email, taskTitle: sub.task.title };
}
