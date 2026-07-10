import { log } from '@/lib/logger';

/**
 * Deduct amount from user balance atomically.
 * Throws 'INSUFFICIENT_BALANCE' if balance < amount.
 */
export async function deductBalance(tx, userId, amount) {
  const updated = await tx.$executeRaw`UPDATE users SET balance = balance - ${amount} WHERE id = ${userId} AND balance >= ${amount}`;
  if (updated === 0) throw new Error('INSUFFICIENT_BALANCE');
}

/**
 * Track bonus credit consumption for an order.
 * Call after deductBalance + order creation, in the same transaction.
 * Consumes soonest-expiry credits first.
 */
export async function trackBonusConsumption(tx, userId, orderId, amount) {
  const credits = await tx.bonusCredit.findMany({
    where: { userId, amountRemaining: { gt: 0 }, expiredAt: null },
    orderBy: { expiresAt: 'asc' },
  });
  if (!credits.length) return;

  let remaining = amount;
  const usages = [];
  for (const credit of credits) {
    if (remaining <= 0) break;
    const consume = Math.min(remaining, credit.amountRemaining);
    await tx.bonusCredit.update({
      where: { id: credit.id },
      data: { amountRemaining: { decrement: consume } },
    });
    usages.push({ bonusCreditId: credit.id, orderId, amount: consume });
    remaining -= consume;
  }
  if (usages.length > 0) {
    await tx.orderCreditUsage.createMany({ data: usages });
  }
}

/**
 * Restore bonus credit consumed by an order (user-initiated cancel only).
 * Only restores to BonusCredit rows that haven't expired yet.
 */
export async function restoreBonusForRefund(tx, orderId) {
  const usages = await tx.orderCreditUsage.findMany({
    where: { orderId },
    include: { bonusCredit: true },
  });
  if (!usages.length) return;

  for (const usage of usages) {
    if (!usage.bonusCredit.expiredAt) {
      await tx.bonusCredit.update({
        where: { id: usage.bonusCreditId },
        data: { amountRemaining: { increment: usage.amount } },
      });
    }
  }
  await tx.orderCreditUsage.deleteMany({ where: { orderId } });
}

/**
 * Grant winback credit with expiry.
 */
export async function grantWinbackCredit(db, userId, amount, expiryDays) {
  if (!amount || amount <= 0) return null;
  const days = expiryDays || 7;
  const settingRow = await db.setting.findUnique({ where: { key: 'winback_credit_expiry_days' } });
  const finalDays = settingRow ? parseInt(settingRow.value, 10) || days : days;

  const expiresAt = new Date(Date.now() + finalDays * 86400000);

  const credit = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { balance: { increment: amount } } });
    const row = await tx.bonusCredit.create({
      data: { userId, source: 'winback', amountGranted: amount, amountRemaining: amount, expiresAt },
    });
    await tx.transaction.create({
      data: {
        userId, type: 'bonus', amount, status: 'Completed',
        note: `Bonus credit: ₦${(amount / 100).toLocaleString()} (expires ${expiresAt.toISOString().slice(0, 10)})`,
      },
    });
    return row;
  });

  return credit;
}

/**
 * Expire past-due bonus credits. Called from daily cron.
 */
export async function expireBonusCredits(db) {
  const now = new Date();
  const expired = await db.bonusCredit.findMany({
    where: { expiresAt: { lte: now }, amountRemaining: { gt: 0 }, expiredAt: null },
    select: { id: true, userId: true, source: true, amountRemaining: true, amountGranted: true, grantedAt: true },
  });

  let count = 0;
  for (const credit of expired) {
    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: credit.userId }, select: { balance: true } });
        const deduct = Math.min(credit.amountRemaining, user?.balance || 0);

        if (deduct > 0) {
          await tx.$executeRaw`UPDATE users SET balance = balance - ${deduct} WHERE id = ${credit.userId}`;
        }
        await tx.bonusCredit.update({
          where: { id: credit.id },
          data: { amountRemaining: 0, expiredAt: now },
        });
        await tx.transaction.create({
          data: {
            userId: credit.userId, type: 'bonus_expired', amount: -deduct, status: 'Completed',
            note: `Expired ${credit.source} credit: ₦${(credit.amountRemaining / 100).toLocaleString()}${deduct < credit.amountRemaining ? ` (capped at ₦${(deduct / 100).toLocaleString()})` : ''} (granted ${credit.grantedAt.toISOString().slice(0, 10)})`,
          },
        });

        if (deduct < credit.amountRemaining) {
          log.warn('BonusExpiry', `Capped: user ${credit.userId} balance ${user?.balance || 0} < remaining ${credit.amountRemaining}, deducted ${deduct}`);
        }
      });
      count++;
    } catch (err) {
      log.error('BonusExpiry', `Failed to expire credit ${credit.id}: ${err.message}`);
    }
  }

  return count;
}

/**
 * Get active bonus credit info for a user (dashboard display).
 */
export async function getBonusInfo(db, userId) {
  const credits = await db.bonusCredit.findMany({
    where: { userId, amountRemaining: { gt: 0 }, expiredAt: null, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'asc' },
    select: { amountRemaining: true, expiresAt: true },
  });
  if (!credits.length) return null;
  const totalBonus = credits.reduce((s, c) => s + c.amountRemaining, 0);
  const soonestExpiry = credits[0].expiresAt;
  return { amount: totalBonus, expiresAt: soonestExpiry.toISOString() };
}
