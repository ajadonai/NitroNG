#!/usr/bin/env node
// One-time backfill: award Nitro Points for orders placed during launch weekend
// (Sat Jul 11 – Mon Jul 13 2026) before the points system went live.
//
// Usage:
//   DRY_RUN=1  node scripts/backfill-nitro-launch-weekend-points.mjs
//   CONFIRM=1  node scripts/backfill-nitro-launch-weekend-points.mjs

import { getNitroStatus, computePointsEarnedKobo } from '../lib/nitro-rewards-core.js';

// ── Window ──────────────────────────────────────────────────────
// Saturday Jul 11 00:00 WAT  →  2026-07-10T23:00:00.000Z
// Monday   Jul 13 12:12 WAT  →  rewards commit deployed (97b5696)
export const WINDOW_START = new Date('2026-07-10T23:00:00.000Z');
export const WINDOW_END   = new Date('2026-07-13T12:12:40.000Z');

const REASON = 'Nitro Points launch weekend credit';
const DEDUPE_PREFIX = 'launch_weekend_points';

// ── Pure helpers (exported for testing) ─────────────────────────

export function makeDedupeKey(orderDbId) {
  return `${DEDUPE_PREFIX}:${orderDbId}`;
}

export function computeEligibleCharge(charge, refunded, bonusUsed, pointsRedeemed) {
  return Math.max(0, charge - refunded - bonusUsed - pointsRedeemed);
}

export function isInWindow(date) {
  return date >= WINDOW_START && date < WINDOW_END;
}

export function isEligibleStatus(status) {
  return status === 'Completed' || status === 'Partial';
}

