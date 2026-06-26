import prisma from "@/lib/prisma";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail, maskPhone } from "@/lib/admin";

export async function GET() {
  const { admin, error } = await requireAdmin("crew");
  if (error) return error;

  try {
    const members = await prisma.crewMember.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        lead: { select: { name: true } },
        _count: { select: { commissions: true, crew: true, links: true, payouts: true } },
      },
    });

    const pendingPayouts = await prisma.affiliatePayout.count({ where: { status: "pending" } });
    const heldCommissions = await prisma.affiliateCommission.count({ where: { status: "held" } });

    const sensitive = canSeeSensitive(admin);

    return Response.json({
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: sensitive ? m.email : maskEmail(m.email),
        phone: sensitive ? m.phone : maskPhone(m.phone),
        role: m.role,
        status: m.status,
        tier: m.tier,
        commissionRate: m.commissionRate,
        ...(sensitive ? { totalEarned: m.totalEarned / 100, totalPaid: m.totalPaid / 100 } : {}),
        leadName: m.lead?.name || null,
        commissions: m._count.commissions,
        crewCount: m._count.crew,
        links: m._count.links,
        payouts: m._count.payouts,
        approvedAt: m.approvedAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      stats: { pendingPayouts, heldCommissions },
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
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await prisma.crewMember.update({
        where: { id: memberId },
        data: { status: "approved", approvedAt: new Date() },
      });

      const hasLink = await prisma.acquisitionLink.findFirst({ where: { affiliateId: memberId } });
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
      await prisma.crewMember.update({ where: { id: memberId }, data: { status: "rejected" } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Rejected crew member: ${m?.name || memberId}`);
      return Response.json({ ok: true });
    }

    if (action === "suspend") {
      await prisma.crewMember.update({ where: { id: memberId }, data: { status: "suspended", suspendedAt: new Date() } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
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
      const TIERS = { starter: 5, growth: 7, pro: 10 };
      const rate = commissionRate || TIERS[tier] || 5;
      await prisma.crewMember.update({ where: { id: memberId }, data: { tier, commissionRate: rate } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Updated ${m?.name || memberId} to ${tier} (${rate}%)`);
      return Response.json({ ok: true });
    }

    if (action === "promote-chief") {
      await prisma.crewMember.update({ where: { id: memberId }, data: { role: "chief" } });
      const m = await prisma.crewMember.findUnique({ where: { id: memberId }, select: { name: true } });
      await logActivity(admin.name, `Promoted ${m?.name || memberId} to chief`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Admin crew POST error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
