/**
 * Integration tests for commission financial invariants.
 * These run against the real database to verify transaction isolation.
 * Skipped by default — run with INTEGRATION=1 npm test.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const SKIP = !process.env.INTEGRATION;

let prisma;
let memberId;
let leadId;
let linkId;

async function cleanup() {
  if (!prisma) return;
  await prisma.affiliateCommission.deleteMany({ where: { linkId } });
  await prisma.acquisitionLink.deleteMany({ where: { id: linkId } });
  await prisma.affiliatePayout.deleteMany({ where: { memberId: { in: [memberId, leadId] } } });
  await prisma.crewMember.deleteMany({ where: { id: { in: [memberId, leadId] } } });
}

describe.skipIf(SKIP)('commission integration tests', () => {
  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();

    // Create test fixtures
    const leader = await prisma.crewMember.create({
      data: {
        name: 'Test Chief', email: 'testchief@test.local', password: 'x',
        role: 'chief', tier: 'pro', status: 'approved', commissionRate: 50,
      },
    });
    leadId = leader.id;

    const member = await prisma.crewMember.create({
      data: {
        name: 'Test Crew', email: 'testcrew@test.local', password: 'x',
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

    // Reset totals
    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 0 } });
    await prisma.crewMember.update({ where: { id: leadId }, data: { totalEarned: 0 } });

    // Create an already-approved commission (simulates historical data)
    const oldOrder = await prisma.order.findFirst({ select: { id: true } });
    if (!oldOrder) {
      console.log('Skipping: no orders in DB for test fixture');
      return;
    }

    // Create a held commission that's ready for release
    const past = new Date(Date.now() - 86400000);
    await prisma.affiliateCommission.create({
      data: {
        orderId: oldOrder.id, linkId, memberId, leadId,
        orderCharge: 10000, orderCost: 5000, commissionRate: 30,
        leadSplit: 40, marketerAmount: 900, leadAmount: 600,
        status: 'approved', releasesAt: past,
      },
    });

    // Manually set totalEarned to reflect the already-approved commission
    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 900 } });
    await prisma.crewMember.update({ where: { id: leadId }, data: { totalEarned: 600 } });

    // Create a new held commission ready for release
    const newOrder = await prisma.order.findFirst({ where: { id: { not: oldOrder.id } }, select: { id: true } });
    if (!newOrder) {
      console.log('Skipping: need 2 orders for test');
      return;
    }

    await prisma.affiliateCommission.create({
      data: {
        orderId: newOrder.id, linkId, memberId, leadId,
        orderCharge: 20000, orderCost: 10000, commissionRate: 30,
        leadSplit: 40, marketerAmount: 1800, leadAmount: 1200,
        status: 'held', releasesAt: past,
      },
    });

    // Release — should only credit the new one (1800 + 1200), NOT re-credit the old (900 + 600)
    const released = await releaseHeldCommissions();
    expect(released).toBe(1);

    const memberAfter = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { totalEarned: true } });
    const leadAfter = await prisma.crewMember.findUnique({ where: { id: leadId }, select: { totalEarned: true } });

    expect(memberAfter.totalEarned).toBe(900 + 1800); // old + new, not old*2 + new
    expect(leadAfter.totalEarned).toBe(600 + 1200);

    // Cleanup test commissions
    await prisma.affiliateCommission.deleteMany({ where: { linkId } });
  });

  it('concurrent release attempts do not double-credit', async () => {
    const { releaseHeldCommissions } = await import('@/lib/commissions');

    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 0 } });

    const order = await prisma.order.findFirst({ select: { id: true } });
    if (!order) return;

    const past = new Date(Date.now() - 86400000);
    await prisma.affiliateCommission.create({
      data: {
        orderId: order.id, linkId, memberId, leadId: null,
        orderCharge: 10000, orderCost: 5000, commissionRate: 30,
        leadSplit: 0, marketerAmount: 1500, leadAmount: 0,
        status: 'held', releasesAt: past,
      },
    });

    // Fire two releases concurrently
    const [countA, countB] = await Promise.all([
      releaseHeldCommissions(),
      releaseHeldCommissions(),
    ]);

    // Exactly one should have claimed the row
    expect(countA + countB).toBe(1);

    const member = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { totalEarned: true } });
    expect(member.totalEarned).toBe(1500); // credited exactly once

    await prisma.affiliateCommission.deleteMany({ where: { linkId } });
  });

  it('concurrent void attempts do not double-decrement', async () => {
    const { voidCommissions } = await import('@/lib/commissions');

    await prisma.crewMember.update({ where: { id: memberId }, data: { totalEarned: 5000 } });

    const order = await prisma.order.findFirst({ select: { id: true } });
    if (!order) return;

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

    expect(countA + countB).toBe(1); // exactly one claimed the row

    const member = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { totalEarned: true } });
    expect(member.totalEarned).toBe(3500); // 5000 - 1500, decremented exactly once

    await prisma.affiliateCommission.deleteMany({ where: { linkId } });
  });
});
