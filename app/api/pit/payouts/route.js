import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";
import { getMemberEarnings } from "@/lib/commissions";

const DEFAULT_MIN_PAYOUT = 500000;

async function getMinPayout() {
  const row = await prisma.setting.findUnique({ where: { key: 'affiliate_min_payout' } });
  return row ? parseInt(row.value) * 100 : DEFAULT_MIN_PAYOUT;
}

export async function GET() {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [payouts, pendingPayouts, earnings, minPayout] = await Promise.all([
      prisma.affiliatePayout.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.affiliatePayout.aggregate({
        where: { memberId: member.id, status: { in: ["pending", "processing"] } },
        _sum: { amount: true },
      }),
      getMemberEarnings(member.id, member.role),
      getMinPayout(),
    ]);

    const approved = earnings.totalApproved;
    const pendingAmount = pendingPayouts._sum.amount || 0;
    const available = approved - member.totalPaid - pendingAmount;

    const hasBankDetails = !!(member.bankName && member.bankAccountNo && member.bankAccountName);

    return Response.json({
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount / 100,
        status: p.status,
        reference: p.reference,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
      })),
      availableBalance: Math.max(0, available) / 100,
      minPayout: minPayout / 100,
      hasBankDetails,
      bankName: member.bankName || null,
      bankAccountNo: member.bankAccountNo || null,
      bankAccountName: member.bankAccountName || null,
    });
  } catch (e) {
    console.error("Payouts GET error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { amount } = await req.json().catch(() => ({}));
    if (!amount || amount <= 0) return Response.json({ error: "Invalid amount" }, { status: 400 });

    const amountKobo = Math.round(amount * 100);

    const minPayout = await getMinPayout();
    if (amountKobo < minPayout) {
      return Response.json({ error: `Minimum payout is ₦${(minPayout / 100).toLocaleString()}` }, { status: 400 });
    }

    if (!member.bankName || !member.bankAccountNo || !member.bankAccountName) {
      return Response.json({ error: "Add your bank details in Settings before requesting a payout" }, { status: 400 });
    }

    // Lock the member row to serialize concurrent payout requests, then
    // read totalPaid from that locked row (not the stale session snapshot).
    const MAX_RETRIES = 3;
    let payout;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        payout = await prisma.$transaction(async (tx) => {
          // FOR UPDATE on the member row serializes concurrent payout requests
          const [lockedMember] = await tx.$queryRaw`
            SELECT id, "totalPaid", role FROM crew_members WHERE id = ${member.id} FOR UPDATE
          `;
          if (!lockedMember) throw new Error("Member not found");

          const [earnings, pendingPayouts] = await Promise.all([
            getMemberEarnings(member.id, lockedMember.role, tx),
            tx.affiliatePayout.aggregate({
              where: { memberId: member.id, status: { in: ["pending", "processing"] } },
              _sum: { amount: true },
            }),
          ]);

          const approved = earnings.totalApproved;
          const pendingAmount = pendingPayouts._sum.amount || 0;
          const available = approved - lockedMember.totalPaid - pendingAmount;

          if (amountKobo > available) {
            throw new Error("Insufficient balance");
          }

          return tx.affiliatePayout.create({
            data: {
              memberId: member.id,
              amount: amountKobo,
              bankName: member.bankName,
              bankAccountNo: member.bankAccountNo,
              bankAccountName: member.bankAccountName,
            },
          });
        }, { isolationLevel: 'Serializable' });
        break;
      } catch (e) {
        if (e.message === "Insufficient balance") throw e;
        // Serializable isolation can throw serialization errors — retry
        if (e.code === 'P2034' && attempt < MAX_RETRIES - 1) continue;
        throw e;
      }
    }

    return Response.json({
      payout: { id: payout.id, amount: payout.amount / 100, status: payout.status, createdAt: payout.createdAt },
    });
  } catch (e) {
    if (e.message === "Insufficient balance") {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }
    console.error("Payouts POST error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
