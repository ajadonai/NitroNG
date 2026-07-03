/**
 * Integration tests for commission financial invariants.
 * These run against a real database to verify transaction isolation.
 * Skipped by default — run with INTEGRATION=1 npm test.
 *
 * Safety: refuses to run against the production database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SKIP = !process.env.INTEGRATION;

let prisma;
let memberId;
let leadId;
let linkId;
let testUserId;
let testServiceId;
let testOrderIds = [];

async function createTestOrder(prismaClient) {
  const order = await prismaClient.order.create({
    data: {
      orderId: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: testUserId,
      serviceId: testServiceId,
      link: 'https://test.local/profile',
      quantity: 1000,
      charge: 20000,
      cost: 10000,
      status: 'Completed',
    },
  });
  testOrderIds.push(order.id);
  return order;
}

async function cleanup() {
  if (!prisma) return;
  await prisma.affiliateCommission.deleteMany({ where: { linkId } }).catch(() => {});
  await prisma.affiliatePayout.deleteMany({ where: { memberId: { in: [memberId, leadId].filter(Boolean) } } }).catch(() => {});
  await prisma.order.deleteMany({ where: { id: { in: testOrderIds } } }).catch(() => {});
  await prisma.acquisitionLink.deleteMany({ where: { id: linkId } }).catch(() => {});
  await prisma.crewMember.deleteMany({ where: { id: { in: [memberId, leadId].filter(Boolean) } } }).catch(() => {});
  if (testServiceId) await prisma.service.deleteMany({ where: { id: testServiceId } }).catch(() => {});
  if (testUserId) await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
}

describe.skipIf(SKIP)('commission integration tests', () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL is required for integration tests. Set it to an isolated test database URL.');
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    const user = await prisma.user.create({
      data: { email: `testuser-${Date.now()}@test.local`, password: 'x', name: 'Test User' },
    });
    testUserId = user.id;

    const service = await prisma.service.create({
      data: { apiId: 99999, name: 'Test Service', category: 'test', provider: 'mtp', costPer1k: 100n, sellPer1k: 200n },
    });
    testServiceId = service.id;

    const leader = await prisma.crewMember.create({
      data: {
        name: 'Test Chief', email: `testchief-${Date.now()}@test.local`, password: 'x',
        role: 'chief', tier: 'pro', status: 'approved', commissionRate: 50,
      },
    });
    leadId = leader.id;

    const member = await prisma.crewMember.create({
      data: {
        name: 'Test Crew', email: `testcrew-${Date.now()}@test.local`, password: 'x',
        role: 'crew', tier: 'starter', status: 'approved', commissionRate: 30,
        leadId,
      },
    });
    memberId = member.id;

    const link = await prisma.acquisitionLink.create({
      data: { name: 'test-link', slug: `test-integ-${Date.now()}`, affiliateId: memberId },
    });
    linkId = link.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma?.$disconnect();
  });

  it('release credits only newly held commissions, not older approved ones', async () => {
    const { releaseHeldCommissions } = await import('@/lib/commissions');

    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 0 } });
    await prisma.crewMember.update({ where: { id: leadId }, data: { totalEarned: 0 } });

    const order1 = await createTestOrder(prisma);
    const order2 = await createTestOrder(prisma);

    const past = new Date(Date.now() - 86400000);

    await prisma.affiliateCommission.create({
      data: {
        orderId: order1.id, linkId, memberId, leadId,
        orderCharge: 10000, orderCost: 5000, commissionRate: 30,
        leadSplit: 40, marketerAmount: 900, leadAmount: 600,
        status: 'approved', releasesAt: past,
      },
    });

    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 900 } });
    await prisma.crewMember.update({ where: { id: leadId }, data: { totalEarned: 600 } });

    await prisma.affiliateCommission.create({
      data: {
        orderId: order2.id, linkId, memberId, leadId,
        orderCharge: 20000, orderCost: 10000, commissionRate: 30,
        leadSplit: 40, marketerAmount: 1800, leadAmount: 1200,
        status: 'held', releasesAt: past,
      },
    });

    const released = await releaseHeldCommissions();
    expect(released).toBeGreaterThanOrEqual(1);

    const memberAfter = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { totalEarned: true } });
    const leadAfter = await prisma.crewMember.findUnique({ where: { id: leadId }, select: { totalEarned: true } });

    expect(memberAfter.totalEarned).toBe(900 + 1800);
    expect(leadAfter.totalEarned).toBe(600 + 1200);

    await prisma.affiliateCommission.deleteMany({ where: { linkId } });
  });

  it('concurrent release attempts do not double-credit', async () => {
    const { releaseHeldCommissions } = await import('@/lib/commissions');

    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 0 } });

    const order = await createTestOrder(prisma);
    const past = new Date(Date.now() - 86400000);

    await prisma.affiliateCommission.create({
      data: {
        orderId: order.id, linkId, memberId, leadId: null,
        orderCharge: 10000, orderCost: 5000, commissionRate: 30,
        leadSplit: 0, marketerAmount: 1500, leadAmount: 0,
        status: 'held', releasesAt: past,
      },
    });

    const [countA, countB] = await Promise.all([
      releaseHeldCommissions(),
      releaseHeldCommissions(),
    ]);

    expect(countA + countB).toBe(1);

    const member = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { totalEarned: true } });
    expect(member.totalEarned).toBe(1500);

    await prisma.affiliateCommission.deleteMany({ where: { linkId } });
  });

  it('concurrent void attempts do not double-decrement', async () => {
    const { voidCommissions } = await import('@/lib/commissions');

    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 5000 } });

    const order = await createTestOrder(prisma);

    await prisma.affiliateCommission.create({
      data: {
        orderId: order.id, linkId, memberId, leadId: null,
        orderCharge: 10000, orderCost: 5000, commissionRate: 30,
        leadSplit: 0, marketerAmount: 1500, leadAmount: 0,
        status: 'approved', releasesAt: new Date(),
      },
    });

    const [countA, countB] = await Promise.all([
      voidCommissions(order.id, 'test_a'),
      voidCommissions(order.id, 'test_b'),
    ]);

    expect(countA + countB).toBe(1);

    const member = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { totalEarned: true } });
    expect(member.totalEarned).toBe(3500);

    await prisma.affiliateCommission.deleteMany({ where: { linkId } });
  });
});
