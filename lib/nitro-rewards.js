import prisma from './prisma.js';
import {
  STATUS_TIERS, MIN_REDEEM_POINTS,
  getStatusTiers, getNitroStatus,
  computeNitroDiscount, computePointsEarnedKobo,
  pointsFromKobo, pointsFromKoboExact,
} from './nitro-rewards-core.js';

export { STATUS_TIERS, MIN_REDEEM_POINTS, getStatusTiers, getNitroStatus, computeNitroDiscount, computePointsEarnedKobo, pointsFromKobo, pointsFromKoboExact };

function getNextTier(currentKey) {
  const idx = STATUS_TIERS.findIndex(t => t.key === currentKey);
  return idx >= 0 && idx < STATUS_TIERS.length - 1 ? STATUS_TIERS[idx + 1] : null;
}

export async function getEligibleSpendKobo(userId) {
  const eligibleOrders = await prisma.order.findMany({
    where: { userId, status: { in: ['Completed', 'Partial'] }, deletedAt: null },
    select: { id: true, orderId: true, charge: true, nitroPointsRedeemedKobo: true },
  });
  if (!eligibleOrders.length) return 0;

  const totalCharge = eligibleOrders.reduce((sum, o) => sum + o.charge, 0);
  const totalPointsRedeemed = eligibleOrders.reduce((sum, o) => sum + (o.nitroPointsRedeemedKobo || 0), 0);
  const refs = eligibleOrders.flatMap(o => [`REF-${o.orderId}`, `ADM-REF-${o.orderId}`]);
  const orderDbIds = eligibleOrders.map(o => o.id);

  const [refundAgg, bonusAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, type: 'refund', status: 'Completed', reference: { in: refs } },
      _sum: { amount: true },
    }),
    prisma.orderCreditUsage.aggregate({
      where: { orderId: { in: orderDbIds } },
      _sum: { amount: true },
    }),
  ]);
  return Math.max(0, totalCharge - (refundAgg._sum.amount || 0) - (bonusAgg._sum.amount || 0) - totalPointsRedeemed);
}

/**
 * Calculate canonical Nitro Status spend for several users in one batch.
 *
 * This deliberately mirrors getEligibleSpendKobo: only completed/partial,
 * non-deleted orders count, and completed refunds, bonus-credit usage, and
 * redeemed Nitro points are deducted. Aggregation stays inside Postgres so a
 * leaderboard does not materialize every lifetime order or issue N+1 queries.
 */
export async function getEligibleSpendKoboBatch(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const spendByUser = new Map(ids.map(userId => [userId, 0]));
  if (!ids.length) return spendByUser;

  // Refunds and credit usages are aggregated in separate CTEs before joining
  // so multiple rows on either side cannot multiply the deducted amount.
  const rows = await prisma.$queryRaw`
    WITH eligible_orders AS (
      SELECT
        o.id,
        o."orderId",
        o."userId",
        o.charge,
        o."nitroPointsRedeemedKobo"
      FROM orders o
      WHERE o."userId" = ANY(${ids})
        AND o.status IN ('Completed', 'Partial')
        AND o."deletedAt" IS NULL
    ),
    order_totals AS (
      SELECT
        "userId",
        SUM(charge)::bigint AS charge,
        SUM(COALESCE("nitroPointsRedeemedKobo", 0))::bigint AS points_redeemed
      FROM eligible_orders
      GROUP BY "userId"
    ),
    refund_totals AS (
      SELECT eo."userId", SUM(t.amount)::bigint AS refunds
      FROM eligible_orders eo
      JOIN transactions t
        ON t."userId" = eo."userId"
       AND (
         t.reference = 'REF-' || eo."orderId"
         OR t.reference = 'ADM-REF-' || eo."orderId"
       )
       AND t.type = 'refund'
       AND t.status = 'Completed'
      GROUP BY eo."userId"
    ),
    bonus_totals AS (
      SELECT eo."userId", SUM(ocu.amount)::bigint AS bonus_used
      FROM eligible_orders eo
      JOIN order_credit_usages ocu ON ocu."orderId" = eo.id
      GROUP BY eo."userId"
    )
    SELECT
      ot."userId",
      GREATEST(
        0::bigint,
        ot.charge
          - ot.points_redeemed
          - COALESCE(rt.refunds, 0)
          - COALESCE(bt.bonus_used, 0)
      )::bigint AS "eligibleSpendKobo"
    FROM order_totals ot
    LEFT JOIN refund_totals rt ON rt."userId" = ot."userId"
    LEFT JOIN bonus_totals bt ON bt."userId" = ot."userId"
  `;

  for (const row of rows) {
    if (!spendByUser.has(row.userId)) continue;
    spendByUser.set(row.userId, Math.max(0, Number(row.eligibleSpendKobo) || 0));
  }

  return spendByUser;
}

