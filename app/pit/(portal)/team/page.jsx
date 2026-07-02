import { redirect } from "next/navigation";
import { getCrewSession } from "@/lib/crew";
import prisma from "@/lib/prisma";
import TeamPage from "@/components/m/team-page";

async function getInitialTeam(leadId) {
  const members = await prisma.crewMember.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, role: true, status: true,
      tier: true, commissionRate: true, totalEarned: true, totalPaid: true,
      inviteToken: true, inviteExpiresAt: true, approvedAt: true, createdAt: true,
      _count: { select: { commissions: true, links: true } },
    },
  });

  return {
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
    })),
  };
}

export default async function Team() {
  const member = await getCrewSession();
  if (member.role !== "chief") redirect("/pit");
  const initialData = await getInitialTeam(member.id);
  return <TeamPage initialData={initialData} />;
}
