import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser, clearUserCookie } from '@/lib/auth';
import { sendEmail, accountDeletionEmail } from '@/lib/email';
import {
  completeActiveOrdersForAccountDeletion,
  isOrderCancellationLeaseActive,
  isOrderSettlementAccountEligible,
  lockOrderSettlementAccount,
  verifyAccountDeletionProof,
  withAccountDeletionRetry,
} from '@/lib/account-deletion';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import bcrypt from 'bcryptjs';
import { tgUserDeletionRequested } from '@/lib/telegram';

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 3, windowMs: 5 * 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests('Too many attempts. Try again in 5 minutes.', limit.retryAfter);

    const payload = await getCurrentUser();
    if (!payload) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { password, confirmEmail } = await req.json().catch(() => ({}));

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    // Password accounts re-enter the password; Google accounts have none and
    // type their email instead. See verifyAccountDeletionProof for why.
    const proof = await verifyAccountDeletionProof(user, { password, confirmEmail }, { compare: bcrypt.compare });
    if (!proof.ok) return Response.json({ error: proof.error }, { status: proof.status });

    if (user.status === 'PendingDeletion') {
      return Response.json({ error: 'Account is already scheduled for deletion' }, { status: 400 });
    }

    const completedAt = new Date();
    const deletionDate = new Date(completedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Atomic: close active orders without refund, mark deletion, clear sessions
    const closedWork = await withAccountDeletionRetry(prisma, async (tx) => {
      // Serialize deletion against order placement. Order creation acquires the
      // same user-row lock through deductBalance, so a request that won first is
      // visible below and a request that lost can no longer spend afterward.
      const lockedUser = await lockOrderSettlementAccount(tx, user.id);
      if (!isOrderSettlementAccountEligible(lockedUser)) {
        throw new Error('ACCOUNT_STATE_CHANGED');
      }

      // A provider cancellation that already claimed the parent is the earlier
      // operation. Do not commit deletion while that worker still owns the
      // right to call the provider; the customer can retry once it settles.
      const cancellationInProgress = await tx.order.findFirst({
        where: { userId: user.id, status: 'Cancelling', deletedAt: null },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (isOrderCancellationLeaseActive(cancellationInProgress, new Date())) {
        return { orders: 0, dispatches: 0, cancellationInProgress: true };
      }

      const completed = await completeActiveOrdersForAccountDeletion(tx, user.id, completedAt);
      await tx.user.update({
        where: { id: user.id },
        data: { status: 'PendingDeletion', deletedAt: deletionDate, deletedName: user.name, deletedEmail: user.email },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      return completed;
    });
    if (closedWork.cancellationInProgress) {
      return Response.json({ error: 'An order cancellation is in progress. Please try deleting your account again shortly.' }, { status: 409 });
    }

    // Count user stats for the admin Telegram notice
    const [orderCount, totalSpent] = await Promise.all([
      prisma.order.count({ where: { userId: user.id } }),
      prisma.transaction.aggregate({ where: { userId: user.id, type: 'order' }, _sum: { amount: true } }),
    ]);

    // No internal email to accounts@nitro.ng: nobody opened one in 30 days
    // (Brevo, 17 Oct 2026), and the Telegram notice below already tells admins.

    // Send confirmation to user
    const userHtml = await accountDeletionEmail(user.firstName || user.name, 30);

    sendEmail(user.email, 'Your Nitro account is scheduled for deletion', userHtml).catch(err =>
      log.error('DeleteAccount', `User email failed: ${err.message}`)
    );

    tgUserDeletionRequested(user.id, orderCount, totalSpent._sum.amount || 0);

    // Clear session cookie
    await clearUserCookie();

    return Response.json({ success: true, message: 'Account scheduled for deletion in 30 days' });
  } catch (err) {
    log.error('Delete Account', err.message);
    return Response.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
