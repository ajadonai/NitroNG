import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DAO_SERVICE_ID = 'cmnvx4mkg03m4jm04yv83k3pu';
const DAO_COST_PER_1K = 52;
const USD_RATE = 1571;
const PROVIDER_MIN = 10;

const DRIP = {
  followers: { batchSize: 200, intervalHours: 2 },
  likes:     { batchSize: 200, intervalHours: 1 },
};

function calcIntraday(quantity, startTime, svcType) {
  const cfg = DRIP[svcType] || DRIP.followers;
  let n = Math.floor(quantity / cfg.batchSize);
  if (n < 2) return null;
  const minB = Math.max(PROVIDER_MIN * 2, 50);
  while (n > 2 && Math.floor(quantity / n) < minB) n--;
  if (Math.floor(quantity / n) < PROVIDER_MIN) return null;
  const per = Math.floor(quantity / n);
  const rem = quantity - per * n;
  return Array.from({ length: n }, (_, i) => ({
    day: 1, batch: i + 1,
    quantity: i === n - 1 ? per + rem : per,
    scheduledAt: new Date(startTime.getTime() + i * cfg.intervalHours * 3600000),
  }));
}

function calcMultiDay(quantity, dripDays, startTime, svcType) {
  const perDay = Math.floor(quantity / dripDays);
  const rem = quantity - perDay * dripDays;
  const all = [];
  for (let day = 1; day <= dripDays; day++) {
    const dayQty = day === dripDays ? perDay + rem : perDay;
    const dayStart = new Date(startTime.getTime() + (day - 1) * 86400000);
    const intra = calcIntraday(dayQty, dayStart, svcType);
    if (intra) {
      for (const d of intra) all.push({ ...d, day });
    } else {
      all.push({ day, batch: 1, quantity: dayQty, scheduledAt: dayStart });
    }
  }
  return all;
}

async function main() {
  const now = new Date();
  const ORDER_IDS = [
    'NTR-3137','NTR-3138','NTR-3139','NTR-3140',
    'NTR-3141','NTR-3142','NTR-3143',
  ];

  for (const oid of ORDER_IDS) {
    console.log(`\n=== ${oid} ===`);

    const order = await prisma.order.findUnique({
      where: { orderId: oid },
      include: { dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] } },
    });
    if (!order) { console.log('  NOT FOUND'); continue; }

    const svcType = (order.serviceTypeAtPurchase || 'followers').toLowerCase();
    const newCost = Math.ceil((DAO_COST_PER_1K * USD_RATE / 1000) * order.quantity / 100) * 100;

    // Build new dispatch schedule
    let dispatches = [];
    if (order.dripDays && order.dripDays > 1) {
      dispatches = calcMultiDay(order.quantity, order.dripDays, now, svcType);
    } else {
      const intra = calcIntraday(order.quantity, now, svcType);
      if (intra) dispatches = intra;
    }

    const dripDays = dispatches.length > 0 ? (order.dripDays || 1) : null;

    console.log(`  qty=${order.quantity} ${svcType}, old cost=₦${order.cost/100}, new cost=₦${newCost/100}`);
    if (dispatches.length > 0) {
      console.log(`  ${dispatches.length} batches: ${dispatches.map(d => 'D'+d.day+'B'+d.batch+':'+d.quantity).join(', ')}`);
    } else {
      console.log('  No drip (single batch)');
    }

    await prisma.$transaction(async (tx) => {
      // 1. Fail all existing dispatches
      if (order.dripDispatches.length > 0) {
        await tx.dripDispatch.updateMany({
          where: { orderId: order.id },
          data: { status: 'failed', lastError: 'Rerouted to Dao', completedAt: now },
        });
      }

      // 2. Update order: switch service, reset to Pending, update cost
      await tx.order.update({
        where: { id: order.id },
        data: {
          serviceId: DAO_SERVICE_ID,
          status: 'Pending',
          cost: newCost,
          apiOrderId: null,
          remains: null,
          startCount: null,
          dispatchedAt: null,
          completedAt: null,
          dripDelivered: 0,
          dripDays,
          lastError: null,
          retryCount: 0,
        },
      });

      // 3. Create fresh dispatches
      if (dispatches.length > 0) {
        await tx.dripDispatch.createMany({
          data: dispatches.map(d => ({
            orderId: order.id, day: d.day, batch: d.batch,
            quantity: d.quantity, status: 'pending', scheduledAt: d.scheduledAt,
          })),
        });
      }

      console.log('  ✓ Rerouted to Dao.');
    }, { timeout: 30000 });
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());
