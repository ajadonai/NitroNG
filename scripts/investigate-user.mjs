import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const email = process.argv[2] || 'asekhamejoel@gmail.com';

const user = await prisma.user.findFirst({
  where: { email },
  select: {
    id: true, name: true, email: true, referredBy: true,
    createdAt: true, balance: true, firstDepositBonusPaid: true,
    signupIp: true, lastIp: true,
  }
});

if (!user) { console.log('User not found'); await prisma.$disconnect(); process.exit(0); }
console.log('USER:', JSON.stringify(user, null, 2));

const txns = await prisma.transaction.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'asc' },
  select: { id: true, type: true, amount: true, status: true, method: true, reference: true, note: true, createdAt: true }
});

console.log('\nALL TRANSACTIONS (' + txns.length + '):');
txns.forEach((t, i) => {
  const amt = (t.amount / 100).toLocaleString();
  console.log(`${i+1}. [${t.createdAt.toISOString()}] ${t.type} | N${amt} | ${t.status} | ${t.method || '-'} | ref: ${t.reference || '-'} | note: ${t.note || '-'}`);
});

// Check IP-based bonus claims
if (user.signupIp && user.signupIp !== 'unknown') {
  const sameIpUsers = await prisma.user.findMany({
    where: { signupIp: user.signupIp, firstDepositBonusPaid: true, id: { not: user.id } },
    select: { id: true, email: true, createdAt: true }
  });
  console.log(`\nSAME-IP USERS WITH BONUS CLAIMED (ip: ${user.signupIp}): ${sameIpUsers.length}`);
  sameIpUsers.forEach((u, i) => {
    console.log(`  ${i+1}. ${u.email} (created ${u.createdAt.toISOString()})`);
  });
}

// Check alerts
const alerts = await prisma.alert.findMany({
  where: { type: 'welcome_bonus_ip_flag', message: { contains: user.id } },
  select: { message: true, createdAt: true }
});
if (alerts.length) {
  console.log(`\nIP-CAP ALERTS FOR THIS USER: ${alerts.length}`);
  alerts.forEach(a => console.log(`  [${a.createdAt.toISOString()}] ${a.message}`));
}

// Check referrer
if (user.referredBy) {
  const referrer = await prisma.user.findFirst({
    where: { referralCode: user.referredBy },
    select: { id: true, email: true, name: true }
  });
  console.log(`\nREFERRED BY: code=${user.referredBy}, referrer=${referrer?.email || 'not found'}`);
}

await prisma.$disconnect();
