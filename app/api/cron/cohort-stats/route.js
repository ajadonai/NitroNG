import prisma from "@/lib/prisma";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const SNAPSHOT_KEY = "cohort_stats_snapshot";
const STALE_MS = 25 * 60 * 60 * 1000; // 25 hours
const STALE_ALERT_MS = 26 * 60 * 60 * 1000; // 26 hours

function toNumber(value) {
  return typeof value === "bigint" ? Number(value) : Number(value || 0);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") return JSON.parse(value);
  return [];
}

function snapshotAgeMs(snapshot) {
  const generatedAt = new Date(snapshot?.generatedAt || 0).getTime();
  return Number.isFinite(generatedAt) ? Date.now() - generatedAt : Infinity;
}

async function computeWindow(days, now) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const [row = {}] = await prisma.$queryRaw`
    WITH cohort AS (
      SELECT id, COALESCE("signupSource", 'organic/direct') AS source
      FROM "users"
      WHERE "createdAt" >= ${since}
        AND "deletedAt" IS NULL
    ),
    deposits_by_user AS (
      SELECT t."userId", SUM(t.amount)::bigint AS "totalDepositedKobo"
      FROM "transactions" t
      JOIN cohort c ON c.id = t."userId"
      WHERE t.type = 'deposit'
        AND t.status = 'Completed'
      GROUP BY t."userId"
    ),
    source_stats AS (
      SELECT
        c.source,
        COUNT(*)::int AS signups,
        COUNT(d."userId")::int AS depositors
      FROM cohort c
      LEFT JOIN deposits_by_user d ON d."userId" = c.id
      GROUP BY c.source
    )
    SELECT
      (SELECT COUNT(*)::int FROM cohort) AS signups,
      (SELECT COUNT(*)::int FROM deposits_by_user) AS depositors,
      COALESCE((SELECT SUM("totalDepositedKobo") FROM deposits_by_user), 0)::bigint AS "totalDepositedKobo",
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'source', source,
            'signups', signups,
            'depositors', depositors
          )
          ORDER BY signups DESC, source ASC
        )
        FROM source_stats
      ), '[]'::json) AS "bySource"
  `;

  const signups = toNumber(row.signups);
  const depositors = toNumber(row.depositors);
  const totalDepositedKobo = toNumber(row.totalDepositedKobo);
  const totalDepositedNGN = totalDepositedKobo / 100;
  const depositRate = signups > 0 ? +(depositors / signups).toFixed(4) : 0;
  const avgFirstDepositNGN = depositors > 0 ? +(totalDepositedNGN / depositors).toFixed(2) : 0;
  const bySource = parseJsonArray(row.bySource).map((src) => {
    const srcSignups = toNumber(src.signups);
    const srcDepositors = toNumber(src.depositors);
    return {
      source: src.source || "organic/direct",
      signups: srcSignups,
      depositors: srcDepositors,
      depositRate: srcSignups > 0 ? +(srcDepositors / srcSignups).toFixed(4) : 0,
    };
  });

  return { signups, depositors, depositRate, totalDepositedNGN, avgFirstDepositNGN, bySource };
}

async function computeStats() {
  const now = new Date();
  const windows = {};

  for (const days of [7, 30]) {
    windows[`${days}d`] = await computeWindow(days, now);
  }

  return { generatedAt: now.toISOString(), windows };
}

async function upsertStaleSnapshotIssue(snapshot, cause) {
  const ageMs = snapshotAgeMs(snapshot);
  if (ageMs < STALE_ALERT_MS) return;

  const ageHours = +(ageMs / 36e5).toFixed(1);
  const title = `Cohort stats snapshot stale for ${ageHours}h`;
  const message = `Cohort-stats served a stale snapshot generated at ${snapshot.generatedAt}. Reader self-heal failed: ${cause}.`;
  const metadata = JSON.stringify({
    generatedAt: snapshot.generatedAt,
    ageHours,
    cause,
    checkedAt: new Date().toISOString(),
  });

  try {
    const existing = await prisma.adminIssue.findFirst({
      where: { type: "cohort_stats_stale", status: "open" },
    });
    if (existing) {
      await prisma.adminIssue.update({
        where: { id: existing.id },
        data: { title, message, metadata, createdAt: new Date() },
      });
    } else {
      await prisma.adminIssue.create({
        data: { type: "cohort_stats_stale", title, message, metadata },
      });
    }
  } catch (err) {
    log.warn("Cohort Stats", `Failed to create stale snapshot issue: ${err.message}`);
  }
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
        await upsertStaleSnapshotIssue(snapshot, err.message);
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
