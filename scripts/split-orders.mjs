import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRIP_CONFIG = {
  followers: { batchSize: 200, intervalHours: 2, threshold: 200 },
  likes:     { batchSize: 200, intervalHours: 1, threshold: 200 },
};

function calcIntraday(quantity, providerMin, startTime, serviceType) {
  const config = DRIP_CONFIG[serviceType];
  if (!config || !quantity || quantity <= 0 || quantity < config.threshold) return null;
  let numBatches = Math.floor(quantity / config.batchSize);
  if (numBatches < 2) return null;
  const minBatch = Math.max(providerMin * 2, 50);
  while (numBatches > 2 && Math.floor(quantity / numBatches) < minBatch) numBatches--;
  if (Math.floor(quantity / numBatches) < providerMin) return null;
  const perBatch = Math.floor(quantity / numBatches);
  const remainder = quantity - perBatch * numBatches;
  const result = [];
  for (let i = 0; i < numBatches; i++) {
    const qty = i === numBatches - 1 ? perBatch + remainder : perBatch;
    const scheduledAt = new Date(startTime.getTime() + i * config.intervalHours * 3600000);
    result.push({ day: 1, batch: i + 1, quantity: qty, scheduledAt });
  }
  return result;
}

function calcMultiDay(quantity, dripDays, providerMin, startTime, serviceType) {
  const perDay = Math.floor(quantity / dripDays);
  const remainder = quantity - perDay * dripDays;
  const all = [];
  for (let day = 1; day <= dripDays; day++) {
    const dayQty = day === dripDays ? perDay + remainder : perDay;
    const dayStart = new Date(startTime.getTime() + (day - 1) * 86400000);
    const intra = calcIntraday(dayQty, providerMin, dayStart, serviceType);
    if (intra) {
      for (const d of intra) all.push({ ...d, day });
    } else {
      all.push({ day, batch: 1, quantity: dayQty, scheduledAt: dayStart });
    }
  }
  return all;
}

