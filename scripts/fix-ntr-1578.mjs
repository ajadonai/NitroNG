import { calculateMultiDayDrip } from '../lib/drip-feed.js';
import {
  isMainModule,
  runGuardedPrismaScript,
} from './lib/guarded-operation.mjs';

export const SCRIPT_OPERATION = 'fix-ntr-1578';

export async function main({ prisma, dryRun, logger = console }) {
  const order = await prisma.order.findUnique({
    where: { orderId: 'NTR-1578' },
    include: {
      dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] },
      service: { select: { min: true, category: true } },
    },
  });

  if (!order) { logger.log('Order NTR-1578 not found'); return; }
  if (order.dripDays === 5) { logger.log('dripDays already 5'); return; }

  const inFlight = order.dripDispatches.filter(d => d.status !== 'pending');
  const pending = order.dripDispatches.filter(d => d.status === 'pending');
  const inFlightQty = inFlight.reduce((s, d) => s + d.quantity, 0);
  const remainingQty = order.quantity - inFlightQty;

  logger.log(`Current: ${order.dripDays} days, ${order.dripDispatches.length} dispatches`);
  logger.log(`In-flight: ${inFlight.length} (${inFlightQty} qty), Pending: ${pending.length}`);
  logger.log(`Remaining to schedule: ${remainingQty}`);

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
    logger.log(`Adjusted last batch (day ${last.day} batch ${last.batch}) by ${-excess} → ${last.quantity}`);
  }

  const newQty = inFlightQty + newDispatches.reduce((s, d) => s + d.quantity, 0);
  logger.log(`Total check: ${newQty} (should be ${order.quantity})`);
  if (newQty !== order.quantity) { logger.error('Still mismatched, aborting.'); return; }

  logger.log(`\nNew schedule (${newDispatches.length} dispatches):`);
  const days = {};
  for (const d of newDispatches) { days[d.day] = (days[d.day] || 0) + d.quantity; }
  for (const d of inFlight) { days[d.day] = (days[d.day] || 0) + d.quantity; }
  for (const [day, qty] of Object.entries(days).sort()) logger.log(`  Day ${day}: ${qty}`);

  if (dryRun) {
    logger.log('\n[DRY-RUN] Would replace pending dispatches and set dripDays=5.');
    return { dryRun: true, dispatchCount: newDispatches.length };
  }

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

  logger.log('\nDone: dripDays=5, dispatches redistributed.');
  return { dryRun: false, dispatchCount: newDispatches.length };
}

if (isMainModule(import.meta.url)) {
  runGuardedPrismaScript({ operation: SCRIPT_OPERATION, main })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
