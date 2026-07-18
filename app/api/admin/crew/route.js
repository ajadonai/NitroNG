import prisma from "@/lib/prisma";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail, maskPhone } from "@/lib/admin";
import { kickFromGroup } from "@/lib/crew-bot";
import { sendEmail, pitRejectionEmail, pitApprovedEmail, pitSuspendedEmail } from "@/lib/email";
import { getTierRates, rateForRole } from "@/lib/affiliate-settings";
import { permanentlyDeleteCrewMember } from '@/lib/crew-account-deletion';

const MAX_RETRIES = 3;
async function serializable(fn) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: 'Serializable' });
    } catch (e) {
      if (e.code === 'P2034' && attempt < MAX_RETRIES - 1) continue;
      throw e;
    }
  }
}

export async function GET(req) {
  const { admin, error } = await requireAdmin("crew");
  if (error) return error;

  const { searchParams } = new URL(req.url);

  if (searchParams.get("view") === "activity") {
    try {
      const logs = await prisma.activityLog.findMany({
        where: { type: 'crew' },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return Response.json({ logs: logs.map(l => ({ id: l.id, adminName: l.adminName, action: l.action, createdAt: l.createdAt.toISOString() })) });
    } catch { return Response.json({ logs: [] }); }
  }

  try {
    const members = await prisma.crewMember.findMany({
      where: { status: { not: "rejected" }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { id: true, name: true } },
        _count: { select: { commissions: true, crew: true, links: { where: { archivedAt: null } }, payouts: true } },
      },
    });

    const memberIds = members.map(m => m.id);
    const MONEY_ISSUE_TYPES = ['commission_failed', 'void_failed', 'release_failed', 'payout_failed'];
    const [pendingPayouts, heldCommissions, archivedLinkRows, affiliateEnabledRow, moneyIssues] = await Promise.all([
      prisma.affiliatePayout.count({ where: { status: "pending" } }),
      prisma.affiliateCommission.aggregate({ where: { status: "held" }, _sum: { marketerAmount: true, leadAmount: true } }),
      prisma.acquisitionLink.findMany({ where: { affiliateId: { in: memberIds }, archivedAt: { not: null } }, select: { affiliateId: true, slug: true, name: true, archivedAt: true } }),
      prisma.setting.findUnique({ where: { key: 'affiliate_enabled' }, select: { value: true } }).catch(() => null),
      prisma.adminIssue.findMany({ where: { type: { in: MONEY_ISSUE_TYPES }, status: 'open' }, orderBy: { createdAt: 'desc' }, take: 10 }).catch(() => []),
    ]);
    const archivedByMember = {};
    for (const r of archivedLinkRows) {
      (archivedByMember[r.affiliateId] ||= []).push({ slug: r.slug, name: r.name, archivedAt: r.archivedAt.toISOString() });
    }
    const heldAmount = ((heldCommissions._sum.marketerAmount || 0) + (heldCommissions._sum.leadAmount || 0)) / 100;
    const totalPaidOut = members.reduce((s, m) => s + m.totalPaid, 0) / 100;

    const sensitive = canSeeSensitive(admin);

    return Response.json({
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: sensitive ? m.email : maskEmail(m.email),
        phone: sensitive ? m.phone : maskPhone(m.phone),
        xHandle: m.xHandle || null,
        role: m.role,
        status: m.status,
        tier: m.tier,
        telegramHandle: m.telegramHandle || null,
        telegramLinked: !!m.telegramUserId,
        commissionRate: m.commissionRate,
        whyApply: m.whyApply || null,
        ...(sensitive ? { totalEarned: m.totalEarned / 100, totalPaid: m.totalPaid / 100 } : {}),
        teamName: m.teamName || null,
        leadId: m.leadId || null,
        leadName: m.lead?.name || null,
        commissions: m._count.commissions,
        crewCount: m._count.crew,
        links: m._count.links,
        archivedLinks: archivedByMember[m.id] || [],
        payouts: m._count.payouts,
        approvedAt: m.approvedAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      stats: { pendingPayouts, heldAmount, totalPaidOut },
      affiliateEnabled: affiliateEnabledRow?.value !== 'false',
      moneyIssues: moneyIssues.map(i => ({ id: i.id, type: i.type, title: i.title, message: i.message, createdAt: i.createdAt.toISOString() })),
    });
  } catch (e) {
    console.error("Admin crew GET error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin("crew", true);
  if (error) return error;

  try {
    const { action, memberId, ...body } = await req.json();

    if (action === "approve") {
      let approved;
      try {
        approved = await serializable(async (tx) => {
          const m = await tx.crewMember.findUnique({
            where: { id: memberId },
            select: { name: true, role: true, email: true, status: true, deletedAt: true },
          });
          if (!m) throw Object.assign(new Error('Member not found'), { _status: 404 });
          if (m.deletedAt) throw Object.assign(new Error('Deleted members cannot be changed'), { _status: 409 });
          if (m.status !== 'pending') throw Object.assign(new Error('Member is no longer pending'), { _status: 409 });

          const tierRates = await getTierRates(tx);
          const rate = rateForRole(tierRates, m.role);
          const { count } = await tx.crewMember.updateMany({
            where: { id: memberId, status: 'pending', deletedAt: null },
            data: { status: "approved", approvedAt: new Date(), commissionRate: rate },
          });
          if (count !== 1) throw Object.assign(new Error('Member state changed'), { _status: 409 });

          const hasLink = await tx.acquisitionLink.findFirst({ where: { affiliateId: memberId, archivedAt: null } });
          if (!hasLink) {
            let slug = (m.name || 'crew').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const taken = await tx.acquisitionLink.findUnique({ where: { slug } });
            if (taken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
            await tx.acquisitionLink.create({
              data: { name: `${m.name || 'Crew'}'s link`, slug, affiliateId: memberId },
            });
          }
          return { m, rate };
        });
      } catch (e) {
        if (e._status) return Response.json({ error: e.message }, { status: e._status });
        throw e;
      }
      const { m } = approved;

      if (m?.email) {
        sendEmail(m.email, "You're in. Welcome to the Pit", pitApprovedEmail(m.name || 'there'),
          'Your Pit application has been approved and your referral link is live. Log in: https://nitro.ng/pit').catch(() => {});
      }
      await logActivity(admin.name, `Approved crew member: ${m?.name || memberId}`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "reject") {
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true, email: true, telegramUserId: true } });
      const { count } = await prisma.crewMember.updateMany({
        where: { id: memberId, status: 'pending', deletedAt: null },
        data: { status: "rejected", inviteToken: null, inviteExpiresAt: null },
      });
      if (count === 0) return Response.json({ error: "Member is no longer pending" }, { status: 409 });
      if (m?.telegramUserId) kickFromGroup(m.telegramUserId).catch(() => {});
      if (m?.email) {
        const html = pitRejectionEmail(m.name || 'there');
        sendEmail(m.email, 'Your Pit application update', html).catch(() => {});
      }
      await logActivity(admin.name, `Rejected crew member: ${m?.name || memberId}`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "suspend") {
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true, email: true, telegramUserId: true } });
      await prisma.crewSession.deleteMany({ where: { memberId } });
      const { count } = await prisma.crewMember.updateMany({
        where: { id: memberId, deletedAt: null },
        data: { status: "suspended", suspendedAt: new Date(), telegramLinkCode: null, telegramLinkCodeExpiresAt: null },
      });
      if (count !== 1) return Response.json({ error: 'Deleted members cannot be changed' }, { status: 409 });
      if (m?.telegramUserId) kickFromGroup(m.telegramUserId).catch(() => {});
      if (m?.email) {
        sendEmail(m.email, 'Your Pit account has been paused', pitSuspendedEmail(m.name || 'there'),
          'Your Pit account has been suspended and commissions are on hold. If you think this is a mistake, contact support@nitro.ng').catch(() => {});
      }
      await logActivity(admin.name, `Suspended crew member: ${m?.name || memberId}`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "reinstate") {
      const { count } = await prisma.crewMember.updateMany({
        where: { id: memberId, status: 'suspended', deletedAt: null },
        data: { status: "approved", suspendedAt: null },
      });
      if (count === 0) return Response.json({ error: "Only suspended members can be reinstated" }, { status: 409 });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Reinstated crew member: ${m?.name || memberId}`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "update-tier") {
      const { tier, commissionRate } = body;
      const tierRates = await getTierRates();
      const rate = commissionRate || tierRates[tier] || tierRates.starter;
      const { count } = await prisma.crewMember.updateMany({
        where: { id: memberId, deletedAt: null },
        data: { tier, commissionRate: rate },
      });
      if (count !== 1) return Response.json({ error: 'Deleted members cannot be changed' }, { status: 409 });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Updated ${m?.name || memberId} to ${tier} (${rate}%)`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "promote-chief") {
      const { teamName } = body;
      const memberName = await serializable(async (tx) => {
        const tierRates = await getTierRates(tx);
        const proRate = tierRates.pro;
        const { count } = await tx.crewMember.updateMany({
          where: { id: memberId, deletedAt: null },
          data: { role: "chief", tier: "pro", commissionRate: proRate, teamName: teamName?.trim() || null, leadId: null },
        });
        if (count !== 1) throw Object.assign(new Error('Deleted members cannot be changed'), { _status: 409 });
        return (await tx.crewMember.findUnique({ where: { id: memberId }, select: { name: true } }))?.name;
      });
      await logActivity(admin.name, `Promoted ${memberName || memberId} to chief`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "demote-crew") {
      const { name: memberName, unassigned } = await serializable(async (tx) => {
        const { count } = await tx.crewMember.updateMany({
          where: { leadId: memberId, deletedAt: null },
          data: { leadId: null },
        });
        const target = await tx.crewMember.updateMany({
          where: { id: memberId, deletedAt: null },
          data: { role: "crew", teamName: null },
        });
        if (target.count === 0) throw Object.assign(new Error('Deleted members cannot be changed'), { _status: 409 });
        const updated = await tx.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
        return { name: updated?.name, unassigned: count };
      });
      await logActivity(admin.name, `Demoted ${memberName || memberId} to crew${unassigned ? ` (${unassigned} crew unassigned)` : ''}`, 'crew');
      return Response.json({ ok: true, unassignedCrew: unassigned });
    }

    if (action === "update-team-name") {
      const { teamName } = body;
      const { count } = await prisma.crewMember.updateMany({
        where: { id: memberId, deletedAt: null },
        data: { teamName: teamName?.trim() || null },
      });
      if (count !== 1) return Response.json({ error: 'Deleted members cannot be changed' }, { status: 409 });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Updated team name for ${m?.name || memberId}`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "assign-team" || action === "move-team") {
      const { chiefId } = body;
      if (!chiefId) return Response.json({ error: "Chief ID required" }, { status: 400 });
      if (chiefId === memberId) return Response.json({ error: "Cannot assign a member to themselves" }, { status: 400 });
      let result;
      try {
        result = await serializable(async (tx) => {
          const [chief, m] = await Promise.all([
            tx.crewMember.findUnique({ where: { id: chiefId }, select: { name: true, role: true, status: true, deletedAt: true } }),
            tx.crewMember.findUnique({ where: { id: memberId }, select: { name: true, role: true, deletedAt: true } }),
          ]);
          if (!m) throw Object.assign(new Error("Member not found"), { _status: 404 });
          if (m.deletedAt) throw Object.assign(new Error('Deleted members cannot be changed'), { _status: 409 });
          if (!chief || chief.role !== "chief") throw Object.assign(new Error("Destination must be a chief"), { _status: 400 });
          if (chief.status !== "approved" || chief.deletedAt) throw Object.assign(new Error("Destination chief is not active"), { _status: 400 });
          if (m.role === "chief") throw Object.assign(new Error("Chiefs cannot be assigned to a team"), { _status: 400 });
          const target = await tx.crewMember.updateMany({
            where: { id: memberId, deletedAt: null },
            data: { leadId: chiefId },
          });
          if (target.count !== 1) throw Object.assign(new Error('Member state changed'), { _status: 409 });
          return { memberName: m.name, chiefName: chief.name };
        });
      } catch (e) {
        if (e._status) return Response.json({ error: e.message }, { status: e._status });
        throw e;
      }
      await logActivity(admin.name, `${action === "move-team" ? "Moved" : "Assigned"} crew member ${result.memberName || memberId} to ${result.chiefName}'s team`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "unassign-team") {
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      const { count } = await prisma.crewMember.updateMany({ where: { id: memberId, deletedAt: null }, data: { leadId: null } });
      if (count !== 1) return Response.json({ error: 'Deleted members cannot be changed' }, { status: 409 });
      await logActivity(admin.name, `Removed crew member ${m?.name || memberId} from their team`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const deletedAt = new Date();
      let m;
      try {
        m = await serializable(tx => permanentlyDeleteCrewMember(tx, memberId, deletedAt));
      } catch (e) {
        if (e._status) return Response.json({ error: e.message }, { status: e._status });
        throw e;
      }
      if (m?.telegramUserId) kickFromGroup(m.telegramUserId).catch(() => {});
      await logActivity(admin.name, `Deleted Pit member: ${memberId}`, 'crew');
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e?._status) return Response.json({ error: e.message }, { status: e._status });
    console.error("Admin crew POST error:", e);
    return Response.json({ error: e?.message || "Something went wrong" }, { status: 500 });
  }
}
