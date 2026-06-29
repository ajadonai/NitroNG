import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";

const MIN_PAYOUT = 500000; // ₦5,000 in kobo

export async function GET() {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [payouts, pendingPayouts, approvedSum] = await Promise.all([
      prisma.affiliatePayout.findMany({
        where: { memberId: member.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.affiliatePayout.aggregate({
        where: { memberId: member.id, status: { in: ["pending", "processing"] } },
        _sum: { amount: true },
      }),
      prisma.affiliateCommission.aggregate({
        where: {
          ...(member.role === "chief"
            ? { leadId: member.id }
            : { memberId: member.id }),
          status: "approved",
        },
        _sum: { [member.role === "chief" ? "leadAmount" : "marketerAmount"]: true },
      }),
    ]);

    const amountField = member.role === "chief" ? "leadAmount" : "marketerAmount";
    const approved = approvedSum._sum[amountField] || 0;
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
      minPayout: MIN_PAYOUT / 100,
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

    if (amountKobo < MIN_PAYOUT) {
      return Response.json({ error: `Minimum payout is ₦${(MIN_PAYOUT / 100).toLocaleString()}` }, { status: 400 });
    }

    if (!member.bankName || !member.bankAccountNo || !member.bankAccountName) {
      return Response.json({ error: "Add your bank details in Settings before requesting a payout" }, { status: 400 });
    }

    // Check available balance
    const amountField = member.role === "chief" ? "leadAmount" : "marketerAmount";
    const [approvedSum, pendingPayouts] = await Promise.all([
      prisma.affiliateCommission.aggregate({
        where: {
          ...(member.role === "chief" ? { leadId: member.id } : { memberId: member.id }),
          status: "approved",
        },
        _sum: { [amountField]: true },
      }),
      prisma.affiliatePayout.aggregate({
        where: { memberId: member.id, status: { in: ["pending", "processing"] } },
        _sum: { amount: true },
      }),
    ]);

    const approved = approvedSum._sum[amountField] || 0;
    const pendingAmount = pendingPayouts._sum.amount || 0;
    const available = approved - member.totalPaid - pendingAmount;

    if (amountKobo > available) {
      return Response.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const payout = await prisma.affiliatePayout.create({
      data: { memberId: member.id, amount: amountKobo },
    });

    return Response.json({
      payout: { id: payout.id, amount: payout.amount / 100, status: payout.status, createdAt: payout.createdAt },
    });
  } catch (e) {
    console.error("Payouts POST error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
