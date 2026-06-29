import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

export async function GET() {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const crew = await prisma.crewMember.findMany({
      where: { leadId: member.id, status: "approved" },
      select: { id: true, name: true },
    });
    const crewIds = crew.map((m) => m.id);

    const links = await prisma.acquisitionLink.findMany({
      where: { archivedAt: null, affiliateId: { in: [member.id, ...crewIds] } },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { clicks: true, commissions: true } },
        affiliate: { select: { id: true, name: true } },
      },
    });

    return Response.json({
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
      team: crew.map((m) => ({ id: m.id, name: m.name })),
    });
  } catch (e) {
    console.error("Links GET error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { name, slug: customSlug, affiliateId } = await req.json().catch(() => ({}));
    if (!name || name.trim().length < 2) return Response.json({ error: "Name is required (min 2 characters)" }, { status: 400 });

    const slug = customSlug?.trim() ? slugify(customSlug) : slugify(name);
    if (!slug) return Response.json({ error: "Invalid slug" }, { status: 400 });

    const existing = await prisma.acquisitionLink.findUnique({ where: { slug } });
    if (existing) return Response.json({ error: "That slug is already taken" }, { status: 409 });

    if (affiliateId) {
      const affiliate = await prisma.crewMember.findUnique({ where: { id: affiliateId } });
      if (!affiliate || affiliate.status !== "approved") return Response.json({ error: "Invalid affiliate" }, { status: 400 });
    }

    const link = await prisma.acquisitionLink.create({
      data: { name: name.trim(), slug, affiliateId: affiliateId || member.id },
    });

    return Response.json({ link: { id: link.id, name: link.name, slug: link.slug, enabled: link.enabled, createdAt: link.createdAt.toISOString() } });
  } catch (e) {
    console.error("Links POST error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id, enabled, affiliateId } = await req.json().catch(() => ({}));
    if (!id) return Response.json({ error: "Link ID required" }, { status: 400 });

    const data = {};
    if (typeof enabled === "boolean") data.enabled = enabled;
    if (affiliateId !== undefined) {
      if (affiliateId) {
        const affiliate = await prisma.crewMember.findUnique({ where: { id: affiliateId } });
        if (!affiliate || affiliate.status !== "approved") return Response.json({ error: "Invalid affiliate" }, { status: 400 });
      }
      data.affiliateId = affiliateId || null;
    }

    if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

    await prisma.acquisitionLink.update({ where: { id }, data });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Links PATCH error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const member = await getCrewSession();
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await req.json().catch(() => ({}));
    if (!id) return Response.json({ error: "Link ID required" }, { status: 400 });

    await prisma.acquisitionLink.update({ where: { id }, data: { archivedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Links DELETE error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
