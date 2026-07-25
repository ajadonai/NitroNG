import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRIP = { batchSize: 200, intervalHours: 2, threshold: 200 };
const PROVIDER_MIN = 5;
const COST_PER_1K = 108;
const USD_RATE = 1571;

function calcIntraday(quantity, startTime) {
  if (quantity < DRIP.threshold) return null;
  let n = Math.floor(quantity / DRIP.batchSize);
  if (n < 2) return null;
  const minB = Math.max(PROVIDER_MIN * 2, 50);
  while (n > 2 && Math.floor(quantity / n) < minB) n--;
  if (Math.floor(quantity / n) < PROVIDER_MIN) return null;
  const per = Math.floor(quantity / n);
  const rem = quantity - per * n;
  return Array.from({ length: n }, (_, i) => ({
    day: 1, batch: i + 1,
    quantity: i === n - 1 ? per + rem : per,
    scheduledAt: new Date(startTime.getTime() + i * DRIP.intervalHours * 3600000),
  }));
}

async function main() {
  const DRY = process.argv.includes('--dry');
  const now = new Date();

  const rows = await prisma.order.findMany({
    where: { OR: [{ orderId: { startsWith: 'NTR-' } }, { orderId: { startsWith: 'ORD-' } }] },
    select: { orderId: true }, orderBy: { createdAt: 'desc' }, take: 20,
  });
  let maxId = 0;
  for (const r of rows) {
    const n = parseInt(r.orderId.replace(/^(NTR|ORD)-/, ''), 10);
    if (!isNaN(n) && n > maxId) maxId = n;
  }
  let nextId = maxId + 1;
  console.log(`Next order ID: NTR-${nextId}`);
  if (DRY) console.log('*** DRY RUN ***\n');

  // 12 untouched orders + NTR-2533 fix
  const ORDER_IDS = [
    'NTR-2478', 'NTR-2493', 'NTR-2533', 'NTR-2552', 'NTR-2553',
    'NTR-2584', 'NTR-2627', 'NTR-2639', 'NTR-2672', 'NTR-2693',
    'NTR-2723', 'NTR-2724', 'NTR-2806',
  ];

  const mtpToCancel = [];

  for (const oid of ORDER_IDS) {
    console.log(`\n=== ${oid} ===`);

    const order = await prisma.order.findUnique({
      where: { orderId: oid },
      include: { dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] } },
    });

    const isAlreadyCompleted = order.status === 'Completed';
    const procDisps = order.dripDispatches.filter(d => d.status === 'processing');
    const pendDisps = order.dripDispatches.filter(d => d.status === 'pending');

    // For NTR-2533: dispatches already failed, but we still need 200 qty new order
    let newQty;
    if (isAlreadyCompleted && procDisps.length === 0 && pendDisps.length === 0) {
      // NTR-2533 case: use the failed dispatches that were processing before
      const failedProc = order.dripDispatches.filter(d => d.status === 'failed' && d.lastError?.includes('split fix'));
      newQty = failedProc.reduce((a, d) => a + d.quantity, 0);
      if (newQty === 0) { console.log('  Already completed, nothing to split.'); continue; }
      console.log(`  (Already completed — creating new order for ${newQty} from previously failed processing batch)`);
    } else {
      newQty = procDisps.reduce((a, d) => a + d.quantity, 0)
             + pendDisps.reduce((a, d) => a + d.quantity, 0);
    }

    if (newQty === 0) { console.log('  Nothing to split.'); continue; }

    // Collect MTP orders to cancel
    for (const d of [...procDisps, ...pendDisps]) {
      if (d.apiOrderId) mtpToCancel.push({ order: oid, batch: d.day+'.'+d.batch, mtp: d.apiOrderId });
    }

    // Round charge to clean naira (floor to nearest 100 kobo)
    const rawRefund = newQty * (order.charge / order.quantity);
    const refundAmt = Math.floor(rawRefund / 100) * 100;
    const newCost = Math.ceil((COST_PER_1K * USD_RATE / 1000) * newQty / 100) * 100;
    const newOrderId = `NTR-${nextId++}`;

    const dispatches = calcIntraday(newQty, now);
    const dripDays = dispatches ? 1 : null;

    console.log(`  Split: ${newQty} followers, charge=₦${refundAmt/100}, cost=₦${newCost/100}`);
    console.log(`  New ${newOrderId}, margin=₦${(refundAmt-newCost)/100}`);
    if (dispatches) {
      console.log(`  Batches: ${dispatches.map(d => `B${d.batch}:${d.quantity}`).join(', ')}`);
    } else {
      console.log('  No drip (single batch)');
    }

    if (DRY) continue;

    await prisma.$transaction(async (tx) => {
      // Fail processing + pending dispatches (skip if already done, e.g. NTR-2533)
      if (!isAlreadyCompleted) {
        const failIds = [...procDisps, ...pendDisps].map(d => d.id);
        if (failIds.length > 0) {
          await tx.dripDispatch.updateMany({
            where: { id: { in: failIds } },
            data: { status: 'failed', lastError: `Replaced by ${newOrderId}`, completedAt: now },
          });
        }
        await tx.order.update({ where: { id: order.id }, data: { status: 'Completed', completedAt: now } });
      }

      // Silent refund
      await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: refundAmt } } });
      await tx.transaction.create({
        data: {
          userId: order.userId, type: 'refund', amount: refundAmt, status: 'Completed',
          reference: `SPLIT-FIX-${order.orderId}-REF`,
          note: `Silent refund: split from ${order.orderId}`,
        },
      });

      // Create new order
      const created = await tx.order.create({
        data: {
          orderId: newOrderId, userId: order.userId, serviceId: order.serviceId,
          tierId: order.tierId, link: order.link, quantity: newQty,
          charge: refundAmt, cost: newCost, status: 'Pending',
          comments: order.comments, dripDays,
          parentOrderId: order.orderId,
          serviceNameAtPurchase: order.serviceNameAtPurchase,
          tierNameAtPurchase: order.tierNameAtPurchase,
          platformAtPurchase: order.platformAtPurchase,
          serviceTypeAtPurchase: order.serviceTypeAtPurchase,
          nitroStatusAtPurchase: order.nitroStatusAtPurchase,
          loyaltyDiscount: order.loyaltyDiscount,
        },
      });

      // Deduct from wallet (net zero)
      await tx.user.update({ where: { id: order.userId }, data: { balance: { decrement: refundAmt } } });
      await tx.transaction.create({
        data: {
          userId: order.userId, type: 'order', amount: -refundAmt, status: 'Completed',
          reference: `SPLIT-FIX-${newOrderId}-CHG`,
          note: `Split order from ${order.orderId}`,
        },
      });

      // Create drip dispatches
      if (dispatches) {
        await tx.dripDispatch.createMany({
          data: dispatches.map(d => ({
            orderId: created.id, day: d.day, batch: d.batch,
            quantity: d.quantity, status: 'pending', scheduledAt: d.scheduledAt,
          })),
        });
      }

      console.log('  ✓ Committed.');
    }, { timeout: 15000 });
  }

  console.log('\n=== DONE ===');
  if (mtpToCancel.length > 0) {
    console.log('\nMTP processing orders to cancel:');
    for (const m of mtpToCancel) console.log(`  ${m.order} batch ${m.batch}: ${m.mtp}`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());
