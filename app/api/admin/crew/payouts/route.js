import prisma from "@/lib/prisma";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail } from "@/lib/admin";

export async function GET() {
  const { admin, error } = await requireAdmin("crew");
  if (error) return error;

  try {
    const payouts = await prisma.affiliatePayout.findMany({
      orderBy: { createdAt: "desc" },
      include: { member: { select: { name: true, email: true, bankName: true, bankAccountNo: true, bankAccountName: true } } },
    });

    const sensitive = canSeeSensitive(admin);

    return Response.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        memberId: p.memberId,
        memberName: p.member.name,
        memberEmail: sensitive ? p.member.email : maskEmail(p.member.email),
        bankName: p.member.bankName,
        bankAccountNo: p.member.bankAccountNo,
        bankAccountName: p.member.bankAccountName,
        amount: p.amount / 100,
        status: p.status,
        reference: p.reference,
        processedAt: p.processedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("Admin crew payouts GET error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin("crew", true);
  if (error) return error;

  try {
    const { action, payoutId, reference } = await req.json();
    const payout = await prisma.affiliatePayout.findUnique({
      where: { id: payoutId },
      include: { member: { select: { name: true, id: true, totalPaid: true } } },
    });
    if (!payout) return Response.json({ error: "Payout not found" }, { status: 404 });

    if (action === "process") {
      if (payout.status !== "pending") return Response.json({ error: "Payout is not pending" }, { status: 400 });
      await prisma.affiliatePayout.update({ where: { id: payoutId }, data: { status: "processing" } });
      await logActivity(admin.name, `Marked payout ${payoutId} as processing for ${payout.member.name}`);
      return Response.json({ ok: true });
    }

    if (action === "complete") {
      if (payout.status !== "pending" && payout.status !== "processing") return Response.json({ error: "Payout must be pending or processing" }, { status: 400 });
      await prisma.$transaction([
        prisma.affiliatePayout.update({ where: { id: payoutId }, data: { status: "completed", reference: reference || null, processedAt: new Date() } }),
        prisma.crewMember.update({ where: { id: payout.memberId }, data: { totalPaid: { increment: payout.amount } } }),
      ]);
      await logActivity(admin.name, `Completed payout ${payoutId} for ${payout.member.name} (${(payout.amount / 100).toLocaleString()})`);
      return Response.json({ ok: true });
    }

    if (action === "reject") {
      if (payout.status === "completed") return Response.json({ error: "Cannot reject a completed payout" }, { status: 400 });
      await prisma.$transaction([
        prisma.affiliatePayout.update({ where: { id: payoutId }, data: { status: "rejected", processedAt: new Date() } }),
        prisma.crewMember.update({ where: { id: payout.memberId }, data: { totalEarned: { decrement: payout.amount } } }),
      ]);
      await logActivity(admin.name, `Rejected payout ${payoutId} for ${payout.member.name}`);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Admin crew payouts POST error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
