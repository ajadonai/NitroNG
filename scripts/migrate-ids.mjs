import {
  isMainModule,
  runGuardedPrismaScript,
} from './lib/guarded-operation.mjs';

export const SCRIPT_OPERATION = 'migrate-display-ids';

export async function main({ prisma, dryRun, logger = console }) {
  // --- Migrate Orders ---
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, orderId: true },
  });

  logger.log(`${dryRun ? 'Previewing' : 'Migrating'} ${orders.length} orders...`);
  for (let i = 0; i < orders.length; i++) {
    const newId = `NTR-${i + 1}`;
    const old = orders[i].orderId;
    if (old === newId) continue;

    if (dryRun) {
      logger.log(`  [dry] order ${old} → ${newId}`);
      continue;
    }

    await prisma.order.update({ where: { id: orders[i].id }, data: { orderId: newId } });

    // Update tickets that reference this order by its display ID
    await prisma.ticket.updateMany({ where: { orderId: old }, data: { orderId: newId } });

    // Update transaction references that match the old order ID
    await prisma.transaction.updateMany({ where: { reference: old }, data: { reference: newId } });

    // Update transaction notes that contain the old order ID
    const txsWithNote = await prisma.transaction.findMany({
      where: { note: { contains: old } },
      select: { id: true, note: true },
    });
    for (const tx of txsWithNote) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { note: tx.note.replace(old, newId) },
      });
    }
  }
  logger.log(`Orders ${dryRun ? 'preview' : 'done'}. Last ID: NTR-${orders.length}`);

  // --- Migrate Tickets ---
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, ticketId: true },
  });

  logger.log(`${dryRun ? 'Previewing' : 'Migrating'} ${tickets.length} tickets...`);
  for (let i = 0; i < tickets.length; i++) {
    const newId = `TKT-${i + 1}`;
    if (tickets[i].ticketId === newId) continue;
    if (dryRun) {
      logger.log(`  [dry] ticket ${tickets[i].ticketId} → ${newId}`);
      continue;
    }
    await prisma.ticket.update({ where: { id: tickets[i].id }, data: { ticketId: newId } });
  }
  logger.log(`Tickets ${dryRun ? 'preview' : 'done'}. Last ID: TKT-${tickets.length}`);

  // --- Migrate Batch IDs ---
  const batches = await prisma.order.findMany({
    where: { batchId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, batchId: true },
  });

  const seen = new Map();
  let batchNum = 0;
  for (const row of batches) {
    if (!seen.has(row.batchId)) {
      batchNum++;
      seen.set(row.batchId, `BULK-${batchNum}`);
    }
  }

  logger.log(`${dryRun ? 'Previewing' : 'Migrating'} ${seen.size} batch IDs...`);
  for (const [oldBatch, newBatch] of seen) {
    if (oldBatch === newBatch) continue;
    if (dryRun) {
      logger.log(`  [dry] batch ${oldBatch} → ${newBatch}`);
      continue;
    }
    await prisma.order.updateMany({ where: { batchId: oldBatch }, data: { batchId: newBatch } });
    await prisma.transaction.updateMany({ where: { reference: oldBatch }, data: { reference: newBatch } });
    const txsWithNote = await prisma.transaction.findMany({
      where: { note: { contains: oldBatch } },
      select: { id: true, note: true },
    });
    for (const tx of txsWithNote) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { note: tx.note.replaceAll(oldBatch, newBatch) },
      });
    }
  }
  logger.log(`Batches ${dryRun ? 'preview' : 'done'}. Last ID: BULK-${batchNum || 0}`);
  return {
    dryRun,
    orders: orders.length,
    tickets: tickets.length,
    batches: seen.size,
  };
}

if (isMainModule(import.meta.url)) {
  runGuardedPrismaScript({ operation: SCRIPT_OPERATION, main })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
