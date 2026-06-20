import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function getCrewSession() {
  const jar = await cookies();
  const token = jar.get("crew_session")?.value;
  if (!token) return null;

  const session = await prisma.crewSession.findUnique({
    where: { token },
    include: { member: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.crewSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (session.member.status !== "approved") return null;

  return session.member;
}

export function memberToClient(m) {
  return {
    id: m.id,
    role: m.role,
    name: m.name,
    email: m.email,
    tier: m.tier,
    commissionRate: m.commissionRate,
    totalEarned: m.totalEarned / 100,
    totalPaid: m.totalPaid / 100,
  };
}
