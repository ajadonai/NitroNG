import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import prisma from "@/lib/prisma";
import CommissionsPage from "@/components/m/commissions-page";

async function getInitialCommissions(member) {
  const id = member.id;
  const isChief = member.role === "chief";
  const where = isChief ? { OR: [{ memberId: id }, { leadId: id }] } : { memberId: id };
  const perPage = 20;

  const [commissions, total] = await Promise.all([
    prisma.affiliateCommission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: perPage,
      include: {
        order: { select: { orderId: true, charge: true } },
        link: { select: { slug: true } },
        ...(isChief ? { member: { select: { name: true } } } : {}),
      },
    }),
    prisma.affiliateCommission.count({ where }),
  ]);

  return {
    commissions: commissions.map((c) => {
      const isDirect = c.memberId === id;
      return {
        id: c.id, orderId: c.order.orderId, orderCharge: c.orderCharge / 100,
        rate: c.commissionRate, amount: isDirect ? c.marketerAmount / 100 : c.leadAmount / 100,
        status: c.status, type: isDirect ? "direct" : "team", slug: c.link.slug,
        ...(isChief && !isDirect ? { memberName: c.member.name } : {}),
        releasesAt: c.releasesAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      };
    }),
    total,
    page: 1,
    pages: Math.ceil(total / perPage),
  };
}

export default async function Commissions() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  const initialData = await getInitialCommissions(member);
  return <CommissionsPage member={memberToClient(member)} initialData={initialData} />;
}
