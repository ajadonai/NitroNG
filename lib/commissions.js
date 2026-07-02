import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { crewSignup, crewFirstPurchase, crewRepeatBuyer } from '@/lib/crew-bot';

const DEFAULT_HOLD_DAYS = 7;
const DEFAULT_LEAD_SPLIT = 40;
const DEFAULT_MIN_ORDER_KOBO = 100000;

async function getCrewSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['affiliate_hold_days', 'affiliate_lead_split', 'affiliate_min_order'] } },
  });
  const sv = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    holdDays: parseInt(sv.affiliate_hold_days) || DEFAULT_HOLD_DAYS,
    leadSplit: parseInt(sv.affiliate_lead_split) || DEFAULT_LEAD_SPLIT,
    minOrderKobo: (parseInt(sv.affiliate_min_order) || 1000) * 100,
  };
}

export async function createCommission(orderId, userId, chargeKobo, costKobo) {
  try {
    const settings = await getCrewSettings();
    if (chargeKobo < settings.minOrderKobo) return null;

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

    const leadSplit = settings.leadSplit;

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
    releasesAt.setDate(releasesAt.getDate() + settings.holdDays);

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

/**
 * Calculate a member's commission totals from the source of truth (commission rows).
 * Chiefs earn: marketerAmount on their own sales + leadAmount on team sales.
 * Crew earn: marketerAmount on their own sales.
 */
export async function getMemberEarnings(memberId, role, tx = prisma) {
  const [directSum, leadSum] = await Promise.all([
    tx.affiliateCommission.aggregate({
      where: { memberId, status: 'approved' },
      _sum: { marketerAmount: true },
    }),
    role === 'chief'
      ? tx.affiliateCommission.aggregate({
          where: { leadId: memberId, status: 'approved' },
          _sum: { leadAmount: true },
        })
      : Promise.resolve({ _sum: { leadAmount: 0 } }),
  ]);
  return {
    directEarned: directSum._sum.marketerAmount || 0,
    teamEarned: leadSum._sum.leadAmount || 0,
    totalApproved: (directSum._sum.marketerAmount || 0) + (leadSum._sum.leadAmount || 0),
  };
}

export async function getMemberHeld(memberId, role, tx = prisma) {
  const [directHeld, leadHeld] = await Promise.all([
    tx.affiliateCommission.aggregate({
      where: { memberId, status: 'held' },
      _sum: { marketerAmount: true },
    }),
    role === 'chief'
      ? tx.affiliateCommission.aggregate({
          where: { leadId: memberId, status: 'held' },
          _sum: { leadAmount: true },
        })
      : Promise.resolve({ _sum: { leadAmount: 0 } }),
  ]);
  return (directHeld._sum.marketerAmount || 0) + (leadHeld._sum.leadAmount || 0);
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
    const count = await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Lock + read pre-update status, then update. SELECT FOR UPDATE ensures
      // a concurrent void blocks until this transaction commits, then finds
      // zero matching rows (already voided) — making the operation idempotent.
      const rows = await tx.$queryRaw`
        SELECT id, "memberId", "leadId", "marketerAmount", "leadAmount", status
        FROM affiliate_commissions
        WHERE "orderId" = ${orderId} AND status IN ('held', 'approved')
        FOR UPDATE
      `;
      if (rows.length === 0) return 0;

      const ids = rows.map(r => r.id);
      await tx.$executeRaw`
        UPDATE affiliate_commissions
        SET status = 'voided', "voidedAt" = ${now}, "voidReason" = ${reason}
        WHERE id = ANY(${ids})
      `;

      // Only reverse totalEarned for rows that were 'approved' (held never credited)
      const memberTotals = {};
      for (const c of rows) {
        if (c.status !== 'approved') continue;
        memberTotals[c.memberId] = (memberTotals[c.memberId] || 0) + c.marketerAmount;
        if (c.leadId) {
          memberTotals[c.leadId] = (memberTotals[c.leadId] || 0) + c.leadAmount;
        }
      }
      for (const [id, amount] of Object.entries(memberTotals)) {
        await tx.$executeRaw`
          UPDATE crew_members SET "totalEarned" = "totalEarned" - ${amount} WHERE id = ${id}
        `;
      }

      return rows.length;
    });
    return count;
  } catch (err) {
    log.error('Commission void', err.message);
    return 0;
  }
}

export async function releaseHeldCommissions() {
  try {
    const count = await prisma.$transaction(async (tx) => {
      const now = new Date();
      // UPDATE ... RETURNING atomically claims only the rows this invocation
      // transitions. A concurrent release sees zero held rows (they're already
      // approved) and returns 0. No risk of re-crediting historical commissions.
      const claimed = await tx.$queryRaw`
        UPDATE affiliate_commissions
        SET status = 'approved'
        WHERE status = 'held' AND "releasesAt" <= ${now}
        RETURNING id, "memberId", "leadId", "marketerAmount", "leadAmount"
      `;
      if (claimed.length === 0) return 0;

      const memberTotals = {};
      for (const c of claimed) {
        memberTotals[c.memberId] = (memberTotals[c.memberId] || 0) + c.marketerAmount;
        if (c.leadId) {
          memberTotals[c.leadId] = (memberTotals[c.leadId] || 0) + c.leadAmount;
        }
      }
      for (const [id, amount] of Object.entries(memberTotals)) {
        await tx.$executeRaw`
          UPDATE crew_members SET "totalEarned" = "totalEarned" + ${amount} WHERE id = ${id}
        `;
      }

      return claimed.length;
    });
    return count;
  } catch (err) {
    log.error('Commission release', err.message);
    return 0;
  }
}
