import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { crewSignup, crewFirstPurchase, crewRepeatBuyer } from '@/lib/crew-bot';

const HOLD_DAYS = 7;
const DEFAULT_LEAD_SPLIT = 40;

const MIN_ORDER_KOBO = 100000;

export async function createCommission(orderId, userId, chargeKobo, costKobo) {
  try {
    if (chargeKobo < MIN_ORDER_KOBO) return null;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { signupSource: true, email: true } });
    if (!user?.signupSource) return null;

    const link = await prisma.acquisitionLink.findUnique({
      where: { slug: user.signupSource },
      select: { id: true, affiliateId: true, enabled: true },
    });
    if (!link?.affiliateId) return null;

    const member = await prisma.crewMember.findUnique({
      where: { id: link.affiliateId },
      select: { id: true, status: true, commissionRate: true, leadId: true, role: true, email: true },
    });
    if (!member || member.status !== 'approved') return null;

    if (user.email && member.email && user.email.toLowerCase() === member.email.toLowerCase()) return null;

    const existing = await prisma.affiliateCommission.findFirst({ where: { orderId } });
    if (existing) return null;

    const splitRow = await prisma.setting.findUnique({ where: { key: 'affiliate_lead_split' } });
    const leadSplit = parseInt(splitRow?.value) || DEFAULT_LEAD_SPLIT;

    const profit = chargeKobo - (costKobo || 0);
    if (profit <= 0) return null;

    const crewTotal = Math.round(profit * (member.commissionRate / 100));
    if (crewTotal <= 0) return null;

    let leadAmount = 0;
    let marketerAmount = crewTotal;
    let leadId = null;

    if (member.role === 'crew' && member.leadId) {
      leadId = member.leadId;
      leadAmount = Math.round(crewTotal * (leadSplit / 100));
      marketerAmount = crewTotal - leadAmount;
    }

    const releasesAt = new Date();
    releasesAt.setDate(releasesAt.getDate() + HOLD_DAYS);

    const commission = await prisma.affiliateCommission.create({
      data: {
        orderId,
        linkId: link.id,
        memberId: member.id,
        leadId,
        orderCharge: chargeKobo,
        orderCost: costKobo || 0,
        commissionRate: member.commissionRate,
        leadSplit: leadId ? leadSplit : 0,
        leadAmount,
        marketerAmount,
        status: 'held',
        releasesAt,
      },
    });

    try {
      const memberName = (await prisma.crewMember.findUnique({ where: { id: member.id }, select: { name: true } }))?.name || 'Unknown';
      const orderCount = await prisma.affiliateCommission.count({ where: { memberId: member.id } });
      if (orderCount === 1) {
        crewFirstPurchase(memberName);
      } else if ([5, 10, 20, 50].includes(orderCount)) {
        crewRepeatBuyer(memberName, orderCount);
      }
    } catch {}

    return commission;
  } catch (err) {
    log.error('Commission', err.message);
    return null;
  }
}

export async function notifyCrewSignup(signupSource) {
  try {
    if (!signupSource) return;
    const link = await prisma.acquisitionLink.findUnique({
      where: { slug: signupSource },
      select: { affiliateId: true },
    });
    if (!link?.affiliateId) return;
    const member = await prisma.crewMember.findUnique({
      where: { id: link.affiliateId },
      select: { name: true, status: true },
    });
    if (member?.status === 'approved') crewSignup(member.name);
  } catch {}
}

export async function voidCommissions(orderId, reason = 'order_cancelled') {
  try {
    const result = await prisma.affiliateCommission.updateMany({
      where: { orderId, status: { in: ['held', 'approved'] } },
      data: { status: 'voided', voidedAt: new Date(), voidReason: reason },
    });
    if (result.count > 0) {
      const commissions = await prisma.affiliateCommission.findMany({
        where: { orderId, status: 'voided', voidReason: reason },
        select: { memberId: true, leadId: true, marketerAmount: true, leadAmount: true },
      });
      for (const c of commissions) {
        await prisma.crewMember.update({
          where: { id: c.memberId },
          data: { totalEarned: { decrement: c.marketerAmount } },
        });
        if (c.leadId) {
          await prisma.crewMember.update({
            where: { id: c.leadId },
            data: { totalEarned: { decrement: c.leadAmount } },
          });
        }
      }
    }
    return result.count;
  } catch (err) {
    log.error('Commission void', err.message);
    return 0;
  }
}

export async function releaseHeldCommissions() {
  try {
    const held = await prisma.affiliateCommission.findMany({
      where: { status: 'held', releasesAt: { lte: new Date() } },
      select: { id: true, memberId: true, leadId: true, marketerAmount: true, leadAmount: true },
    });
    if (held.length === 0) return 0;

    await prisma.affiliateCommission.updateMany({
      where: { id: { in: held.map(c => c.id) } },
      data: { status: 'approved' },
    });

    const memberTotals = {};
    for (const c of held) {
      memberTotals[c.memberId] = (memberTotals[c.memberId] || 0) + c.marketerAmount;
      if (c.leadId) {
        memberTotals[c.leadId] = (memberTotals[c.leadId] || 0) + c.leadAmount;
      }
    }
    for (const [id, amount] of Object.entries(memberTotals)) {
      await prisma.crewMember.update({
        where: { id },
        data: { totalEarned: { increment: amount } },
      });
    }

    return held.length;
  } catch (err) {
    log.error('Commission release', err.message);
    return 0;
  }
}
