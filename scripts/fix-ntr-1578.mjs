import { PrismaClient } from '@prisma/client';
import { calculateMultiDayDrip } from '../lib/drip-feed.js';

const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findUnique({
    where: { orderId: 'NTR-1578' },
    include: {
      dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] },
      service: { select: { min: true, category: true } },
    },
  });

  if (!order) { console.log('Order NTR-1578 not found'); return; }
  if (order.dripDays === 5) { console.log('dripDays already 5'); return; }

  const inFlight = order.dripDispatches.filter(d => d.status !== 'pending');
  const pending = order.dripDispatches.filter(d => d.status === 'pending');
  const inFlightQty = inFlight.reduce((s, d) => s + d.quantity, 0);
  const remainingQty = order.quantity - inFlightQty;

  console.log(`Current: ${order.dripDays} days, ${order.dripDispatches.length} dispatches`);
  console.log(`In-flight: ${inFlight.length} (${inFlightQty} qty), Pending: ${pending.length}`);
  console.log(`Remaining to schedule: ${remainingQty}`);

  // Generate 5-day schedule for the full quantity, then strip day 1 batch 1
  const providerMin = order.service?.min || 50;
  const platform = (order.service?.category || '').toLowerCase();
  const schedule = calculateMultiDayDrip(order.quantity, 5, providerMin, order.createdAt, 'followers', platform);

  // Remove batch(es) matching in-flight and adjust for quantity difference
  const newDispatches = [];
  let excess = 0;
  for (const d of schedule.dispatches) {
    const match = inFlight.find(inf => inf.day === d.day && inf.batch === d.batch);
    if (match) {
      excess += match.quantity - d.quantity;
      continue;
    }
    newDispatches.push(d);
  }

  // Absorb excess into last dispatch
  if (excess !== 0 && newDispatches.length > 0) {
    const last = newDispatches[newDispatches.length - 1];
    last.quantity -= excess;
    console.log(`Adjusted last batch (day ${last.day} batch ${last.batch}) by ${-excess} → ${last.quantity}`);
  }

  const newQty = inFlightQty + newDispatches.reduce((s, d) => s + d.quantity, 0);
  console.log(`Total check: ${newQty} (should be ${order.quantity})`);
  if (newQty !== order.quantity) { console.error('Still mismatched, aborting.'); return; }

  console.log(`\nNew schedule (${newDispatches.length} dispatches):`);
  const days = {};
  for (const d of newDispatches) { days[d.day] = (days[d.day] || 0) + d.quantity; }
  for (const d of inFlight) { days[d.day] = (days[d.day] || 0) + d.quantity; }
  for (const [day, qty] of Object.entries(days).sort()) console.log(`  Day ${day}: ${qty}`);

  await prisma.$transaction(async (tx) => {
    await tx.dripDispatch.deleteMany({ where: { orderId: order.id, status: 'pending' } });
    await tx.dripDispatch.createMany({
      data: newDispatches.map(d => ({
        orderId: order.id, day: d.day, batch: d.batch,
        quantity: d.quantity, scheduledAt: d.scheduledAt,
      })),
    });
    await tx.order.update({ where: { id: order.id }, data: { dripDays: 5 } });
  });

  console.log('\nDone: dripDays=5, dispatches redistributed.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
