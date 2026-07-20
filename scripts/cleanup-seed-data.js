// Local/test cleanup only. Running without NITRO_SCRIPT_MODE=apply is read-only.
import {
  isMainModule,
  runGuardedPrismaScript,
} from './lib/guarded-operation.mjs';

export const SCRIPT_OPERATION = 'cleanup-seed-data';

export async function main({ prisma, dryRun, logger = console }) {
  logger.log('=== Nitro Seed Data Cleanup ===\n');

  // Check current state
  const orderCount = await prisma.order.count();
  const txCount = await prisma.transaction.count();
  const userCount = await prisma.user.count();
  const ordersWithCharge = await prisma.order.aggregate({ _sum: { charge: true, cost: true } });

  logger.log(`Users: ${userCount}`);
  logger.log(`Orders: ${orderCount} (total charge: ₦${((ordersWithCharge._sum.charge || 0) / 100).toLocaleString()}, cost: ₦${((ordersWithCharge._sum.cost || 0) / 100).toLocaleString()})`);
  logger.log(`Transactions: ${txCount}\n`);

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

  logger.log(`Test users found: ${testUsers.length}`);
  testUsers.forEach(u => logger.log(`  - ${u.email} (${u.name})`));

  if (dryRun) {
    logger.log('\n[DRY-RUN] Would delete every order and transaction, delete the users listed above, and reset remaining balances to zero.');
    return { orderCount, txCount, testUserCount: testUsers.length, dryRun: true };
  }

  // Delete all orders (these are test/seed orders)
  const deletedOrders = await prisma.order.deleteMany({});
  logger.log(`\nDeleted ${deletedOrders.count} orders`);

  // Delete all transactions (test deposits/charges)
  const deletedTxs = await prisma.transaction.deleteMany({});
  logger.log(`Deleted ${deletedTxs.count} transactions`);

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
    logger.log(`Deleted ${deletedUsers.count} test users`);
  }

  // Reset balances on remaining users to 0 (remove seed deposits)
  await prisma.user.updateMany({ data: { balance: 0 } });
  logger.log('Reset all user balances to ₦0');

  // Verify
  const finalOrders = await prisma.order.count();
  const finalTxs = await prisma.transaction.count();
  const finalUsers = await prisma.user.count();
  logger.log(`\n=== After cleanup ===`);
  logger.log(`Users: ${finalUsers}`);
  logger.log(`Orders: ${finalOrders}`);
  logger.log(`Transactions: ${finalTxs}`);
  logger.log('\nDone! Analytics should now show ₦0 across the board.');
  return { finalOrders, finalTxs, finalUsers, dryRun: false };
}

if (isMainModule(import.meta.url)) {
  runGuardedPrismaScript({ operation: SCRIPT_OPERATION, main })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
