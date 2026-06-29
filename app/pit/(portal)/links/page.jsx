import { redirect } from "next/navigation";
import { getCrewSession } from "@/lib/crew";
import prisma from "@/lib/prisma";
import LinksPage from "@/components/m/links-page";

async function getInitialLinks(chiefId) {
  const crewIds = (await prisma.crewMember.findMany({
    where: { leadId: chiefId, status: "approved" },
    select: { id: true },
  })).map((m) => m.id);

  const links = await prisma.acquisitionLink.findMany({
    where: { archivedAt: null, affiliateId: { in: [chiefId, ...crewIds] } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { clicks: true, commissions: true } },
      affiliate: { select: { id: true, name: true } },
    },
  });

  return {
    links: links.map((l) => ({
      id: l.id,
      name: l.name,
      slug: l.slug,
      enabled: l.enabled,
      affiliateId: l.affiliateId,
      affiliateName: l.affiliate?.name || null,
      clicks: l._count.clicks,
      commissions: l._count.commissions,
      createdAt: l.createdAt.toISOString(),
    })),
  };
}

export default async function Links() {
  const member = await getCrewSession();
  if (member.role !== "chief") redirect("/pit");
  const initialData = await getInitialLinks(member.id);
  return <LinksPage initialData={initialData} />;
}
