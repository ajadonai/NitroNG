import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SPLIT_ORDER_IDS = [
  'NTR-3125','NTR-3126','NTR-3127',
  'NTR-3131','NTR-3132',
  // NTR-3133 excluded — single batch, already dispatched
  'NTR-3134','NTR-3135','NTR-3136','NTR-3137',
  'NTR-3138','NTR-3139','NTR-3140','NTR-3141',
  'NTR-3142','NTR-3143',
];

async function main() {
  const DRY = process.argv.includes('--dry');
  if (DRY) console.log('*** DRY RUN ***\n');
  const now = new Date();

  for (const oid of SPLIT_ORDER_IDS) {
    console.log(`\n=== ${oid} ===`);

    const order = await prisma.order.findUnique({
      where: { orderId: oid },
      include: {
        dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] },
      },
    });
    if (!order) { console.log('  NOT FOUND'); continue; }
    if (!order.parentOrderId) { console.log('  No parent — skip'); continue; }

    const pending = order.dripDispatches.filter(d => d.status === 'pending');
    if (pending.length === 0) { console.log('  No pending batches — skip'); continue; }

    // Find the MTP ID from the parent's failed dispatch
    const parent = await prisma.order.findUnique({
      where: { orderId: order.parentOrderId },
      include: {
        dripDispatches: {
          where: { status: 'failed', apiOrderId: { not: null } },
          orderBy: [{ day: 'asc' }, { batch: 'asc' }],
        },
      },
    });

    let mtpId = null;
    if (parent) {
      const failedWithMtp = parent.dripDispatches.find(
        d => d.lastError && d.lastError.includes(`Replaced by ${oid}`)
      );
      if (failedWithMtp) mtpId = failedWithMtp.apiOrderId;
      // Fallback: any failed dispatch with an MTP ID
      if (!mtpId && parent.dripDispatches.length > 0) {
        mtpId = parent.dripDispatches[0].apiOrderId;
      }
    }

    const firstPending = pending[0];
    console.log(`  Parent: ${order.parentOrderId}, MTP ID: ${mtpId || 'unknown'}`);
    console.log(`  Marking D${firstPending.day}B${firstPending.batch} (qty=${firstPending.quantity}) as completed`);
    console.log(`  Remaining pending after: ${pending.length - 1}`);

    if (DRY) continue;

    await prisma.dripDispatch.update({
      where: { id: firstPending.id },
      data: {
        status: 'completed',
        completedAt: now,
        lastError: mtpId ? `Covered by MTP ${mtpId}` : 'Covered by old MTP delivery',
      },
    });
    console.log('  ✓ Done.');
  }

  console.log('\n=== COMPLETE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());