export async function getPointsBalanceKobo(userId) {
  const agg = await prisma.nitroPointLedger.aggregate({
    where: { userId },
    _sum: { pointsKobo: true },
  });
  return agg._sum.pointsKobo || 0;
}

export async function getPointsTotals(userId) {
  const rows = await prisma.nitroPointLedger.groupBy({
    by: ['type'],
    where: { userId },
    _sum: { pointsKobo: true },
    _count: true,
  });
  const totals = {};
  for (const r of rows) {
    totals[r.type] = { kobo: r._sum.pointsKobo || 0, count: r._count };
  }
  return totals;
}

export async function getPointsBalanceKoboTx(tx, userId) {
  const agg = await tx.nitroPointLedger.aggregate({
    where: { userId },
    _sum: { pointsKobo: true },
  });
  return agg._sum.pointsKobo || 0;
}

export async function getPointsHistory(userId, limit = 10) {
  const rows = await prisma.nitroPointLedger.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { order: { select: { orderId: true } } },
  });

  const kindMap = {
    earned_order: 'earned',
    redeemed_order: 'spent',
    reversed_refund: 'reversed',
    restored_refund: 'earned',
    manual_credit: 'earned',
    manual_debit: 'reversed',
    opening_balance: 'earned',
    account_closure: 'reversed',
  };
  const labelMap = {
    earned_order: 'Earned',
    redeemed_order: 'Spent',
    reversed_refund: 'Reversed',
    restored_refund: 'Restored',
    manual_credit: 'Credit',
    manual_debit: 'Debit',
    opening_balance: 'Opening balance',
    account_closure: 'Closed',
  };

  return rows.map(r => ({
    kind: kindMap[r.type] || 'earned',
    label: labelMap[r.type] || r.type,
    ref: r.order ? `#${r.order.orderId}` : (r.reason || '—'),
    refType: r.orderId ? 'order' : 'admin',
    pts: pointsFromKoboExact(r.pointsKobo),
  }));
}

export async function getRewardsPayload(userId) {
  const [spendKobo, balanceKobo, history] = await Promise.all([
    getEligibleSpendKobo(userId),
    getPointsBalanceKobo(userId),
    getPointsHistory(userId),
  ]);

  const spendNaira = Math.floor(spendKobo / 100);
  const current = getNitroStatus(spendNaira);
  const next = getNextTier(current.key);

  const balancePoints = pointsFromKobo(balanceKobo);
  const redeemable = balanceKobo >= MIN_REDEEM_POINTS * 100;

  return {
    status: {
      key: current.key,
      name: current.name,
      color: current.color,
      eligibleSpend: spendNaira,
      currentMin: current.min,
      nextName: next ? next.name : null,
      nextColor: next ? next.color : null,
      nextMin: next ? next.min : null,
      remainingToNext: next ? Math.max(0, next.min - spendNaira) : 0,
      progressPct: next
        ? Math.min(100, Math.round((spendNaira / next.min) * 1000) / 10)
        : 100,
      discountPct: current.discountPct,
      pointEarnPct: current.pointEarnPct,
    },
    points: {
      balance: balancePoints,
      valueNaira: balancePoints,
      minRedeem: MIN_REDEEM_POINTS,
      redeemable,
      neededToRedeem: redeemable ? 0 : Math.ceil(((MIN_REDEEM_POINTS * 100) - balanceKobo) / 100),
    },
    tasks: { available: 0, topReward: 0 },
    history,
  };
}

