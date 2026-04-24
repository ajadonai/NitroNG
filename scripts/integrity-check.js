// Nitro Data Integrity Checker
// Run: DATABASE_URL=your_neon_url node scripts/integrity-check.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n══════════════════════════════════════');
  console.log('  NITRO DATA INTEGRITY CHECK');
  console.log('══════════════════════════════════════\n');

  let issues = 0;

  // 1. Balance vs Transaction History
  console.log('1. BALANCE vs TRANSACTION HISTORY');
  console.log('─────────────────────────────────');
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, balance: true },
  });

  for (const user of users) {
    const txs = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: { type: true, amount: true, status: true },
    });

    // Sum all completed transactions
    let calculated = 0;
    for (const tx of txs) {
      if (tx.status !== 'Completed') continue;
      calculated += tx.amount; // amount is signed: positive = in, negative = out
    }

    const diff = user.balance - calculated;
    if (Math.abs(diff) > 1) { // tolerance of 1 kobo
      console.log(`  ✗ ${user.name} (${user.email})`);
      console.log(`    DB balance: ₦${(user.balance / 100).toFixed(2)}`);
      console.log(`    Calculated: ₦${(calculated / 100).toFixed(2)}`);
      console.log(`    Diff: ₦${(diff / 100).toFixed(2)}`);
      issues++;
    }
  }
  if (issues === 0) console.log('  ✓ All balances match transaction history');

  // 2. Orders with no matching transaction
  console.log('\n2. ORDERS WITHOUT TRANSACTIONS');
  console.log('──────────────────────────────');
  const orders = await prisma.order.findMany({
    where: { deletedAt: null, status: { not: 'Cancelled' } },
    select: { id: true, orderId: true, userId: true, charge: true, status: true },
  });

  let orphanOrders = 0;
  for (const order of orders) {
    const tx = await prisma.transaction.findFirst({
      where: { userId: order.userId, reference: order.orderId, type: 'order' },
    });
    if (!tx) {
      console.log(`  ✗ Order ${order.orderId} (₦${(order.charge / 100).toFixed(2)}) — no matching transaction`);
      orphanOrders++;
      issues++;
    }
  }
  if (orphanOrders === 0) console.log('  ✓ All active orders have matching transactions');

  // 3. Cancelled orders that should have refunds
  console.log('\n3. CANCELLED ORDERS vs REFUNDS');
  console.log('──────────────────────────────');
  const cancelled = await prisma.order.findMany({
    where: { deletedAt: null, status: 'Cancelled' },
    select: { id: true, orderId: true, userId: true, charge: true },
  });

  let missingRefunds = 0;
  for (const order of cancelled) {
    const refund = await prisma.transaction.findFirst({
      where: { userId: order.userId, type: 'refund', reference: { contains: order.orderId || order.id } },
    });
    if (!refund) {
      // Also check if it was cancelled before being charged (e.g. provider-side cancel)
      const orderTx = await prisma.transaction.findFirst({
        where: { userId: order.userId, reference: order.orderId, type: 'order' },
      });
      if (orderTx) {
        console.log(`  ⚠ Cancelled order ${order.orderId} (₦${(order.charge / 100).toFixed(2)}) — charged but no refund found`);
        missingRefunds++;
        issues++;
      }
    }
  }
  if (missingRefunds === 0) console.log('  ✓ All cancelled orders with charges have refunds');

  // 4. Duplicate transactions
  console.log('\n4. DUPLICATE TRANSACTIONS');
  console.log('─────────────────────────');
  const deposits = await prisma.transaction.groupBy({
    by: ['reference'],
    where: { type: 'deposit', status: 'Completed', reference: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (deposits.length > 0) {
    for (const d of deposits) {
      console.log(`  ✗ Duplicate deposit: ${d.reference} (${d._count.id}x)`);
      issues++;
    }
  } else {
    console.log('  ✓ No duplicate deposit transactions');
  }

  // 5. Negative balances
  console.log('\n5. NEGATIVE BALANCES');
  console.log('────────────────────');
  const negativeUsers = await prisma.user.findMany({
    where: { balance: { lt: 0 }, deletedAt: null },
    select: { name: true, email: true, balance: true },
  });

  if (negativeUsers.length > 0) {
    for (const u of negativeUsers) {
      console.log(`  ✗ ${u.name} (${u.email}): ₦${(u.balance / 100).toFixed(2)}`);
      issues++;
    }
  } else {
    console.log('  ✓ No negative balances');
  }

  // 6. Orders stuck in Processing/Pending
  console.log('\n6. STALE ORDERS (>24h in Processing/Pending)');
  console.log('─────────────────────────────────────────────');
  const staleDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stale = await prisma.order.findMany({
    where: {
      status: { in: ['Processing', 'Pending'] },
      createdAt: { lt: staleDate },
      deletedAt: null,
    },
    select: { orderId: true, status: true, createdAt: true, charge: true },
    take: 20,
  });

  if (stale.length > 0) {
    console.log(`  ⚠ ${stale.length} orders stuck:`);
    for (const o of stale.slice(0, 5)) {
      const age = Math.round((Date.now() - o.createdAt.getTime()) / 3600000);
      console.log(`    ${o.orderId} — ${o.status} for ${age}h (₦${(o.charge / 100).toFixed(2)})`);
    }
    if (stale.length > 5) console.log(`    ... and ${stale.length - 5} more`);
  } else {
    console.log('  ✓ No stale orders');
  }

  // 7. Platform stats
  console.log('\n7. PLATFORM STATS');
  console.log('─────────────────');
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } });
  const verifiedUsers = await prisma.user.count({ where: { deletedAt: null, emailVerified: true } });
  const totalOrders = await prisma.order.count({ where: { deletedAt: null } });
  const totalDeposits = await prisma.transaction.aggregate({ where: { type: 'deposit', status: 'Completed' }, _sum: { amount: true }, _count: { id: true } });
  const totalRevenue = await prisma.order.aggregate({ where: { deletedAt: null, status: { not: 'Cancelled' } }, _sum: { charge: true, cost: true } });

  console.log(`  Users: ${totalUsers} (${verifiedUsers} verified)`);
  console.log(`  Orders: ${totalOrders}`);
  console.log(`  Deposits: ${totalDeposits._count.id} (₦${((totalDeposits._sum.amount || 0) / 100).toLocaleString()})`);
  console.log(`  Revenue: ₦${((totalRevenue._sum.charge || 0) / 100).toLocaleString()}`);
  console.log(`  Cost: ₦${((totalRevenue._sum.cost || 0) / 100).toLocaleString()}`);
  console.log(`  Profit: ₦${(((totalRevenue._sum.charge || 0) - (totalRevenue._sum.cost || 0)) / 100).toLocaleString()}`);

  // Summary
  console.log('\n══════════════════════════════════════');
  if (issues === 0) {
    console.log('  ✓ ALL CHECKS PASSED — No issues found');
  } else {
    console.log(`  ✗ ${issues} ISSUE${issues > 1 ? 'S' : ''} FOUND — Review above`);
  }
  console.log('══════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
