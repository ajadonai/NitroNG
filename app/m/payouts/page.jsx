import { redirect } from "next/navigation";
import { getCrewSession, memberToClient } from "@/lib/crew";
import prisma from "@/lib/prisma";
import PayoutsPage from "@/components/m/payouts-page";

const MIN_PAYOUT = 500000;

async function getInitialPayouts(member) {
  const id = member.id;
  const isChief = member.role === "chief";
  const amountField = isChief ? "leadAmount" : "marketerAmount";

  const [payouts, pendingPayouts, approvedSum] = await Promise.all([
    prisma.affiliatePayout.findMany({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.affiliatePayout.aggregate({
      where: { memberId: id, status: { in: ["pending", "processing"] } },
      _sum: { amount: true },
    }),
    prisma.affiliateCommission.aggregate({
      where: { ...(isChief ? { leadId: id } : { memberId: id }), status: "approved" },
      _sum: { [amountField]: true },
    }),
  ]);

  const approved = approvedSum._sum[amountField] || 0;
  const pendingAmount = pendingPayouts._sum.amount || 0;
  const available = approved - member.totalPaid - pendingAmount;

  return {
    payouts: payouts.map((p) => ({
      id: p.id, amount: p.amount / 100, status: p.status,
      reference: p.reference, processedAt: p.processedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    availableBalance: Math.max(0, available) / 100,
    minPayout: MIN_PAYOUT / 100,
    hasBankDetails: !!(member.bankName && member.bankAccountNo && member.bankAccountName),
  };
}

export default async function Payouts() {
  const member = await getCrewSession();
  if (!member) redirect("/m/login");
  const initialData = await getInitialPayouts(member);
  return <PayoutsPage member={memberToClient(member)} initialData={initialData} />;
}
