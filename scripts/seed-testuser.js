import bcrypt from 'bcryptjs';
import {
  isMainModule,
  runGuardedPrismaScript,
} from './lib/guarded-operation.mjs';

export const SCRIPT_OPERATION = 'seed-test-user';

export async function main({ prisma, dryRun, logger = console }) {
  const email = 'testuser@gmail.com';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (dryRun) {
    const serviceCount = await prisma.service.count();
    logger.log(`[DRY-RUN] Would ${existing ? 'replace' : 'create'} ${email}, then create sample orders and transactions using ${Math.min(serviceCount, 8)} services.`);
    return { dryRun: true, existing: Boolean(existing), serviceCount };
  }

  const password = await bcrypt.hash('12345678', 12);

  // Delete existing user if present
  if (existing) {
    await prisma.ticketReply.deleteMany({ where: { ticket: { userId: existing.id } } });
    await prisma.ticket.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.transaction.deleteMany({ where: { userId: existing.id } });
    await prisma.order.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
    logger.log('Deleted existing testuser');
  }

  // Create user — balance in kobo (₦25,000 = 2500000)
  const user = await prisma.user.create({
    data: {
      email,
      password,
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      phone: '+2348012345678',
      balance: 2500000,
      referralCode: 'NTR-TEST',
      emailVerified: true,
      notifOrders: true,
      notifPromo: true,
      notifEmail: true,
      status: 'Active',
    },
  });
  logger.log(`Created user: ${user.id} (${user.email})`);

  // Get services for orders
  const services = await prisma.service.findMany({ take: 8 });
  if (services.length === 0) {
    logger.log('No services found — skipping orders/transactions');
    return { dryRun: false, userId: user.id, orders: 0, transactions: 0 };
  }

  // Helper — date N days ago
  const ago = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));
    return d;
  };

  const s = (i) => services[i % services.length];

  // ── Orders ──
  const orders = [
    { svc: s(0), qty: 1000, charge: 350000, cost: 150000, status: 'Completed', d: 0 },
    { svc: s(1), qty: 5000, charge: 850000, cost: 400000, status: 'Completed', d: 1 },
    { svc: s(2), qty: 2000, charge: 420000, cost: 200000, status: 'Completed', d: 2 },
    { svc: s(3), qty: 500,  charge: 175000, cost: 80000,  status: 'Completed', d: 3 },
    { svc: s(4), qty: 10000,charge: 1500000,cost: 700000, status: 'Completed', d: 4 },
    { svc: s(5), qty: 3000, charge: 650000, cost: 300000, status: 'Completed', d: 5 },
    { svc: s(6), qty: 1500, charge: 280000, cost: 130000, status: 'Completed', d: 7 },
    { svc: s(0), qty: 2500, charge: 520000, cost: 250000, status: 'Completed', d: 10 },
    { svc: s(1), qty: 800,  charge: 190000, cost: 90000,  status: 'Completed', d: 12 },
    { svc: s(2), qty: 4000, charge: 720000, cost: 340000, status: 'Completed', d: 14 },
    { svc: s(3), qty: 1000, charge: 350000, cost: 150000, status: 'Processing', d: 0 },
    { svc: s(4), qty: 2000, charge: 480000, cost: 220000, status: 'Processing', d: 0 },
    { svc: s(5), qty: 500,  charge: 120000, cost: 55000,  status: 'Pending', d: 0 },
    { svc: s(0), qty: 1000, charge: 350000, cost: 150000, status: 'Canceled', d: 6 },
    { svc: s(1), qty: 3000, charge: 580000, cost: 270000, status: 'Partial', d: 8 },
  ];

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    await prisma.order.create({
      data: {
        orderId: `NTR-${100000 + i}`,
        userId: user.id,
        serviceId: o.svc.id,
        link: 'https://instagram.com/nitro.ng',
        quantity: o.qty,
        charge: o.charge,
        cost: o.cost,
        status: o.status,
        createdAt: ago(o.d),
      },
    });
  }
  logger.log(`Created ${orders.length} orders`);

  // ── Transactions ──
  const txs = [
    { type: 'deposit',  amount: 5000000,  method: 'Flutterwave',  note: 'Card deposit',              d: 0 },
    { type: 'deposit',  amount: 3000000,  method: 'Flutterwave',  note: 'Card deposit',              d: 3 },
    { type: 'deposit',  amount: 10000000, method: 'Flutterwave',  note: 'Bank transfer',             d: 7 },
    { type: 'deposit',  amount: 2000000,  method: 'Flutterwave',  note: 'Card deposit',              d: 12 },
    { type: 'order',    amount: -350000,  method: null,            note: 'Order NTR-100000',          d: 0 },
    { type: 'order',    amount: -850000,  method: null,            note: 'Order NTR-100001',          d: 1 },
    { type: 'order',    amount: -420000,  method: null,            note: 'Order NTR-100002',          d: 2 },
    { type: 'order',    amount: -175000,  method: null,            note: 'Order NTR-100003',          d: 3 },
    { type: 'order',    amount: -1500000, method: null,            note: 'Order NTR-100004',          d: 4 },
    { type: 'order',    amount: -650000,  method: null,            note: 'Order NTR-100005',          d: 5 },
    { type: 'referral', amount: 50000,    method: null,            note: 'Referral bonus — @david',   d: 2 },
    { type: 'referral', amount: 50000,    method: null,            note: 'Referral bonus — @chioma',  d: 5 },
    { type: 'referral', amount: 50000,    method: null,            note: 'Referral bonus — @emeka',   d: 9 },
  ];

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: tx.type,
        amount: tx.amount,
        method: tx.method,
        reference: `ref_test_${Date.now()}_${i}`,
        status: 'Completed',
        note: tx.note,
        createdAt: ago(tx.d),
      },
    });
  }
  logger.log(`Created ${txs.length} transactions`);

  logger.log('\n✅ Test user seeded');
  logger.log('   Email: testuser@gmail.com');
  logger.log('   Password: 12345678');
  logger.log('   Balance: ₦25,000');
  logger.log(`   Orders: ${orders.length}`);
  logger.log(`   Transactions: ${txs.length}`);
  return {
    dryRun: false,
    userId: user.id,
    orders: orders.length,
    transactions: txs.length,
  };
}

if (isMainModule(import.meta.url)) {
  runGuardedPrismaScript({ operation: SCRIPT_OPERATION, main })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
