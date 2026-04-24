// Run with: node scripts/cleanup-seed-data.js
// This removes all test/seed orders and transactions so analytics shows real data only.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Nitro Seed Data Cleanup ===\n');

  // Check current state
  const orderCount = await prisma.order.count();
  const txCount = await prisma.transaction.count();
  const userCount = await prisma.user.count();
  const ordersWithCharge = await prisma.order.aggregate({ _sum: { charge: true, cost: true } });

  console.log(`Users: ${userCount}`);
  console.log(`Orders: ${orderCount} (total charge: ₦${((ordersWithCharge._sum.charge || 0) / 100).toLocaleString()}, cost: ₦${((ordersWithCharge._sum.cost || 0) / 100).toLocaleString()})`);
  console.log(`Transactions: ${txCount}\n`);

  // Get the real admin/owner emails to protect
  const protectedEmails = [
    'admin@nitro.ng',
    'thenitroNG@gmail.com',
    'adonaijonathancrypto@gmail.com',
  ];

  // Find test users (not in protected list)
  const testUsers = await prisma.user.findMany({
    where: { email: { notIn: protectedEmails } },
    select: { id: true, email: true, name: true },
  });

  console.log(`Test users found: ${testUsers.length}`);
  testUsers.forEach(u => console.log(`  - ${u.email} (${u.name})`));

  // Delete all orders (these are test/seed orders)
  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`\nDeleted ${deletedOrders.count} orders`);

  // Delete all transactions (test deposits/charges)
  const deletedTxs = await prisma.transaction.deleteMany({});
  console.log(`Deleted ${deletedTxs.count} transactions`);

  // Delete test users (keep protected emails)
  if (testUsers.length > 0) {
    // Delete related data first
    const testIds = testUsers.map(u => u.id);

    // Delete referral records
    await prisma.referral.deleteMany({ where: { OR: [{ referrerId: { in: testIds } }, { referredId: { in: testIds } }] } }).catch(() => {});

    // Delete notifications
    await prisma.notification.deleteMany({ where: { userId: { in: testIds } } }).catch(() => {});

    // Delete sessions/tokens
    await prisma.session.deleteMany({ where: { userId: { in: testIds } } }).catch(() => {});

    // Delete the test users
    const deletedUsers = await prisma.user.deleteMany({ where: { id: { in: testIds } } });
    console.log(`Deleted ${deletedUsers.count} test users`);
  }

  // Reset balances on remaining users to 0 (remove seed deposits)
  await prisma.user.updateMany({ data: { balance: 0 } });
  console.log('Reset all user balances to ₦0');

  // Verify
  const finalOrders = await prisma.order.count();
  const finalTxs = await prisma.transaction.count();
  const finalUsers = await prisma.user.count();
  console.log(`\n=== After cleanup ===`);
  console.log(`Users: ${finalUsers}`);
  console.log(`Orders: ${finalOrders}`);
  console.log(`Transactions: ${finalTxs}`);
  console.log('\nDone! Analytics should now show ₦0 across the board.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
