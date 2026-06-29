import { redirect } from "next/navigation";
import { getCrewSession } from "@/lib/crew";
import prisma from "@/lib/prisma";
import LinksPage from "@/components/m/links-page";

async function getInitialLinks(chiefId) {
  const [crew, settings] = await Promise.all([
    prisma.crewMember.findMany({
      where: { leadId: chiefId, status: "approved" },
      select: { id: true, name: true, xHandle: true, telegramHandle: true },
    }),
    prisma.setting.findMany({
      where: { key: { in: ["affiliate_lead_split"] } },
    }),
  ]);
  const sv = Object.fromEntries(settings.map(s => [s.key, parseInt(s.value)]));
  const leadSplit = sv.affiliate_lead_split || 40;
  const crewIds = crew.map((m) => m.id);

  const links = await prisma.acquisitionLink.findMany({
    where: { archivedAt: null, OR: [{ affiliateId: { in: [chiefId, ...crewIds] } }, { affiliateId: null }] },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { clicks: true, commissions: true } },
      affiliate: { select: { id: true, name: true } },
    },
  });

  return {
    memberId: chiefId,
    leadSplit,
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
    team: crew.map((m) => ({ id: m.id, name: m.name, handle: m.xHandle || m.telegramHandle || null })),
  };
}

export default async function Links() {
  const member = await getCrewSession();
  if (member.role !== "chief") redirect("/pit");
  const initialData = await getInitialLinks(member.id);
  return <LinksPage initialData={initialData} />;
}
