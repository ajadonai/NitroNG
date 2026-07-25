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
  for (const oid of SPLIT_ORDER_IDS) {
    const order = await prisma.order.findUnique({
      where: { orderId: oid },
      include: { dripDispatches: { orderBy: [{ day: 'asc' }, { batch: 'asc' }] } },
    });
    if (!order) { console.log(`${oid}: NOT FOUND`); continue; }

    const all = order.dripDispatches;

    // Same formula as drip cron rollup (section 4)
    const totalRemains = all.reduce((sum, d) => {
      if (d.remains != null) return sum + d.remains;
      if (d.status === 'completed') return sum;
      return sum + d.quantity;
    }, 0);

    // Get startCount from the first processing/completed dispatch that has one
    const withStart = all.find(d => d.startCount != null);
    const startCount = withStart ? Number(withStart.startCount) : null;

    console.log(`${oid}: qty=${order.quantity}, old remains=${order.remains}, new remains=${totalRemains}, startCount=${startCount}`);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        remains: totalRemains,
        ...(startCount != null && order.startCount == null ? { startCount } : {}),
      },
    });
    console.log(`  ✓ Updated.`);
  }
  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());