// ── Run only when executed directly ─────────────────────────────
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMain) {
  const { config } = await import('dotenv');
  config({ path: '.env.local' });

  const { PrismaClient } = await import('@prisma/client');

  const prisma = new PrismaClient();

  const dryRun    = process.env.DRY_RUN === '1';
  const confirm   = process.env.CONFIRM === '1';

  if (!dryRun && !confirm) {
    console.error('Safety: pass DRY_RUN=1 or CONFIRM=1');
    process.exit(1);
  }
  if (dryRun && confirm) {
    console.error('Cannot set both DRY_RUN=1 and CONFIRM=1');
    process.exit(1);
  }

  async function getPerOrderEligibleChargeKobo(order) {
    const refs = [`REF-${order.orderId}`, `ADM-REF-${order.orderId}`];
    const [refundAgg, bonusAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: order.userId, type: 'refund', status: 'Completed', reference: { in: refs } },
        _sum: { amount: true },
      }),
      prisma.orderCreditUsage.aggregate({
        where: { orderId: order.id },
        _sum: { amount: true },
      }),
    ]);
    return computeEligibleCharge(
      order.charge,
      refundAgg._sum.amount || 0,
      bonusAgg._sum.amount || 0,
      order.nitroPointsRedeemedKobo || 0,
    );
  }

  async function getUserEligibleSpendNaira(userId) {
    const orders = await prisma.order.findMany({
      where: { userId, status: { in: ['Completed', 'Partial'] }, deletedAt: null },
      select: { id: true, orderId: true, charge: true, nitroPointsRedeemedKobo: true },
    });
    if (!orders.length) return 0;
    const totalCharge = orders.reduce((sum, o) => sum + o.charge, 0);
    const totalRedeemed = orders.reduce((sum, o) => sum + (o.nitroPointsRedeemedKobo || 0), 0);
    const refs = orders.flatMap(o => [`REF-${o.orderId}`, `ADM-REF-${o.orderId}`]);
    const ids = orders.map(o => o.id);
    const [refundAgg, bonusAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'refund', status: 'Completed', reference: { in: refs } },
        _sum: { amount: true },
      }),
      prisma.orderCreditUsage.aggregate({
        where: { orderId: { in: ids } },
        _sum: { amount: true },
      }),
    ]);
    const kobo = Math.max(0, totalCharge - (refundAgg._sum.amount || 0) - (bonusAgg._sum.amount || 0) - totalRedeemed);
    return Math.floor(kobo / 100);
  }

  async function main() {
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Window: ${WINDOW_START.toISOString()} → ${WINDOW_END.toISOString()}`);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: WINDOW_START, lt: WINDOW_END },
        status: { in: ['Completed', 'Partial'] },
        deletedAt: null,
      },
      select: {
        id: true, orderId: true, userId: true, charge: true,
        nitroPointsRedeemedKobo: true, nitroPointsEarnedKobo: true,
        status: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Eligible orders in window: ${orders.length}`);
    if (!orders.length) { console.log('Nothing to do.'); return; }

    const dedupeKeys = orders.map(o => makeDedupeKey(o.id));
    const existing = await prisma.nitroPointLedger.findMany({
      where: { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true },
    });
    const existingSet = new Set(existing.map(e => e.dedupeKey));

    const userSpendCache = new Map();
    let totalPoints = 0, awardedCount = 0, skippedDupe = 0, skippedAlreadyAwarded = 0, skippedZero = 0;
    const perUser = new Map();
    const awardRows = [];

    for (const order of orders) {
      const key = makeDedupeKey(order.id);
      if (existingSet.has(key)) { skippedDupe++; continue; }
      if ((order.nitroPointsEarnedKobo || 0) > 0) { skippedAlreadyAwarded++; continue; }

      const eligible = await getPerOrderEligibleChargeKobo(order);
      if (eligible <= 0) { skippedZero++; continue; }

      if (!userSpendCache.has(order.userId)) {
        userSpendCache.set(order.userId, await getUserEligibleSpendNaira(order.userId));
      }
      const spendNaira = userSpendCache.get(order.userId);
      const tier = getNitroStatus(spendNaira);
      const pointsKobo = computePointsEarnedKobo(eligible, tier);
      if (pointsKobo <= 0) { skippedZero++; continue; }

      awardRows.push({
        userId: order.userId, orderId: order.id, orderDisplayId: order.orderId,
        dedupeKey: key, pointsKobo, eligible, tier, spendNaira,
      });
      totalPoints += pointsKobo;
      awardedCount++;
      const prev = perUser.get(order.userId) || { points: 0, orders: 0 };
      perUser.set(order.userId, { points: prev.points + pointsKobo, orders: prev.orders + 1 });
    }

    console.log(`\nSummary:`);
    console.log(`  Orders to award:   ${awardedCount}`);
    console.log(`  Skipped (dupes):   ${skippedDupe}`);
    console.log(`  Skipped (already): ${skippedAlreadyAwarded}`);
    console.log(`  Skipped (zero):    ${skippedZero}`);
    console.log(`  Users affected:    ${perUser.size}`);
    console.log(`  Total points:      ${totalPoints} kobo (${Math.floor(totalPoints / 100)} display pts)`);

    if (perUser.size <= 30) {
      console.log(`\nPer-user breakdown:`);
      for (const [uid, { points, orders: cnt }] of perUser) {
        console.log(`  ${uid}: ${Math.floor(points / 100)} pts from ${cnt} order(s)`);
      }
    }

    if (dryRun) { console.log('\nDry run complete. No writes or emails.'); return; }

    // ── Live run ──────────────────────────────────────────────
    console.log('\nWriting ledger entries...');
    let wrote = 0;

    for (const row of awardRows) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.nitroPointLedger.create({
            data: {
              userId: row.userId, type: 'manual_credit', pointsKobo: row.pointsKobo,
              dedupeKey: row.dedupeKey, orderId: row.orderId,
              statusAtEvent: row.tier.key, pointRateAtEvent: row.tier.pointEarnPct,
              eligibleSpendKobo: row.eligible, reason: REASON,
            },
          });
          const updated = await tx.order.updateMany({
            where: { id: row.orderId, nitroPointsEarnedKobo: 0 },
            data: { nitroPointsEarnedKobo: row.pointsKobo },
          });
          if (updated.count !== 1) {
            throw new Error(`Order ${row.orderDisplayId} already has Nitro points; skipped`);
          }
        });
        wrote++;
      } catch (e) {
        if (e.code === 'P2002' && e.meta?.target?.includes('dedupeKey')) {
          console.log(`  Dupe caught on write: ${row.dedupeKey}`);
        } else {
          console.error(`  Error writing ${row.orderDisplayId}:`, e.message);
        }
      }
    }

    console.log(`Wrote ${wrote} ledger entries.`);
    console.log('Weekend launch emails are retired; this script only writes missing ledger entries now.');
    console.log('Done.');
  }

  main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
