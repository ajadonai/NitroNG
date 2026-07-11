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
    select: { id: true, orderId: true, charge: true },
  });
  if (!eligibleOrders.length) return 0;

  const totalCharge = eligibleOrders.reduce((sum, o) => sum + o.charge, 0);
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
  return Math.max(0, totalCharge - (refundAgg._sum.amount || 0) - (bonusAgg._sum.amount || 0));
}

export async function getPointsBalanceKobo(userId) {
  const agg = await prisma.nitroPointLedger.aggregate({
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
    select: { id: true, orderId: true, charge: true },
  });
  if (!eligibleOrders.length) return 0;

  const totalCharge = eligibleOrders.reduce((sum, o) => sum + o.charge, 0);
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
  return Math.max(0, totalCharge - (refundAgg._sum.amount || 0) - (bonusAgg._sum.amount || 0));
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

export { STATUS_TIERS, MIN_REDEEM_POINTS };