async function main() {
  const DRY = process.argv.includes('--dry');
  const now = new Date();
  const usdRate = 1571;

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
  console.log(`Next order ID starts at NTR-${nextId}`);
  if (DRY) console.log('*** DRY RUN — no writes ***\n');

  // ── 1. CANCEL NTR-2473 ──
  console.log('\n=== NTR-2473: CANCEL ===');
  const o2473 = await prisma.order.findUnique({
    where: { orderId: 'NTR-2473' },
    include: { dripDispatches: true },
  });
  const refund2473 = Math.round(250 * (o2473.charge / o2473.quantity));
  console.log(`  Processing batch: 250 qty, refund ${refund2473} kobo (₦${(refund2473 / 100).toFixed(0)})`);

  if (!DRY) {
    await prisma.$transaction(async (tx) => {
      for (const d of o2473.dripDispatches.filter(d => d.status === 'processing')) {
        await tx.dripDispatch.update({
          where: { id: d.id },
          data: { status: 'failed', lastError: 'Order cancelled (split fix)', completedAt: now },
        });
      }
      await tx.order.update({ where: { id: o2473.id }, data: { status: 'Cancelled', completedAt: now } });
      await tx.user.update({ where: { id: o2473.userId }, data: { balance: { increment: refund2473 } } });
      await tx.transaction.create({
        data: {
          userId: o2473.userId, type: 'refund', amount: refund2473, status: 'Completed',
          reference: 'SPLIT-FIX-NTR-2473-REF',
          note: 'Silent refund: NTR-2473 cancelled (split fix)',
        },
      });
      console.log('  ✓ Committed.');
    });
  }

  // ── 2. COMPLETE NTR-2533 ──
  console.log('\n=== NTR-2533: MARK COMPLETED ===');
  if (!DRY) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { orderId: 'NTR-2533' },
        include: { dripDispatches: true },
      });
      for (const d of order.dripDispatches.filter(d => d.status === 'processing')) {
        await tx.dripDispatch.update({
          where: { id: d.id },
          data: { status: 'failed', lastError: 'Marked completed (split fix)', completedAt: now },
        });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: 'Completed', completedAt: now } });
      console.log('  ✓ Committed.');
    });
  } else {
    console.log('  Would mark Completed, fail processing dispatch.');
  }

  // ── 3–6. SPLIT ORDERS ──
  const SPLITS = [
    { orderId: 'NTR-2457', svcType: 'followers', min: 5, costPer1k: 108 },
    { orderId: 'NTR-2686', svcType: 'followers', min: 5, costPer1k: 108 },
    { orderId: 'NTR-2776', svcType: 'followers', min: 5, costPer1k: 108 },
    { orderId: 'NTR-3087', svcType: 'likes',     min: 10, costPer1k: 7  },
  ];

  for (const s of SPLITS) {
    console.log(`\n=== ${s.orderId}: SPLIT ===`);

    const order = await prisma.order.findUnique({
      where: { orderId: s.orderId },
      include: { dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] } },
    });

    const procDisps = order.dripDispatches.filter(d => d.status === 'processing');
    const pendDisps = order.dripDispatches.filter(d => d.status === 'pending');
    const newQty = procDisps.reduce((a, d) => a + d.quantity, 0)
                 + pendDisps.reduce((a, d) => a + d.quantity, 0);

    if (newQty === 0) { console.log('  Nothing to split.'); continue; }

    const unitPrice = order.charge / order.quantity;
    const refundAmt = Math.round(newQty * unitPrice);
    const newCost = Math.ceil((s.costPer1k * usdRate / 1000) * newQty / 100) * 100;
    const newOrderId = `NTR-${nextId++}`;

    let dripDays = null;
    let dispatches = [];
    if (order.dripDays && order.dripDays > 1) {
      dripDays = order.dripDays;
      dispatches = calcMultiDay(newQty, dripDays, s.min, now, s.svcType);
    } else {
      const intra = calcIntraday(newQty, s.min, now, s.svcType);
      if (intra) { dripDays = 1; dispatches = intra; }
    }

    console.log(`  Old: ${order.quantity} ${s.svcType}, charge=${order.charge}, cost=${order.cost}`);
    console.log(`  Split: ${newQty} (${procDisps.length} proc + ${pendDisps.length} pend)`);
    console.log(`  New ${newOrderId}: charge=${refundAmt}, cost=${newCost}, dripDays=${dripDays}`);
    if (dispatches.length > 0) {
      console.log(`  Batches: ${dispatches.map(d => `D${d.day}B${d.batch}:${d.quantity}`).join(', ')}`);
    } else {
      console.log('  No drip (single batch, regular cron dispatches)');
    }
    console.log(`  Margin: ${refundAmt - newCost} kobo (₦${((refundAmt - newCost) / 100).toFixed(0)})`);

    if (DRY) continue;

    await prisma.$transaction(async (tx) => {
      for (const d of [...procDisps, ...pendDisps]) {
        await tx.dripDispatch.update({
          where: { id: d.id },
          data: { status: 'failed', lastError: `Replaced by ${newOrderId}`, completedAt: now },
        });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: 'Completed', completedAt: now } });

      await tx.user.update({ where: { id: order.userId }, data: { balance: { increment: refundAmt } } });
      await tx.transaction.create({
        data: {
          userId: order.userId, type: 'refund', amount: refundAmt, status: 'Completed',
          reference: `SPLIT-FIX-${order.orderId}-REF`,
          note: `Silent refund: split from ${order.orderId}`,
        },
      });

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

      await tx.user.update({ where: { id: order.userId }, data: { balance: { decrement: refundAmt } } });
      await tx.transaction.create({
        data: {
          userId: order.userId, type: 'order', amount: -refundAmt, status: 'Completed',
          reference: `SPLIT-FIX-${newOrderId}-CHG`,
          note: `Split order from ${order.orderId}`,
        },
      });

      for (const d of dispatches) {
        await tx.dripDispatch.create({
          data: {
            orderId: created.id, day: d.day, batch: d.batch,
            quantity: d.quantity, status: 'pending', scheduledAt: d.scheduledAt,
          },
        });
      }
      console.log('  ✓ Committed.');
    });
  }

  console.log('\n=== DONE ===');
  if (!DRY) {
    console.log('All splits committed. No emails/TG sent.');
    console.log('\nMTP orders for user to cancel:');
    console.log('  NTR-2457 batch 2: 4166740');
    console.log('  NTR-2473 batch 2: 4166593');
    console.log('  NTR-2533 batch 2: 4166596');
    console.log('  NTR-2686 batch 1: 4165751');
    console.log('  NTR-2776 batch 1: 4179914');
    console.log('  NTR-3087 batch 5: 4212478');
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());
