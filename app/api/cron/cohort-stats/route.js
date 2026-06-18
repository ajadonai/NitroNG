import prisma from "@/lib/prisma";

export async function GET(req) {
  if (!process.env.ANALYTICS_READ_TOKEN)
    return Response.json({ error: "Not configured" }, { status: 503 });

  const token =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("token");
  if (token !== process.env.ANALYTICS_READ_TOKEN)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const windows = {};

  for (const days of [7, 30]) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cohortWhere = { createdAt: { gte: since }, deletedAt: null };

    const signups = await prisma.user.count({ where: cohortWhere });

    const depositorsAgg = await prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        type: "deposit",
        status: "Completed",
        user: cohortWhere,
      },
    });
    const depositors = depositorsAgg.length;

    const sumResult = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: "deposit",
        status: "Completed",
        user: cohortWhere,
      },
    });
    const totalDepositedKobo = sumResult._sum.amount || 0;
    const totalDepositedNGN = totalDepositedKobo / 100;

    const depositRate = signups > 0 ? +(depositors / signups).toFixed(4) : 0;
    const avgFirstDepositNGN =
      depositors > 0 ? +(totalDepositedNGN / depositors).toFixed(2) : 0;

    // By-source breakdown
    const signupsBySource = await prisma.user.groupBy({
      by: ["signupSource"],
      where: cohortWhere,
      _count: true,
    });

    const depositorsBySource = await prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        type: "deposit",
        status: "Completed",
        user: cohortWhere,
      },
      _count: true,
    });
    const depositorUserIds = new Set(depositorsBySource.map((r) => r.userId));

    const cohortUsers = await prisma.user.findMany({
      where: { ...cohortWhere, id: { in: [...depositorUserIds] } },
      select: { id: true, signupSource: true },
    });
    const depositorSourceMap = {};
    for (const u of cohortUsers) {
      const src = u.signupSource || "organic/direct";
      depositorSourceMap[src] = (depositorSourceMap[src] || 0) + 1;
    }

    const bySource = signupsBySource.map((row) => {
      const src = row.signupSource || "organic/direct";
      const srcSignups = row._count;
      const srcDepositors = depositorSourceMap[src] || 0;
      return {
        source: src,
        signups: srcSignups,
        depositors: srcDepositors,
        depositRate: srcSignups > 0 ? +(srcDepositors / srcSignups).toFixed(4) : 0,
      };
    });

    windows[`${days}d`] = {
      signups,
      depositors,
      depositRate,
      totalDepositedNGN,
      avgFirstDepositNGN,
      bySource,
    };
  }

  return Response.json({ generatedAt: now.toISOString(), windows });
}
