import prisma from "@/lib/prisma";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail, maskAccountNo } from "@/lib/admin";
import { getMemberEarnings, raiseMoneyIssue } from "@/lib/commissions";

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
        bankName: sensitive ? (p.bankName || p.member.bankName) : null,
        bankAccountNo: sensitive ? (p.bankAccountNo || p.member.bankAccountNo) : maskAccountNo(p.bankAccountNo || p.member.bankAccountNo),
        bankAccountName: sensitive ? (p.bankAccountName || p.member.bankAccountName) : null,
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

  let action, payoutId, payout;
  try {
    let reference;
    ({ action, payoutId, reference } = await req.json());
    payout = await prisma.affiliatePayout.findUnique({
      where: { id: payoutId },
      include: { member: { select: { name: true, id: true, totalPaid: true } } },
    });
    if (!payout) return Response.json({ error: "Payout not found" }, { status: 404 });

    if (action === "process") {
      const affected = await prisma.$executeRaw`
        UPDATE affiliate_payouts SET status = 'processing'
        WHERE id = ${payoutId} AND status = 'pending'
      `;
      if (affected === 0) return Response.json({ error: "Payout is not pending" }, { status: 400 });
      await logActivity(admin.name, `Marked payout ${payoutId} as processing for ${payout.member.name}`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "complete") {
      const now = new Date();
      const ref = reference || null;
      const result = await prisma.$transaction(async (tx) => {
        const [lockedMember] = await tx.$queryRaw`
          SELECT id, "totalPaid", role FROM crew_members WHERE id = ${payout.memberId} FOR UPDATE
        `;
        if (!lockedMember) return { ok: false, reason: 'member' };

        const [earnings, otherPending] = await Promise.all([
          getMemberEarnings(payout.memberId, lockedMember.role, tx),
          tx.affiliatePayout.aggregate({
            where: { memberId: payout.memberId, status: { in: ['pending', 'processing'] }, id: { not: payoutId } },
            _sum: { amount: true },
          }),
        ]);

        const available = earnings.totalApproved - lockedMember.totalPaid - (otherPending._sum.amount || 0);
        if (payout.amount > available) return { ok: false, reason: 'insufficient' };

        const affected = await tx.$executeRaw`
          UPDATE affiliate_payouts
          SET status = 'completed', reference = ${ref}, "processedAt" = ${now}
          WHERE id = ${payoutId} AND status IN ('pending', 'processing')
        `;
        if (affected === 0) return { ok: false, reason: 'status' };
        await tx.$executeRaw`
          UPDATE crew_members SET "totalPaid" = "totalPaid" + ${payout.amount}
          WHERE id = ${payout.memberId}
        `;
        return { ok: true };
      });
      if (!result.ok) {
        if (result.reason === 'insufficient') return Response.json({ error: "Insufficient approved earnings — commissions may have been voided" }, { status: 400 });
        return Response.json({ error: payout.status === "completed" ? "Already completed" : "Cannot complete a rejected payout" }, { status: 400 });
      }
      await logActivity(admin.name, `Completed payout ${payoutId} for ${payout.member.name} (₦${(payout.amount / 100).toLocaleString()})`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "reject") {
      const now = new Date();
      // Conditional UPDATE — only transitions from pending/processing. Idempotent.
      // Rejection does NOT touch totalEarned — the money was earned, payout was declined.
      const affected = await prisma.$executeRaw`
        UPDATE affiliate_payouts SET status = 'rejected', "processedAt" = ${now}
        WHERE id = ${payoutId} AND status IN ('pending', 'processing')
      `;
      if (affected === 0) {
        return Response.json({ error: payout.status === "rejected" ? "Already rejected" : "Cannot reject a completed payout" }, { status: 400 });
      }
      await logActivity(admin.name, `Rejected payout ${payoutId} for ${payout.member.name}`, 'crew');
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Admin crew payouts POST error:", e);
    raiseMoneyIssue('payout_failed', {
      payoutId, action, memberId: payout?.memberId, amount: payout?.amount, error: e.message,
    }).catch(() => {});
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
