import prisma from "@/lib/prisma";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const SNAPSHOT_KEY = "cohort_stats_snapshot";
const STALE_MS = 25 * 60 * 60 * 1000; // 25 hours

async function computeStats() {
  const now = new Date();
  const windows = {};

  for (const days of [7, 30]) {
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cohortWhere = { createdAt: { gte: since }, deletedAt: null };

    const signups = await prisma.user.count({ where: cohortWhere });

    const depositorsAgg = await prisma.transaction.groupBy({
      by: ["userId"],
      where: { type: "deposit", status: "Completed", user: cohortWhere },
    });
    const depositors = depositorsAgg.length;

    const sumResult = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "deposit", status: "Completed", user: cohortWhere },
    });
    const totalDepositedKobo = sumResult._sum.amount || 0;
    const totalDepositedNGN = totalDepositedKobo / 100;

    const depositRate = signups > 0 ? +(depositors / signups).toFixed(4) : 0;
    const avgFirstDepositNGN =
      depositors > 0 ? +(totalDepositedNGN / depositors).toFixed(2) : 0;

    const signupsBySource = await prisma.user.groupBy({
      by: ["signupSource"],
      where: cohortWhere,
      _count: true,
    });

    const depositorsBySource = await prisma.transaction.groupBy({
      by: ["userId"],
      where: { type: "deposit", status: "Completed", user: cohortWhere },
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
        depositRate:
          srcSignups > 0 ? +(srcDepositors / srcSignups).toFixed(4) : 0,
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

  return { generatedAt: now.toISOString(), windows };
}

export async function GET(req) {
  const token =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("token");

  const isCron = token === process.env.CRON_SECRET;
  const isAnalytics = token === process.env.ANALYTICS_READ_TOKEN;

  if (!isCron && !isAnalytics) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const noCache = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
  };

  // ── Cron writer path: compute, store, return ──
  if (isCron) {
    try {
      const stats = await computeStats();
      await prisma.setting.upsert({
        where: { key: SNAPSHOT_KEY },
        update: { value: JSON.stringify(stats) },
        create: { key: SNAPSHOT_KEY, value: JSON.stringify(stats) },
      });
      log.info("Cohort Stats", `Snapshot written — generatedAt ${stats.generatedAt}, 7d: ${stats.windows["7d"].signups} signups / ${stats.windows["7d"].depositors} depositors`);
      return Response.json({ ok: true, generatedAt: stats.generatedAt }, { headers: noCache });
    } catch (err) {
      log.error("Cohort Stats", `Writer failed: ${err.message}`);
      return Response.json({ error: "Writer failed", detail: err.message }, { status: 500, headers: noCache });
    }
  }

  // ── Analytics reader path: serve stored snapshot, recompute if stale ──
  let snapshot = null;
  let stale = false;

  try {
    const row = await prisma.setting.findUnique({ where: { key: SNAPSHOT_KEY } });
    if (row) {
      snapshot = JSON.parse(row.value);
      const age = Date.now() - new Date(snapshot.generatedAt).getTime();
      stale = age > STALE_MS;
    }
  } catch {}

  if (!snapshot || stale) {
    if (stale) {
      log.warn("Cohort Stats", `Stale snapshot detected (generatedAt: ${snapshot.generatedAt}). Recomputing live.`);
    }
    try {
      const fresh = await computeStats();
      await prisma.setting.upsert({
        where: { key: SNAPSHOT_KEY },
        update: { value: JSON.stringify(fresh) },
        create: { key: SNAPSHOT_KEY, value: JSON.stringify(fresh) },
      });
      if (stale) {
        log.warn("Cohort Stats", `Self-healed stale snapshot. Old: ${snapshot.generatedAt}, New: ${fresh.generatedAt}`);
      }
      snapshot = fresh;
    } catch (err) {
      log.error("Cohort Stats", `Live recompute failed: ${err.message}`);
      if (snapshot) {
        log.warn("Cohort Stats", `Serving stale snapshot from ${snapshot.generatedAt} as fallback`);
      } else {
        return Response.json({ error: "No data available" }, { status: 503, headers: noCache });
      }
    }
  }

  const pretty = new URL(req.url).searchParams.has("pretty");
  const body = pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot);
  return new Response(body, {
    headers: { "Content-Type": "application/json", ...noCache },
  });
}
