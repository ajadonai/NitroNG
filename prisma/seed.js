import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Clear existing data ──
  await prisma.ticketReply.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.order.deleteMany();
  await prisma.service.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
  await prisma.admin.deleteMany();

  const pw = await bcrypt.hash('password123', 12);
  const adminPw = await bcrypt.hash('admin123', 12);

  // ── Admins ──
  const superadmin = await prisma.admin.create({
    data: { name: 'Owner', email: 'admin@thenitro.ng', password: adminPw, role: 'superadmin' },
  });
  await prisma.admin.createMany({
    data: [
      { name: 'David Ojo', email: 'david@thenitro.ng', password: adminPw, role: 'admin' },
      { name: 'Grace Adebayo', email: 'grace@thenitro.ng', password: adminPw, role: 'support' },
      { name: 'Ibrahim Musa', email: 'ibrahim@thenitro.ng', password: adminPw, role: 'finance', status: 'Inactive' },
    ],
  });

  // ── Users ──
  const users = await Promise.all([
    prisma.user.create({ data: { name: 'Chidi Okafor', email: 'chidi@gmail.com', password: pw, balance: 4500000, referralCode: 'NTR-C4K1', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Amina Bello', email: 'amina@yahoo.com', password: pw, balance: 12050000, referralCode: 'NTR-A8B2', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Tunde Adeyemi', email: 'tunde@outlook.com', password: pw, balance: 825000, referralCode: 'NTR-T3A9', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Ngozi Eze', email: 'ngozi@gmail.com', password: pw, balance: 31000000, referralCode: 'NTR-N7E5', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Segun Akinola', email: 'segun@mail.com', password: pw, balance: 0, referralCode: 'NTR-S2A0', emailVerified: true, status: 'Suspended' } }),
    prisma.user.create({ data: { name: 'Fatima Yusuf', email: 'fatima@gmail.com', password: pw, balance: 5400000, referralCode: 'NTR-F1Y6', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Emeka Nwankwo', email: 'emeka@live.com', password: pw, balance: 2200000, referralCode: 'NTR-E9N3', emailVerified: true } }),
    prisma.user.create({ data: { name: 'Blessing Okoro', email: 'blessing@gmail.com', password: pw, balance: 8700000, referralCode: 'NTR-B4O8', emailVerified: true } }),
  ]);

  // ── Services ──
  const services = await Promise.all([
    prisma.service.create({ data: { apiId: 1001, name: 'IG Followers [Real]', category: 'Instagram', costPer1k: 251800, sellPer1k: 387500, refill: true, avgTime: '0-2 hrs' } }),
    prisma.service.create({ data: { apiId: 1002, name: 'IG Likes [Instant]', category: 'Instagram', costPer1k: 120900, sellPer1k: 186000, refill: false, avgTime: '0-30 min' } }),
    prisma.service.create({ data: { apiId: 2001, name: 'TikTok Followers', category: 'TikTok', costPer1k: 302300, sellPer1k: 465000, refill: true, avgTime: '0-4 hrs' } }),
    prisma.service.create({ data: { apiId: 2002, name: 'TikTok Views', category: 'TikTok', costPer1k: 30200, sellPer1k: 46500, refill: false, avgTime: '0-15 min' } }),
    prisma.service.create({ data: { apiId: 3001, name: 'YT Subscribers', category: 'YouTube', costPer1k: 806000, sellPer1k: 1240000, refill: true, avgTime: '0-12 hrs' } }),
    prisma.service.create({ data: { apiId: 3002, name: 'YT Views', category: 'YouTube', costPer1k: 201500, sellPer1k: 310000, refill: false, avgTime: '0-6 hrs' } }),
    prisma.service.create({ data: { apiId: 4001, name: 'Twitter/X Followers', category: 'Twitter/X', costPer1k: 403000, sellPer1k: 620000, refill: true, avgTime: '0-4 hrs' } }),
    prisma.service.create({ data: { apiId: 5001, name: 'FB Page Likes', category: 'Facebook', costPer1k: 503800, sellPer1k: 775000, refill: true, avgTime: '0-6 hrs' } }),
    prisma.service.create({ data: { apiId: 6001, name: 'Telegram Members', category: 'Telegram', costPer1k: 352600, sellPer1k: 542500, enabled: false, refill: true, avgTime: '0-6 hrs' } }),
    prisma.service.create({ data: { apiId: 7001, name: 'Spotify Plays', category: 'Spotify', costPer1k: 181400, sellPer1k: 279000, refill: false, avgTime: '0-12 hrs' } }),
  ]);

  // ── Orders ──
  await prisma.order.createMany({
    data: [
      { orderId: 'ORD-28491', userId: users[0].id, serviceId: services[0].id, link: 'instagram.com/coolbrand', quantity: 5000, charge: 1937500, cost: 1259400, status: 'Completed', apiOrderId: 'MTP-991204' },
      { orderId: 'ORD-28490', userId: users[1].id, serviceId: services[3].id, link: 'tiktok.com/@user/video/123', quantity: 50000, charge: 2325000, cost: 1511300, status: 'Processing', apiOrderId: 'MTP-991203' },
      { orderId: 'ORD-28489', userId: users[2].id, serviceId: services[4].id, link: 'youtube.com/@mychannel', quantity: 1000, charge: 1240000, cost: 806000, status: 'Pending', apiOrderId: 'MTP-991202' },
      { orderId: 'ORD-28488', userId: users[3].id, serviceId: services[6].id, link: 'x.com/mybrand', quantity: 2000, charge: 1240000, cost: 806000, status: 'Completed', apiOrderId: 'MTP-991201' },
      { orderId: 'ORD-28487', userId: users[4].id, serviceId: services[1].id, link: 'instagram.com/p/ABC123', quantity: 10000, charge: 1860000, cost: 1209000, status: 'Partial', apiOrderId: 'MTP-991200', remains: 3500 },
      { orderId: 'ORD-28486', userId: users[5].id, serviceId: services[9].id, link: 'open.spotify.com/track/xyz', quantity: 100000, charge: 27900000, cost: 18135000, status: 'Completed', apiOrderId: 'MTP-991199' },
      { orderId: 'ORD-28485', userId: users[6].id, serviceId: services[7].id, link: 'facebook.com/mybiz', quantity: 3000, charge: 2325000, cost: 1511300, status: 'Completed', apiOrderId: 'MTP-991198' },
      { orderId: 'ORD-28484', userId: users[7].id, serviceId: services[8].id, link: 't.me/mychannel', quantity: 5000, charge: 2712500, cost: 1763100, status: 'Processing', apiOrderId: 'MTP-991197' },
    ],
  });

  // ── Transactions ──
  await prisma.transaction.createMany({
    data: [
      { userId: users[0].id, type: 'deposit', amount: 7750000, method: 'Paystack', reference: 'PAY-20260322-001', status: 'Completed' },
      { userId: users[0].id, type: 'charge', amount: -1937500, method: null, reference: 'CHG-ORD-28491', note: 'Order ORD-28491' },
      { userId: users[1].id, type: 'deposit', amount: 15500000, method: 'Paystack', reference: 'PAY-20260321-001', status: 'Completed' },
      { userId: users[1].id, type: 'charge', amount: -2325000, method: null, reference: 'CHG-ORD-28490', note: 'Order ORD-28490' },
      { userId: users[2].id, type: 'deposit', amount: 2000000, method: 'Paystack', reference: 'PAY-20260320-001', status: 'Completed' },
      { userId: users[3].id, type: 'deposit', amount: 31000000, method: 'Bank Transfer', reference: 'BNK-20260315-001', status: 'Completed' },
    ],
  });

  // ── Tickets ──
  const tickets = await Promise.all([
    prisma.ticket.create({ data: { ticketId: 'TK-401', userId: users[0].id, subject: 'Order not delivered', message: 'My Instagram followers order stuck on processing for 3 hours.', orderId: 'ORD-28491', status: 'Open' } }),
    prisma.ticket.create({ data: { ticketId: 'TK-400', userId: users[1].id, subject: 'Followers dropped', message: 'Lost about 500 followers. Service says 30-day refill.', orderId: 'ORD-28480', status: 'Open' } }),
    prisma.ticket.create({ data: { ticketId: 'TK-399', userId: users[2].id, subject: 'Payment not credited', message: 'Paystack payment not reflected. Ref: PAY-2026032109.', status: 'In Progress' } }),
    prisma.ticket.create({ data: { ticketId: 'TK-398', userId: users[3].id, subject: 'Refund request', message: 'Wrong service. Please refund.', orderId: 'ORD-28470', status: 'Resolved' } }),
  ]);

  // Ticket replies
  await prisma.ticketReply.createMany({
    data: [
      { ticketId: tickets[2].id, from: 'David Ojo', message: 'Checking with Paystack.' },
      { ticketId: tickets[3].id, from: 'Owner', message: 'Refunded to wallet.' },
    ],
  });

  // ── Alerts ──
  await prisma.alert.createMany({
    data: [
      { message: 'Scheduled maintenance tonight 11PM - 1AM WAT. Orders may be delayed.', type: 'warning', target: 'both', active: true, createdBy: 'Owner', expiresAt: new Date('2026-03-24T01:00:00') },
      { message: 'New! TikTok services now available with 30-day refill guarantee.', type: 'info', target: 'dashboard', active: true, createdBy: 'David Ojo' },
      { message: 'Paystack maintenance completed. All payments are back to normal.', type: 'info', target: 'login', active: false, createdBy: 'Owner' },
    ],
  });

  // ── Activity Log ──
  await prisma.activityLog.createMany({
    data: [
      { adminName: 'Owner', action: 'Credited ₦5,000 to Chidi Okafor', type: 'credit' },
      { adminName: 'David Ojo', action: 'Cancelled order ORD-28483', type: 'cancel' },
      { adminName: 'Grace Adebayo', action: 'Replied to ticket TK-399', type: 'ticket' },
      { adminName: 'Owner', action: 'Suspended user Segun Akinola', type: 'ban' },
      { adminName: 'David Ojo', action: 'Synced 10 services from API', type: 'sync' },
      { adminName: 'Owner', action: 'Updated exchange rate', type: 'settings' },
    ],
  });

  // ── Settings ──
  await prisma.setting.createMany({
    data: [
      { key: 'site_name', value: 'Nitro' },
      { key: 'currency', value: 'NGN' },
      { key: 'default_markup', value: '54' },
      { key: 'referral_bonus', value: '50000' },
      { key: 'min_deposit', value: '100000' },
      { key: 'maintenance_mode', value: 'false' },
      { key: 'smm_api_url', value: 'https://morethanpanel.com/api/v2' },
      { key: 'smm_api_key', value: '' },
    ],
  });

  console.log('Seed complete!');
  console.log('');
  console.log('Test accounts:');
  console.log('  User:  chidi@gmail.com / password123');
  console.log('  Admin: admin@thenitro.ng / admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
