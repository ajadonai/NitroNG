import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { crewSignup, crewFirstPurchase, crewRepeatBuyer } from '@/lib/crew-bot';
import { getAffiliateSettings } from '@/lib/affiliate-settings';
import { isActiveCrewMember } from '@/lib/affiliate-eligibility';

async function getCrewSettings() {
  const s = await getAffiliateSettings(['affiliate_hold_days', 'affiliate_lead_split', 'affiliate_min_order']);
  return {
    holdDays: s.affiliate_hold_days,
    leadSplit: s.affiliate_lead_split,
    minOrderKobo: s.affiliate_min_order * 100,
  };
}

export async function createCommission(orderId, userId, chargeKobo, costKobo) {
  try {
    const { affiliate_enabled } = await getAffiliateSettings(['affiliate_enabled']);
    if (affiliate_enabled === 'false') return null;

    const settings = await getCrewSettings();
    if (chargeKobo < settings.minOrderKobo) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { signupSource: true, email: true, referredByMemberId: true, referredByLinkId: true, createdAt: true },
    });
    if (!user) return null;

    let memberId = user.referredByMemberId;
    let linkId = user.referredByLinkId;

    // Fallback for users created before frozen attribution was deployed.
    // Users created after the migration have null frozen IDs only if signup
    // used a disabled/archived link — those must NOT fall back to live lookup.
    const FREEZE_DEPLOYED = new Date('2026-07-02T00:00:00Z');
    if (!memberId || !linkId) {
      if (user.createdAt >= FREEZE_DEPLOYED) return null;
      if (!user.signupSource) return null;
      const link = await prisma.acquisitionLink.findUnique({
        where: { slug: user.signupSource },
        select: { id: true, affiliateId: true, enabled: true },
      });
      if (!link?.affiliateId) return null;
      memberId = link.affiliateId;
      linkId = link.id;
    }

    const member = await prisma.crewMember.findUnique({
      where: { id: memberId },
      select: { id: true, status: true, deletedAt: true, commissionRate: true, leadId: true, role: true, email: true },
    });
    if (!isActiveCrewMember(member)) return null;

    if (user.email && member.email && user.email.toLowerCase() === member.email.toLowerCase()) return null;

    const leadSplit = settings.leadSplit;

    const profit = chargeKobo - (costKobo || 0);
    if (profit <= 0) return null;

    const releasesAt = new Date();
    releasesAt.setDate(releasesAt.getDate() + settings.holdDays);

    const commission = await prisma.$transaction(async (tx) => {
      // The first read is only a fast eligibility rejection. This locked read is
      // the final fence: deletion/suspension must either finish before it (and
      // produce no commission) or wait until the commission has committed.
      const [lockedMember] = await tx.$queryRaw`
        SELECT id, status, "deletedAt", "commissionRate", "leadId", role, email
        FROM crew_members
        WHERE id = ${member.id}
          AND status = 'approved'
          AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      if (!lockedMember) return null;
      if (user.email && lockedMember.email && user.email.toLowerCase() === lockedMember.email.toLowerCase()) return null;

      const existing = await tx.affiliateCommission.findFirst({ where: { orderId } });
      if (existing) return null;

      const crewTotal = Math.round(profit * (lockedMember.commissionRate / 100));
      if (crewTotal <= 0) return null;

      let leadAmount = 0;
      let marketerAmount = crewTotal;
      let leadId = null;

      if (lockedMember.role === 'crew' && lockedMember.leadId) {
        const [lockedLead] = await tx.$queryRaw`
          SELECT id
          FROM crew_members
          WHERE id = ${lockedMember.leadId}
            AND status = 'approved'
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        if (!lockedLead) return null;
        leadId = lockedMember.leadId;
        leadAmount = Math.round(crewTotal * (leadSplit / 100));
        marketerAmount = crewTotal - leadAmount;
      }

      return tx.affiliateCommission.create({
        data: {
          orderId,
          linkId,
          memberId: lockedMember.id,
          leadId,
          orderCharge: chargeKobo,
          orderCost: costKobo || 0,
          commissionRate: lockedMember.commissionRate,
          leadSplit: leadId ? leadSplit : 0,
          leadAmount,
          marketerAmount,
          status: 'held',
          releasesAt,
        },
      });
    }, { isolationLevel: 'Serializable' });
    if (!commission) return null;

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
    raiseMoneyIssue('commission_failed', {
      orderId, userId, error: err.message,
    }).catch(() => {});
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
    tx.affiliateCommission.aggregate({
      where: { leadId: memberId, status: 'approved' },
      _sum: { leadAmount: true },
    }),
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
    tx.affiliateCommission.aggregate({
      where: { leadId: memberId, status: 'held' },
      _sum: { leadAmount: true },
    }),
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
      select: { name: true, status: true, deletedAt: true },
    });
    if (isActiveCrewMember(member)) crewSignup(member.name);
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

      // Auto-reject pending/processing payouts that can no longer be covered
      for (const memberId of Object.keys(memberTotals)) {
        const pendingPayouts = await tx.affiliatePayout.findMany({
          where: { memberId, status: { in: ['pending', 'processing'] } },
          orderBy: { createdAt: 'asc' },
        });
        if (pendingPayouts.length === 0) continue;

        const [m] = await tx.$queryRaw`
          SELECT "totalPaid", role FROM crew_members WHERE id = ${memberId}
        `;
        if (!m) continue;

        const earnings = await getMemberEarnings(memberId, m.role, tx);
        let available = earnings.totalApproved - m.totalPaid;
        const toReject = [];
        for (const p of pendingPayouts) {
          if (available >= p.amount) {
            available -= p.amount;
          } else {
            toReject.push(p.id);
          }
        }
        if (toReject.length > 0) {
          await tx.$executeRaw`
            UPDATE affiliate_payouts
            SET status = 'rejected', "processedAt" = ${now},
                "bankName" = NULL, "bankAccountNo" = NULL, "bankAccountName" = NULL
            WHERE id = ANY(${toReject}) AND status IN ('pending', 'processing')
          `;
        }
      }

      return rows.length;
    });
    return count;
  } catch (err) {
    log.error('Commission void', err.message);
    raiseMoneyIssue('void_failed', {
      orderId, reason, error: err.message,
    }).catch(() => {});
    return 0;
  }
}

