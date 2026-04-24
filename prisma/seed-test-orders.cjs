const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const tiers = await p.serviceTier.findMany({ take: 5, include: { service: true, group: true }, where: { enabled: true } });
  if (tiers.length === 0) { console.log('No tiers found'); return; }

  const uid = 'cmn6fcomg0000ukobsed6vrdp';
  const sts = ['Processing', 'Completed', 'Pending', 'Completed', 'Processing'];

  for (let i = 0; i < 5; i++) {
    const t = tiers[i];
    const qty = t.service.min || 100;
    const ch = Math.round((t.sellPer1k / 1000) * qty);
    const co = Math.round((t.service.costPer1k / 1000) * qty);
    const oid = 'ORD-T' + Date.now().toString(36).toUpperCase() + i;

    await p.order.create({ data: {
      orderId: oid, userId: uid, serviceId: t.service.id, tierId: t.id,
      link: 'https://instagram.com/testuser' + i,
      quantity: qty, charge: ch, cost: co, status: sts[i],
    }});

    await p.transaction.create({ data: {
      userId: uid, type: 'order', amount: -ch,
      method: 'wallet', status: 'Completed', reference: oid,
      note: t.group.name + ' (' + t.tier + ') x' + qty,
    }});

    console.log(oid, t.group.name, t.tier, qty + 'qty', 'charge=' + (ch / 100), sts[i]);
  }
  console.log('\nDone - 5 orders created for mradonaijonathan@gmail.com');
}

run().catch(e => console.error('ERROR:', e.message)).finally(() => p.$disconnect());
