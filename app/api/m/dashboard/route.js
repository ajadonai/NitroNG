import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";

export async function GET() {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const id = member.id;
    const isChief = member.role === "chief";

    const [
      heldCommissions,
      approvedCommissions,
      pendingPayouts,
      recentDirect,
      recentLead,
      links,
      clickCount,
    ] = await Promise.all([
      // Pending (held) earnings
      prisma.affiliateCommission.aggregate({
        where: { ...(isChief ? { leadId: id } : { memberId: id }), status: "held" },
        _sum: { [isChief ? "leadAmount" : "marketerAmount"]: true },
      }),
      // Approved but not yet paid (totalEarned on member already tracks this, but we need fresh)
      prisma.affiliateCommission.aggregate({
        where: { ...(isChief ? { leadId: id } : { memberId: id }), status: "approved" },
        _sum: { [isChief ? "leadAmount" : "marketerAmount"]: true },
      }),
      // Pending/processing payouts
      prisma.affiliatePayout.aggregate({
        where: { memberId: id, status: { in: ["pending", "processing"] } },
        _sum: { amount: true },
      }),
      // Recent commissions (direct)
      prisma.affiliateCommission.findMany({
        where: { memberId: id },
        orderBy: { createdAt: "desc" },
        take: isChief ? 3 : 6,
        include: { order: { select: { orderId: true, charge: true } }, link: { select: { slug: true } } },
      }),
      // Recent lead commissions (chief only)
      isChief
        ? prisma.affiliateCommission.findMany({
            where: { leadId: id, memberId: { not: id } },
            orderBy: { createdAt: "desc" },
            take: 3,
            include: {
              order: { select: { orderId: true, charge: true } },
              link: { select: { slug: true } },
              member: { select: { name: true } },
            },
          })
        : [],
      // Links
      prisma.acquisitionLink.findMany({
        where: { affiliateId: id, archivedAt: null },
        select: { slug: true, enabled: true },
      }),
      // Total clicks
      prisma.linkClick.count({
        where: { link: { affiliateId: id, archivedAt: null } },
      }),
    ]);

    const amountField = isChief ? "leadAmount" : "marketerAmount";
    const heldTotal = heldCommissions._sum[amountField] || 0;
    const approvedTotal = approvedCommissions._sum[amountField] || 0;
    const pendingPayoutTotal = pendingPayouts._sum.amount || 0;
    const availableBalance = approvedTotal - member.totalPaid - pendingPayoutTotal;

    const totalCommissions = await prisma.affiliateCommission.count({
      where: isChief ? { leadId: id } : { memberId: id },
    });

    const recent = [
      ...recentDirect.map((c) => ({
        id: c.id,
        orderId: c.order.orderId,
        orderCharge: c.orderCharge / 100,
        amount: c.marketerAmount / 100,
        status: c.status,
        type: "direct",
        slug: c.link.slug,
        createdAt: c.createdAt,
      })),
      ...recentLead.map((c) => ({
        id: c.id,
        orderId: c.order.orderId,
        orderCharge: c.orderCharge / 100,
        amount: c.leadAmount / 100,
        status: c.status,
        type: "team",
        memberName: c.member.name,
        slug: c.link.slug,
        createdAt: c.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    // Active referrals (unique orders with approved commissions)
    const activeReferrals = await prisma.affiliateCommission.groupBy({
      by: ["orderId"],
      where: { ...(isChief ? { leadId: id } : { memberId: id }), status: "approved" },
    });

    return Response.json({
      stats: {
        totalEarned: member.totalEarned / 100,
        totalPaid: member.totalPaid / 100,
        pending: heldTotal / 100,
        availableBalance: Math.max(0, availableBalance) / 100,
        clicks: clickCount,
        conversions: totalCommissions,
        activeReferrals: activeReferrals.length,
      },
      tier: { name: member.tier, rate: member.commissionRate },
      recentCommissions: recent,
      links: links.map((l) => ({ slug: l.slug, enabled: l.enabled })),
    });
  } catch (e) {
    console.error("Dashboard API error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
