import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
}

function logAction(linkId, actorId, action, detail) {
  return prisma.linkLog.create({ data: { linkId, actorId, action, detail } });
}

async function getTeamIds(chiefId) {
  const crew = await prisma.crewMember.findMany({
    where: { leadId: chiefId, status: "approved" },
    select: { id: true },
  });
  return new Set([chiefId, ...crew.map(m => m.id)]);
}

async function verifyLinkOwnership(linkId, chiefId) {
  const link = await prisma.acquisitionLink.findUnique({
    where: { id: linkId },
    select: { id: true, affiliateId: true },
  });
  if (!link) return null;
  const teamIds = await getTeamIds(chiefId);
  if (!teamIds.has(link.affiliateId)) return null;
  return link;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const checkSlug = searchParams.get("check");
  if (checkSlug) {
    const exists = await prisma.acquisitionLink.findUnique({ where: { slug: checkSlug } });
    return Response.json({ available: !exists });
  }
  const logsFor = searchParams.get("logs");
  if (logsFor) {
    const member = await getCrewSession().catch(() => null);
    if (!member || member.role !== "chief") return Response.json({ error: "Unauthorized" }, { status: 401 });
    const owned = await verifyLinkOwnership(logsFor, member.id);
    if (!owned) return Response.json({ error: "Link not found" }, { status: 404 });
    const logs = await prisma.linkLog.findMany({
      where: { linkId: logsFor },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { id: true, name: true } } },
    });
    return Response.json({ logs: logs.map(l => ({ id: l.id, action: l.action, detail: l.detail, actorName: l.actor.name, createdAt: l.createdAt.toISOString() })) });
  }
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

    const [maxLinksRow, activeCount] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'affiliate_max_links_chief' } }),
      prisma.acquisitionLink.count({ where: { affiliateId: member.id, archivedAt: null } }),
    ]);
    const maxLinks = parseInt(maxLinksRow?.value) || 5;
    if (activeCount >= maxLinks) return Response.json({ error: `Maximum ${maxLinks} active links allowed` }, { status: 400 });

    const existing = await prisma.acquisitionLink.findUnique({ where: { slug } });
    if (existing) return Response.json({ error: "That slug is already taken" }, { status: 409 });

    let assigneeName = member.name;
    if (affiliateId && affiliateId !== member.id) {
      const teamIds = await getTeamIds(member.id);
      if (!teamIds.has(affiliateId)) return Response.json({ error: "Can only assign to your own team members" }, { status: 403 });
      const affiliate = await prisma.crewMember.findUnique({ where: { id: affiliateId }, select: { name: true, status: true } });
      if (!affiliate || affiliate.status !== "approved") return Response.json({ error: "Invalid affiliate" }, { status: 400 });
      assigneeName = affiliate.name;
    }

    const assigneeId = affiliateId || member.id;
    const link = await prisma.acquisitionLink.create({
      data: { name: name.trim(), slug, affiliateId: assigneeId },
    });

    logAction(link.id, member.id, "created", `Created and assigned to ${assigneeName}`).catch(() => {});

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

    const owned = await verifyLinkOwnership(id, member.id);
    if (!owned) return Response.json({ error: "Link not found" }, { status: 404 });

    const data = {};
    if (typeof enabled === "boolean") data.enabled = enabled;
    if (affiliateId !== undefined) {
      if (affiliateId) {
        const teamIds = await getTeamIds(member.id);
        if (!teamIds.has(affiliateId)) return Response.json({ error: "Can only assign to your own team members" }, { status: 403 });
        const affiliate = await prisma.crewMember.findUnique({ where: { id: affiliateId }, select: { status: true } });
        if (!affiliate || affiliate.status !== "approved") return Response.json({ error: "Invalid affiliate" }, { status: 400 });
      }
      data.affiliateId = affiliateId || null;
    }

    if (Object.keys(data).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

    const prev = await prisma.acquisitionLink.findUnique({ where: { id }, include: { affiliate: { select: { name: true } } } });
    await prisma.acquisitionLink.update({ where: { id }, data });

    if (typeof enabled === "boolean") {
      logAction(id, member.id, enabled ? "resumed" : "paused", `Link ${enabled ? "resumed" : "paused"}`).catch(() => {});
    }
    if (affiliateId !== undefined) {
      prisma.crewMember.findUnique({ where: { id: affiliateId }, select: { name: true } }).then(m => {
        const newName = m?.name || member.name;
        logAction(id, member.id, "reassigned", `Reassigned from ${prev?.affiliate?.name || "unknown"} to ${newName}`).catch(() => {});
      }).catch(() => {});
    }

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

    const owned = await verifyLinkOwnership(id, member.id);
    if (!owned) return Response.json({ error: "Link not found" }, { status: 404 });

    await prisma.acquisitionLink.update({ where: { id }, data: { archivedAt: new Date() } });
    logAction(id, member.id, "deleted", "Link archived").catch(() => {});
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Links DELETE error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
