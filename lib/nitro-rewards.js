import prisma from '@/lib/prisma';

const STATUS_TIERS = [
  { key: 'spark',  name: 'Spark',  min: 0,        discountPct: 0,   pointEarnPct: 0.5 },
  { key: 'pulse',  name: 'Pulse',  min: 400000,   discountPct: 0.5, pointEarnPct: 1 },
  { key: 'boost',  name: 'Boost',  min: 1500000,  discountPct: 1,   pointEarnPct: 1.25 },
  { key: 'surge',  name: 'Surge',  min: 7500000,  discountPct: 2,   pointEarnPct: 1.5 },
  { key: 'apex',   name: 'Apex',   min: 37500000, discountPct: 3,   pointEarnPct: 1.75 },
  { key: 'legend', name: 'Legend', min: 75000000, discountPct: 4,   pointEarnPct: 2 },
];

const MIN_REDEEM_POINTS = 5000;

export function getStatusTiers() {
  return STATUS_TIERS;
}

export function getNitroStatus(eligibleSpendNaira) {
  let tier = STATUS_TIERS[0];
  for (const t of STATUS_TIERS) {
    if (eligibleSpendNaira >= t.min) tier = t;
    else break;
  }
  return tier;
}

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
  };
  const labelMap = {
    earned_order: 'Earned',
    redeemed_order: 'Spent',
    reversed_refund: 'Reversed',
    restored_refund: 'Restored',
    manual_credit: 'Credit',
    manual_debit: 'Debit',
    opening_balance: 'Opening balance',
  };

  return rows.map(r => ({
    kind: kindMap[r.type] || 'earned',
    label: labelMap[r.type] || r.type,
    ref: r.order ? `#${r.order.orderId}` : (r.reason || '—'),
    refType: r.orderId ? 'order' : 'admin',
    pts: Math.round(r.pointsKobo / 100),
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

  const balancePoints = Math.floor(balanceKobo / 100);
  const redeemable = balancePoints >= MIN_REDEEM_POINTS;

  return {
    status: {
      key: current.key,
      name: current.name,
      eligibleSpend: spendNaira,
      currentMin: current.min,
      nextName: next ? next.name : null,
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
      neededToRedeem: redeemable ? 0 : MIN_REDEEM_POINTS - balancePoints,
    },
    tasks: { available: 0, topReward: 0 },
    history,
  };
}

// ── Phase 2: Order-time helpers ──

export function computeNitroDiscount(chargeKobo, tier) {
  if (!tier || tier.discountPct <= 0) return 0;
  return Math.round(chargeKobo * (tier.discountPct / 100));
}

export function computePointsEarnedKobo(eligibleChargeKobo, tier) {
  if (!tier || tier.pointEarnPct <= 0 || eligibleChargeKobo <= 0) return 0;
  return Math.floor(eligibleChargeKobo * tier.pointEarnPct / 100);
}

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

  const redeemed = order.nitroPointsRedeemedKobo || 0;
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

export { STATUS_TIERS, MIN_REDEEM_POINTS };
