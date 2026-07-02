import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";
import { getMemberEarnings, getMemberHeld } from "@/lib/commissions";

export async function GET() {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const id = member.id;
    const isChief = member.role === "chief";

    const [
      earnings,
      heldTotal,
      pendingPayouts,
      recentDirect,
      recentLead,
      links,
      clickCount,
    ] = await Promise.all([
      getMemberEarnings(id, member.role),
      getMemberHeld(id, member.role),
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
            include: {
              order: { select: { orderId: true, charge: true } },
              link: { select: { slug: true } },
              member: { select: { name: true } },
            },
          })
        : [],
      prisma.acquisitionLink.findMany({
        where: { affiliateId: id, archivedAt: null },
        select: { slug: true, enabled: true },
      }),
      prisma.linkClick.count({
        where: { link: { affiliateId: id, archivedAt: null } },
      }),
    ]);

    const approvedTotal = earnings.totalApproved;
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

    const tierSettings = await prisma.setting.findMany({
      where: { key: { in: ['affiliate_starter_rate', 'affiliate_growth_rate', 'affiliate_pro_rate', 'affiliate_growth_threshold', 'affiliate_pro_threshold', 'affiliate_lead_split'] } },
    });
    const sv = Object.fromEntries(tierSettings.map(r => [r.key, parseInt(r.value)]));
    const tierConfig = {
      starter: { rate: sv.affiliate_starter_rate || 30, min: 0 },
      growth:  { rate: sv.affiliate_growth_rate || 40, min: sv.affiliate_growth_threshold || 30 },
      pro:     { rate: sv.affiliate_pro_rate || 50, min: sv.affiliate_pro_threshold || 100 },
      leadSplit: sv.affiliate_lead_split || 40,
    };

    return Response.json({
      stats: {
        totalEarned: member.totalEarned / 100,
        totalPaid: member.totalPaid / 100,
        pending: heldTotal / 100,
        directEarned: earnings.directEarned / 100,
        teamEarned: earnings.teamEarned / 100,
        availableBalance: Math.max(0, availableBalance) / 100,
        clicks: clickCount,
        conversions: totalCommissions,
        activeReferrals: activeReferrals.length,
      },
      tier: { name: member.tier, rate: member.role === "chief" ? (sv.affiliate_pro_rate || 50) : member.commissionRate },
      tierConfig,
      recentCommissions: recent,
      links: links.map((l) => ({ slug: l.slug, enabled: l.enabled })),
    });
  } catch (e) {
    console.error("Dashboard API error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
