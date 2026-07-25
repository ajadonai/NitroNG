import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SPLIT_ORDER_IDS = [
  'NTR-3125','NTR-3126','NTR-3127',
  'NTR-3131','NTR-3132',
  'NTR-3134','NTR-3135','NTR-3136','NTR-3137',
  'NTR-3138','NTR-3139','NTR-3140','NTR-3141',
  'NTR-3142','NTR-3143',
];

async function main() {
  const now = new Date();

  for (const oid of SPLIT_ORDER_IDS) {
    console.log(`\n=== ${oid} ===`);

    const order = await prisma.order.findUnique({
      where: { orderId: oid },
      include: { dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] } },
    });
    if (!order) { console.log('  NOT FOUND'); continue; }

    const b1 = order.dripDispatches.find(d => d.batch === 1);
    const b2 = order.dripDispatches.find(d => d.batch === 2);
    if (!b1 || !b2) { console.log('  Missing B1 or B2 — skip'); continue; }

    console.log(`  B1: ${b1.status} apiOrderId=${b1.apiOrderId}`);
    console.log(`  B2: ${b2.status} lastError=${b2.lastError}`);

    // Save B2's completed/MTP state
    const mtpNote = b2.lastError;

    await prisma.$transaction([
      // B1 becomes completed (MTP covered)
      prisma.dripDispatch.update({
        where: { id: b1.id },
        data: {
          status: 'completed',
          apiOrderId: null,
          remains: null,
          startCount: null,
          completedAt: now,
          lastError: mtpNote,
          dispatchedAt: null,
        },
      }),
      // B2 gets B1's processing state
      prisma.dripDispatch.update({
        where: { id: b2.id },
        data: {
          status: b1.status,
          apiOrderId: b1.apiOrderId,
          remains: b1.remains,
          startCount: b1.startCount,
          completedAt: null,
          lastError: null,
          dispatchedAt: b1.dispatchedAt,
        },
      }),
    ]);

    console.log(`  ✓ Swapped — B1: completed (MTP), B2: ${b1.status} (Dao ${b1.apiOrderId})`);
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());
