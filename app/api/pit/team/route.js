import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";
import crypto from "crypto";
import { getApplicationUrl } from "@/lib/env";

export async function GET() {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const members = await prisma.crewMember.findMany({
      where: { leadId: member.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        tier: true, commissionRate: true, totalEarned: true, totalPaid: true,
        inviteToken: true, inviteExpiresAt: true, approvedAt: true, createdAt: true,
        _count: { select: { commissions: true, links: true } },
      },
    });

    return Response.json({
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        status: m.status,
        tier: m.tier,
        commissionRate: m.commissionRate,
        totalEarned: m.totalEarned / 100,
        commissions: m._count.commissions,
        links: m._count.links,
        approvedAt: m.approvedAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
        hasPendingInvite: !!(m.inviteToken && m.inviteExpiresAt && m.inviteExpiresAt > new Date()),
        inviteExpired: !!(m.inviteExpiresAt && (!m.inviteToken || m.inviteExpiresAt <= new Date())),
      })),
    });
  } catch (e) {
    console.error("Team GET error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email } = await req.json().catch(() => ({}));
    if (!name?.trim() || !email?.trim()) return Response.json({ error: "Name and email are required" }, { status: 400 });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.crewMember.findUnique({ where: { email: cleanEmail } });
    if (existing) return Response.json({ error: "A member with this email already exists" }, { status: 409 });

    const inviteToken = crypto.randomBytes(24).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invited = await prisma.crewMember.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: "",
        role: "crew",
        status: "pending",
        leadId: member.id,
        inviteToken,
        inviteExpiresAt,
      },
    });

    const inviteUrl = `${getApplicationUrl()}/pit/join/${inviteToken}`;

    return Response.json({
      invited: {
        id: invited.id,
        name: invited.name,
        email: invited.email,
        inviteUrl,
      },
    });
  } catch (e) {
    console.error("Team POST error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { memberId } = await req.json().catch(() => ({}));
    if (!memberId) return Response.json({ error: "Member ID required" }, { status: 400 });

    const target = await prisma.crewMember.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, leadId: true, status: true, deletedAt: true },
    });
    if (!target || target.leadId !== member.id) return Response.json({ error: "Member not found" }, { status: 404 });
    if (target.deletedAt) return Response.json({ error: "Member has been deleted" }, { status: 410 });
    if (target.status !== "pending") return Response.json({ error: "Only pending invites can be resent" }, { status: 400 });

    const inviteToken = crypto.randomBytes(24).toString("hex");
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { count } = await prisma.crewMember.updateMany({
      where: { id: memberId, status: 'pending', deletedAt: null },
      data: { inviteToken, inviteExpiresAt },
    });
    if (count === 0) return Response.json({ error: "Invite is no longer pending" }, { status: 409 });

    const inviteUrl = `${getApplicationUrl()}/pit/join/${inviteToken}`;
    return Response.json({ ok: true, inviteUrl, name: target.name });
  } catch (e) {
    console.error("Team PATCH error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { memberId } = await req.json().catch(() => ({}));
    if (!memberId) return Response.json({ error: "Member ID required" }, { status: 400 });

    const target = await prisma.crewMember.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, leadId: true, status: true },
    });
    if (!target || target.leadId !== member.id) return Response.json({ error: "Member not found" }, { status: 404 });
    if (target.status !== "pending") return Response.json({ error: "Only pending invites can be revoked" }, { status: 400 });

    const { count } = await prisma.crewMember.deleteMany({ where: { id: memberId, status: 'pending' } });
    if (count === 0) return Response.json({ error: "Invite is no longer pending" }, { status: 409 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Team DELETE error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