// ── Phase 2: Order-time helpers (pure functions re-exported from nitro-rewards-core.js) ──

export async function getEligibleSpendKoboTx(tx, userId) {
  const eligibleOrders = await tx.order.findMany({
    where: { userId, status: { in: ['Completed', 'Partial'] }, deletedAt: null },
    select: { id: true, orderId: true, charge: true, nitroPointsRedeemedKobo: true },
  });
  if (!eligibleOrders.length) return 0;

  const totalCharge = eligibleOrders.reduce((sum, o) => sum + o.charge, 0);
  const totalPointsRedeemed = eligibleOrders.reduce((sum, o) => sum + (o.nitroPointsRedeemedKobo || 0), 0);
  const refs = eligibleOrders.flatMap(o => [`REF-${o.orderId}`, `ADM-REF-${o.orderId}`]);
  const orderDbIds = eligibleOrders.map(o => o.id);

  const [refundAgg, bonusAgg] = await Promise.all([
    tx.transaction.aggregate({
      where: { userId, type: 'refund', status: 'Completed', reference: { in: refs } },
      _sum: { amount: true },
    }),
    tx.orderCreditUsage.aggregate({
      where: { orderId: { in: orderDbIds } },
      _sum: { amount: true },
    }),
  ]);
  return Math.max(0, totalCharge - (refundAgg._sum.amount || 0) - (bonusAgg._sum.amount || 0) - totalPointsRedeemed);
}

export async function awardOrderPoints(tx, { userId, orderId, orderDbId, chargeKobo, tier }) {
  const pointsKobo = computePointsEarnedKobo(chargeKobo, tier);
  if (pointsKobo <= 0) return 0;

  // A no-op balance update gives every positive points effect the same user-row
  // ownership fence as wallet credits. If permanent deletion committed first,
  // no late completion can recreate a points liability.
  const eligible = await tx.user.updateMany({
    where: {
      id: userId,
      status: { not: 'Deleted' },
      anonymizedAt: null,
    },
    data: { balance: { increment: 0 } },
  });
  if (eligible.count !== 1) return 0;

  await tx.nitroPointLedger.create({
    data: {
      userId,
      type: 'earned_order',
      pointsKobo,
      dedupeKey: `earned_order:${orderDbId}`,
      orderId: orderDbId,
      statusAtEvent: tier.key,
      pointRateAtEvent: tier.pointEarnPct,
      eligibleSpendKobo: chargeKobo,
    },
  });

  await tx.order.update({
    where: { id: orderDbId },
    data: { nitroPointsEarnedKobo: pointsKobo },
  });

  return pointsKobo;
}

