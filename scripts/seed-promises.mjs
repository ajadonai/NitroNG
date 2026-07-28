// Seed realistic promise data for development/testing.
// Run: node scripts/seed-promises.mjs

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const hours = (h) => new Date(Date.now() + h * 3600000);
const ago = (h) => new Date(Date.now() - h * 3600000);

const promises = [
  {
    customerNumber: '2348012345678',
    customerName: 'Chioma',
    orderNumber: 'NTR-0042',
    promiseText: "I'll check on your Instagram followers order and update you within the hour.",
    category: 'order_status',
    owner: null,
    dueAt: hours(0.5),
    state: 'due_soon',
  },
  {
    customerNumber: '2348098765432',
    customerName: 'Tunde',
    orderNumber: 'NTR-0089',
    promiseText: 'Let me chase the provider on your TikTok views. I will get back to you before end of day.',
    category: 'provider_chase',
    owner: 'Ify',
    dueAt: hours(3),
    state: 'open',
  },
  {
    customerNumber: '2349011223344',
    customerName: 'Amara',
    orderNumber: 'NTR-0103',
    promiseText: 'Your YouTube subscribers dropped — I will request a free refill and confirm once it starts.',
    category: 'refill',
    owner: null,
    dueAt: ago(2),
    state: 'overdue',
  },
  {
    customerNumber: '2348055667788',
    customerName: 'Emeka',
    promiseText: 'I can see your pending bank transfer. A team member will confirm it shortly.',
    category: 'payment',
    owner: 'Support',
    dueAt: ago(0.5),
    state: 'overdue',
  },
  {
    customerNumber: '2347033445566',
    customerName: 'Kemi',
    orderNumber: 'NTR-0071',
    promiseText: "I'm connecting you with a team member who can help with your refund request.",
    category: 'escalation',
    owner: null,
    dueAt: ago(3),
    state: 'escalated',
  },
  {
    customerNumber: '2348099887766',
    customerName: 'Bola',
    orderNumber: 'NTR-0055',
    promiseText: 'Your Spotify playlist followers are being delivered. I will check back once complete.',
    category: 'order_status',
    owner: 'Ify',
    dueAt: ago(6),
    state: 'resolved',
    resolvedAt: ago(5),
    resolutionNote: 'Order completed, customer confirmed delivery.',
  },
];

async function seed() {
  for (const p of promises) {
    const promise = await prisma.ifyPromise.create({ data: p });
    console.log(`Created: [${p.state}] ${p.customerName} — ${p.category}`);

    if (p.state === 'resolved') {
      await prisma.ifyPromiseUpdate.create({
        data: {
          promiseId: promise.id,
          author: 'Ify',
          messageSent: 'Hi Bola! Your Spotify playlist followers order is complete — 500 delivered. Let me know if you need anything else.',
          note: 'Auto-resolved on delivery confirmation.',
        },
      });
    }
  }

  console.log(`\nSeeded ${promises.length} promises.`);
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
