import prisma from "@/lib/prisma";
import { requireAdmin, logActivity, canSeeSensitive, maskEmail, maskAccountNo } from "@/lib/admin";
import { getMemberEarnings, raiseMoneyIssue } from "@/lib/commissions";
import { sendEmail, payoutCompletedEmail, payoutRejectedEmail } from "@/lib/email";
import { CLEARED_PAYOUT_BANK_FIELDS } from '@/lib/crew-account-deletion';

const UNSETTLED_PAYOUT_STATUSES = new Set(['pending', 'processing']);

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
      payouts: payouts.map((p) => {
        const mayShowBank = UNSETTLED_PAYOUT_STATUSES.has(p.status);
        const bankName = mayShowBank ? (p.bankName ?? p.member.bankName) : null;
        const bankAccountNo = mayShowBank ? (p.bankAccountNo ?? p.member.bankAccountNo) : null;
        const bankAccountName = mayShowBank ? (p.bankAccountName ?? p.member.bankAccountName) : null;
        return {
          id: p.id,
          memberId: p.memberId,
          memberName: p.member.name,
          memberEmail: sensitive ? p.member.email : maskEmail(p.member.email),
          bankName: sensitive ? bankName : null,
          bankAccountNo: sensitive ? bankAccountNo : maskAccountNo(bankAccountNo),
          bankAccountName: sensitive ? bankAccountName : null,
          amount: p.amount / 100,
          status: p.status,
          reference: p.reference,
          processedAt: p.processedAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        };
      }),
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
      include: { member: { select: { name: true, id: true, totalPaid: true, email: true, bankName: true, bankAccountNo: true, deletedAt: true } } },
    });
    if (!payout) return Response.json({ error: "Payout not found" }, { status: 404 });

    if (action === "process") {
      const affected = await prisma.$executeRaw`
        UPDATE affiliate_payouts
        SET status = 'processing'
        WHERE id = ${payoutId} AND status = 'pending'
      `;
      if (affected === 0) return Response.json({ error: "Payout is not pending" }, { status: 400 });
      await logActivity(admin.name, `Marked payout ${payoutId} as processing for Pit member ${payout.memberId}`, 'crew');
      return Response.json({ ok: true });
    }

    if (action === "complete") {
      const now = new Date();
      const ref = reference || null;
      const result = await prisma.$transaction(async (tx) => {
        const [lockedMember] = await tx.$queryRaw`
          SELECT id, "totalPaid", role, status, "deletedAt"
          FROM crew_members
          WHERE id = ${payout.memberId}
          FOR UPDATE
        `;
        if (!lockedMember) return { ok: false, reason: 'member' };

        // This settles an obligation requested before account deletion; it does
        // not create new earnings. Deleted members cannot request a new payout,
        // but admins must still be able to complete or reject an existing one.

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
          SET status = 'completed', reference = ${ref}, "processedAt" = ${now},
              "bankName" = NULL, "bankAccountNo" = NULL, "bankAccountName" = NULL
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
      await logActivity(admin.name, `Completed payout ${payoutId} for Pit member ${payout.memberId} (₦${(payout.amount / 100).toLocaleString()})`, 'crew');
      if (!payout.member.deletedAt && payout.member.email) {
        const amtN = payout.amount / 100;
        const bankName = payout.bankName || payout.member.bankName;
        const acctNo = payout.bankAccountNo || payout.member.bankAccountNo;
        const bankLabel = bankName ? `${bankName}${acctNo ? ` ····${String(acctNo).slice(-4)}` : ''}` : null;
        const dateStr = now.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short' }) + ' · ' + now.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: 'numeric', minute: '2-digit' });
        const payoutRef = ref || payoutId;
        sendEmail(payout.member.email, `Your payout of ₦${amtN.toLocaleString()} has been sent`,
          payoutCompletedEmail(payout.member.name || 'there', amtN, payoutRef, bankLabel, dateStr),
          `Your payout of ₦${amtN.toLocaleString()} has been sent to your bank. Reference: ${payoutRef}. Earnings: https://nitro.ng/pit`).catch(() => {});
      }
      return Response.json({ ok: true });
    }

    if (action === "reject") {
      const now = new Date();
      // Conditional UPDATE — only transitions from pending/processing. Idempotent.
      // Rejection does NOT touch totalEarned — the money was earned, payout was declined.
      const affected = await prisma.$executeRaw`
        UPDATE affiliate_payouts
        SET status = 'rejected', "processedAt" = ${now},
            "bankName" = ${CLEARED_PAYOUT_BANK_FIELDS.bankName},
            "bankAccountNo" = ${CLEARED_PAYOUT_BANK_FIELDS.bankAccountNo},
            "bankAccountName" = ${CLEARED_PAYOUT_BANK_FIELDS.bankAccountName}
        WHERE id = ${payoutId} AND status IN ('pending', 'processing')
      `;
      if (affected === 0) {
        return Response.json({ error: payout.status === "rejected" ? "Already rejected" : "Cannot reject a completed payout" }, { status: 400 });
      }
      await logActivity(admin.name, `Rejected payout ${payoutId} for Pit member ${payout.memberId}`, 'crew');
      if (!payout.member.deletedAt && payout.member.email) {
        const amtN = payout.amount / 100;
        sendEmail(payout.member.email, 'About your payout request',
          payoutRejectedEmail(payout.member.name || 'there', amtN, payout.reference || null),
          `We couldn't process your payout this time. The held ₦${amtN.toLocaleString()} is back in your commission balance. Earnings: https://nitro.ng/pit`).catch(() => {});
      }
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