export async function reverseOrderPoints(tx, { orderDbId, refundAmountKobo }) {
  if (refundAmountKobo <= 0) return 0;

  const order = await tx.order.findUnique({
    where: { id: orderDbId },
    select: { charge: true, nitroPointsEarnedKobo: true, nitroPointsRedeemedKobo: true, userId: true, nitroStatusAtPurchase: true },
  });
  if (!order || order.charge <= 0) return 0;

  const redeemed = order.nitroPointsRedeemedKobo || 0;
  if (order.nitroPointsEarnedKobo <= 0 && redeemed <= 0) return 0;

  // Freeze every points mutation once permanent deletion wins. The account
  // closure entry has already brought the retained ledger to zero, so even a
  // later negative reversal would otherwise create a false negative balance.
  const eligible = await tx.user.updateMany({
    where: {
      id: order.userId,
      status: { not: 'Deleted' },
      anonymizedAt: null,
    },
    data: { balance: { increment: 0 } },
  });
  if (eligible.count !== 1) return 0;

  let reverseKobo = 0;
  if (order.nitroPointsEarnedKobo > 0) {
    const alreadyAgg = await tx.nitroPointLedger.aggregate({
      where: { orderId: orderDbId, type: 'reversed_refund' },
      _sum: { pointsKobo: true },
    });
    const alreadyReversedKobo = Math.abs(alreadyAgg._sum.pointsKobo || 0);
    const maxReversible = order.nitroPointsEarnedKobo - alreadyReversedKobo;
    if (maxReversible > 0) {
      const proportional = Math.floor(order.nitroPointsEarnedKobo * refundAmountKobo / order.charge);
      reverseKobo = Math.min(maxReversible, Math.max(0, proportional));
      if (reverseKobo > 0) {
        await tx.nitroPointLedger.create({
          data: {
            userId: order.userId,
            type: 'reversed_refund',
            pointsKobo: -reverseKobo,
            orderId: orderDbId,
            statusAtEvent: order.nitroStatusAtPurchase,
          },
        });
      }
    }
  }

  if (redeemed > 0) {
    const restoredAgg = await tx.nitroPointLedger.aggregate({
      where: { orderId: orderDbId, type: 'restored_refund' },
      _sum: { pointsKobo: true },
    });
    const alreadyRestored = restoredAgg._sum.pointsKobo || 0;
    const maxRestorable = redeemed - alreadyRestored;
    if (maxRestorable > 0) {
      const proportional = Math.floor(redeemed * refundAmountKobo / order.charge);
      const restoreKobo = Math.min(maxRestorable, Math.max(0, proportional));
      if (restoreKobo > 0) {
        await tx.nitroPointLedger.create({
          data: {
            userId: order.userId,
            type: 'restored_refund',
            pointsKobo: restoreKobo,
            orderId: orderDbId,
            statusAtEvent: order.nitroStatusAtPurchase,
          },
        });
      }
    }
  }

  return reverseKobo;
}

export async function awardPointsOnCompletion(orderDbId, tx) {
  const db = tx || prisma;
  const order = await db.order.findUnique({
    where: { id: orderDbId },
    select: { id: true, orderId: true, userId: true, charge: true, quantity: true, remains: true, status: true, nitroPointsEarnedKobo: true, nitroPointsRedeemedKobo: true, nitroStatusAtPurchase: true, creditUsages: { select: { amount: true } } },
  });
  if (!order || order.nitroPointsEarnedKobo > 0) return 0;
  if (order.status !== 'Completed' && order.status !== 'Partial') return 0;
  const bonusUsed = order.creditUsages.reduce((s, u) => s + (u.amount || 0), 0);
  let eligibleCharge = order.charge - (order.nitroPointsRedeemedKobo || 0) - bonusUsed;
  if (order.status === 'Partial' && order.quantity > 0 && order.remains > 0) {
    const deliveredQty = Math.max(0, order.quantity - order.remains);
    eligibleCharge = Math.floor(eligibleCharge * deliveredQty / order.quantity);
  }
  if (eligibleCharge <= 0) return 0;
  const tierKey = order.nitroStatusAtPurchase;
  if (!tierKey) return 0;
  const tier = STATUS_TIERS.find(t => t.key === tierKey);
  if (!tier) return 0;
  return awardOrderPoints(db, { userId: order.userId, orderId: order.orderId, orderDbId: order.id, chargeKobo: eligibleCharge, tier });
}

export function computeRefundSplit(charge, nitroPointsRedeemedKobo, refundAmountKobo) {
  const redeemed = nitroPointsRedeemedKobo || 0;
  if (charge <= 0) return { walletRefund: 0, pointsRestore: 0 };
  const walletPaid = charge - redeemed;
  const fraction = refundAmountKobo / charge;
  return {
    walletRefund: Math.floor(walletPaid * fraction),
    pointsRestore: Math.floor(redeemed * fraction),
  };
}

export async function getTotalRefundedKobo(tx, { orderId, orderDbId, userId }) {
  const [txAgg, pointsAgg] = await Promise.all([
    tx.transaction.aggregate({
      where: { userId, type: 'refund', status: 'Completed', reference: { in: [`REF-${orderId}`, `ADM-REF-${orderId}`] } },
      _sum: { amount: true },
    }),
    tx.nitroPointLedger.aggregate({
      where: { orderId: orderDbId, type: 'restored_refund' },
      _sum: { pointsKobo: true },
    }),
  ]);
  return (txAgg._sum.amount || 0) + (pointsAgg._sum.pointsKobo || 0);
}