const ISSUE_TITLES = {
  commission_failed: 'Commission creation failed',
  void_failed: 'Commission void failed',
  release_failed: 'Commission release failed',
  payout_failed: 'Payout transition failed',
};

export async function raiseMoneyIssue(type, meta) {
  try {
    const dedupeKey = meta.orderId || meta.payoutId || type;
    const existing = await prisma.adminIssue.findFirst({
      where: { type, status: 'open', metadata: { contains: dedupeKey } },
    });
    const metadata = JSON.stringify(meta);
    const title = ISSUE_TITLES[type] || type;
    const message = Object.entries(meta)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    if (existing) {
      await prisma.adminIssue.update({
        where: { id: existing.id },
        data: { message, metadata, createdAt: new Date() },
      });
    } else {
      await prisma.adminIssue.create({
        data: { type, title, message, metadata },
      });
    }
  } catch (e) {
    log.error('raiseMoneyIssue', e.message);
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
        UPDATE affiliate_commissions AS commission
        SET status = 'approved'
        WHERE commission.status = 'held'
          AND commission."releasesAt" <= ${now}
          AND EXISTS (
            SELECT 1 FROM crew_members AS member
            WHERE member.id = commission."memberId"
              AND member.status = 'approved'
              AND member."deletedAt" IS NULL
          )
          AND (
            commission."leadId" IS NULL
            OR (
              commission."leadAmount" = 0
              AND commission."leadForfeitedAt" IS NOT NULL
            )
            OR EXISTS (
              SELECT 1 FROM crew_members AS lead
              WHERE lead.id = commission."leadId"
                AND lead.status = 'approved'
                AND lead."deletedAt" IS NULL
            )
          )
        RETURNING commission.id, commission."memberId", commission."leadId", commission."marketerAmount", commission."leadAmount"
      `;
      if (claimed.length === 0) return 0;

      const memberTotals = {};
      for (const c of claimed) {
        memberTotals[c.memberId] = (memberTotals[c.memberId] || 0) + c.marketerAmount;
        if (c.leadId && c.leadAmount > 0) {
          memberTotals[c.leadId] = (memberTotals[c.leadId] || 0) + c.leadAmount;
        }
      }
      for (const [id, amount] of Object.entries(memberTotals)) {
        const credited = await tx.$executeRaw`
          UPDATE crew_members
          SET "totalEarned" = "totalEarned" + ${amount}
          WHERE id = ${id}
            AND status = 'approved'
            AND "deletedAt" IS NULL
        `;
        if (Number(credited) !== 1) {
          // Throwing rolls back both the commission transition and every earlier
          // member increment in this batch. The next cron can retry safely.
          throw new Error('Affiliate eligibility changed during commission release');
        }
      }

      return claimed.length;
    });
    return count;
  } catch (err) {
    log.error('Commission release', err.message);
    raiseMoneyIssue('release_failed', {
      error: err.message,
    }).catch(() => {});
    return 0;
  }
}
