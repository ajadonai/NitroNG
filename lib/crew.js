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

export function memberToClient(m, full = false) {
  const base = {
    id: m.id,
    role: m.role,
    name: m.name,
    email: m.email,
    tier: m.tier,
    commissionRate: m.commissionRate,
    totalEarned: m.totalEarned / 100,
    totalPaid: m.totalPaid / 100,
  };
  if (!full) return base;
  return {
    ...base,
    phone: m.phone || "",
    xHandle: m.xHandle || "",
    bankName: m.bankName || "",
    bankAccountNo: m.bankAccountNo || "",
    bankAccountName: m.bankAccountName || "",
  };
}

export async function getDashboardData(member) {
  const id = member.id;
  const isChief = member.role === "chief";
  const amountField = isChief ? "leadAmount" : "marketerAmount";

  const [heldSum, approvedSum, pendingPayouts, recentDirect, recentLead, links, clickCount, totalCommissions, activeReferrals] = await Promise.all([
    prisma.affiliateCommission.aggregate({
      where: { ...(isChief ? { leadId: id } : { memberId: id }), status: "held" },
      _sum: { [amountField]: true },
    }),
    prisma.affiliateCommission.aggregate({
      where: { ...(isChief ? { leadId: id } : { memberId: id }), status: "approved" },
      _sum: { [amountField]: true },
    }),
    prisma.affiliatePayout.aggregate({
      where: { memberId: id, status: { in: ["pending", "processing"] } },
      _sum: { amount: true },
    }),
    prisma.affiliateCommission.findMany({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
      take: isChief ? 3 : 6,
      include: { order: { select: { orderId: true, charge: true } }, link: { select: { slug: true } } },
    }),
    isChief
      ? prisma.affiliateCommission.findMany({
          where: { leadId: id, memberId: { not: id } },
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { order: { select: { orderId: true, charge: true } }, link: { select: { slug: true } }, member: { select: { name: true } } },
        })
      : [],
    prisma.acquisitionLink.findMany({
      where: { affiliateId: id, archivedAt: null },
      select: { slug: true, enabled: true },
    }),
    prisma.linkClick.count({ where: { link: { affiliateId: id, archivedAt: null } } }),
    prisma.affiliateCommission.count({ where: isChief ? { leadId: id } : { memberId: id } }),
    prisma.affiliateCommission.groupBy({
      by: ["orderId"],
      where: { ...(isChief ? { leadId: id } : { memberId: id }), status: "approved" },
    }),
  ]);

  const held = heldSum._sum[amountField] || 0;
  const approved = approvedSum._sum[amountField] || 0;
  const pendingAmount = pendingPayouts._sum.amount || 0;
  const available = approved - member.totalPaid - pendingAmount;

  const recent = [
    ...recentDirect.map((c) => ({
      id: c.id, orderId: c.order.orderId, orderCharge: c.orderCharge / 100,
      amount: c.marketerAmount / 100, status: c.status, type: "direct",
      slug: c.link.slug, createdAt: c.createdAt.toISOString(),
    })),
    ...recentLead.map((c) => ({
      id: c.id, orderId: c.order.orderId, orderCharge: c.orderCharge / 100,
      amount: c.leadAmount / 100, status: c.status, type: "team",
      memberName: c.member.name, slug: c.link.slug, createdAt: c.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  return {
    stats: {
      totalEarned: member.totalEarned / 100,
      totalPaid: member.totalPaid / 100,
      pending: held / 100,
      availableBalance: Math.max(0, available) / 100,
      clicks: clickCount,
      conversions: totalCommissions,
      activeReferrals: activeReferrals.length,
    },
    tier: { name: member.tier, rate: member.commissionRate },
    recentCommissions: recent,
    links: links.map((l) => ({ slug: l.slug, enabled: l.enabled })),
  };
}
