import prisma from "@/lib/prisma";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail, maskPhone } from "@/lib/admin";
import { kickFromGroup } from "@/lib/crew-bot";
import { sendEmail, pitRejectionEmail } from "@/lib/email";

export async function GET(req) {
  const { admin, error } = await requireAdmin("crew");
  if (error) return error;

  const { searchParams } = new URL(req.url);

  if (searchParams.get("view") === "activity") {
    try {
      const logs = await prisma.activityLog.findMany({
        where: { action: { contains: "crew" } },
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
    const [pendingPayouts, heldCommissions, thirtyDaysAgo, archivedLinkRows] = await Promise.all([
      prisma.affiliatePayout.count({ where: { status: "pending" } }),
      prisma.affiliateCommission.aggregate({ where: { status: "held" }, _sum: { marketerAmount: true, leadAmount: true } }),
      Promise.resolve(new Date(Date.now() - 30 * 86400000)),
      prisma.acquisitionLink.findMany({ where: { affiliateId: { in: memberIds }, archivedAt: { not: null } }, select: { affiliateId: true, slug: true, name: true, archivedAt: true } }),
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
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true, role: true } });
      const rateKey = m?.role === "chief" ? "affiliate_pro_rate" : "affiliate_starter_rate";
      const rateRow = await prisma.setting.findUnique({ where: { key: rateKey } });
      const rate = parseInt(rateRow?.value) || (m?.role === "chief" ? 50 : 30);
      await prisma.crewMember.update({
        where: { id: memberId },
        data: { status: "approved", approvedAt: new Date(), commissionRate: rate },
      });

      const hasLink = await prisma.acquisitionLink.findFirst({ where: { affiliateId: memberId, archivedAt: null } });
      if (!hasLink) {
        let slug = (m?.name || 'crew').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const taken = await prisma.acquisitionLink.findUnique({ where: { slug } });
        if (taken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
        await prisma.acquisitionLink.create({
          data: { name: `${m?.name || 'Crew'}'s link`, slug, affiliateId: memberId },
        });
      }

      await logActivity(admin.name, `Approved crew member: ${m?.name || memberId}`);
      return Response.json({ ok: true });
    }

    if (action === "reject") {
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true, email: true, telegramUserId: true } });
      await prisma.crewMember.update({ where: { id: memberId }, data: { status: "rejected" } });
      if (m?.telegramUserId) kickFromGroup(m.telegramUserId).catch(() => {});
      if (m?.email) {
        const html = pitRejectionEmail(m.name || 'there');
        sendEmail(m.email, 'Your Pit application update', html).catch(() => {});
      }
      await logActivity(admin.name, `Rejected crew member: ${m?.name || memberId}`);
      return Response.json({ ok: true });
    }

    if (action === "suspend") {
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true, telegramUserId: true } });
      await prisma.crewMember.update({ where: { id: memberId }, data: { status: "suspended", suspendedAt: new Date() } });
      if (m?.telegramUserId) kickFromGroup(m.telegramUserId).catch(() => {});
      await logActivity(admin.name, `Suspended crew member: ${m?.name || memberId}`);
      return Response.json({ ok: true });
    }

    if (action === "reinstate") {
      await prisma.crewMember.update({ where: { id: memberId }, data: { status: "approved", suspendedAt: null } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Reinstated crew member: ${m?.name || memberId}`);
      return Response.json({ ok: true });
    }

    if (action === "update-tier") {
      const { tier, commissionRate } = body;
      const tierSettings = await prisma.setting.findMany({
        where: { key: { in: ['affiliate_starter_rate', 'affiliate_growth_rate', 'affiliate_pro_rate'] } },
      });
      const sv = Object.fromEntries(tierSettings.map(r => [r.key, parseInt(r.value)]));
      const TIERS = { starter: sv.affiliate_starter_rate || 30, growth: sv.affiliate_growth_rate || 40, pro: sv.affiliate_pro_rate || 50 };
      const rate = commissionRate || TIERS[tier] || 30;
      await prisma.crewMember.update({ where: { id: memberId }, data: { tier, commissionRate: rate } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Updated ${m?.name || memberId} to ${tier} (${rate}%)`);
      return Response.json({ ok: true });
    }

    if (action === "promote-chief") {
      const { teamName } = body;
      const proRateRow = await prisma.setting.findUnique({ where: { key: 'affiliate_pro_rate' } });
      const proRate = parseInt(proRateRow?.value) || 50;
      await prisma.crewMember.update({ where: { id: memberId }, data: { role: "chief", tier: "pro", commissionRate: proRate, teamName: teamName?.trim() || null, leadId: null } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Promoted ${m?.name || memberId} to chief`);
      return Response.json({ ok: true });
    }

    if (action === "demote-crew") {
      const orphaned = await prisma.crewMember.findMany({ where: { leadId: memberId }, select: { id: true } });
      if (orphaned.length) {
        await prisma.crewMember.updateMany({ where: { leadId: memberId }, data: { leadId: null } });
      }
      await prisma.crewMember.update({ where: { id: memberId }, data: { role: "crew", teamName: null } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Demoted ${m?.name || memberId} to crew${orphaned.length ? ` (${orphaned.length} crew unassigned)` : ''}`);
      return Response.json({ ok: true, unassignedCrew: orphaned.length });
    }

    if (action === "update-team-name") {
      const { teamName } = body;
      await prisma.crewMember.update({ where: { id: memberId }, data: { teamName: teamName?.trim() || null } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Updated team name for ${m?.name || memberId}`);
      return Response.json({ ok: true });
    }

    if (action === "assign-team" || action === "move-team") {
      const { chiefId } = body;
      if (!chiefId) return Response.json({ error: "Chief ID required" }, { status: 400 });
      if (chiefId === memberId) return Response.json({ error: "Cannot assign a member to themselves" }, { status: 400 });
      const [chief, m] = await Promise.all([
        prisma.crewMember.findUnique({ where: { id: chiefId }, select: { name: true, role: true, status: true } }),
        prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true, role: true } }),
      ]);
      if (!chief || chief.role !== "chief") return Response.json({ error: "Destination must be a chief" }, { status: 400 });
      if (chief.status !== "approved") return Response.json({ error: "Destination chief is not active" }, { status: 400 });
      if (m?.role === "chief") return Response.json({ error: "Chiefs cannot be assigned to a team" }, { status: 400 });
      await prisma.crewMember.update({ where: { id: memberId }, data: { leadId: chiefId } });
      await logActivity(admin.name, `${action === "move-team" ? "Moved" : "Assigned"} crew member ${m?.name || memberId} to ${chief.name}'s team`);
      return Response.json({ ok: true });
    }

    if (action === "unassign-team") {
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await prisma.crewMember.update({ where: { id: memberId }, data: { leadId: null } });
      await logActivity(admin.name, `Removed crew member ${m?.name || memberId} from their team`);
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true, telegramUserId: true } });
      await prisma.crewSession.deleteMany({ where: { memberId } });
      await prisma.crewMember.update({ where: { id: memberId }, data: { deletedAt: new Date() } });
      if (m?.telegramUserId) kickFromGroup(m.telegramUserId).catch(() => {});
      await logActivity(admin.name, `Deleted crew member: ${m?.name || memberId}`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Admin crew POST error:", e);
    return Response.json({ error: e?.message || "Something went wrong" }, { status: 500 });
  }
}
