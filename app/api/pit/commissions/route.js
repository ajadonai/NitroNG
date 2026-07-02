import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";

export async function GET(req) {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = 20;

    const id = member.id;
    const isChief = member.role === "chief";

    const where = {
      ...(isChief ? { OR: [{ memberId: id }, { leadId: id }] } : { memberId: id }),
      ...(status !== "all" ? { status } : {}),
    };

    const [commissions, total] = await Promise.all([
      prisma.affiliateCommission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          order: { select: { orderId: true, charge: true } },
          link: { select: { slug: true } },
          ...(isChief ? { member: { select: { name: true } } } : {}),
        },
      }),
      prisma.affiliateCommission.count({ where }),
    ]);

    const items = commissions.map((c) => {
      const isDirect = c.memberId === id;
      return {
        id: c.id,
        orderId: c.order.orderId,
        orderCharge: c.orderCharge / 100,
        rate: c.commissionRate,
        amount: isDirect ? c.marketerAmount / 100 : c.leadAmount / 100,
        status: c.status,
        type: isDirect ? "direct" : "team",
        slug: c.link.slug,
        ...(isChief && !isDirect ? { memberName: c.member.name } : {}),
        releasesAt: c.releasesAt,
        createdAt: c.createdAt,
      };
    });

    return Response.json({
      commissions: items,
      total,
      page,
      pages: Math.ceil(total / perPage),
    });
  } catch (e) {
    console.error("Commissions API error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
