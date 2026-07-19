import prisma from "@/lib/prisma";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const SNAPSHOT_KEY = "cohort_stats_snapshot";
const STALE_MS = 25 * 60 * 60 * 1000; // 25 hours
const QUERY_TIMEOUT_MS = 30_000;

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

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

async function computeStats() {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SET LOCAL statement_timeout = '25s'`;
      const now = new Date();
      const windows = {};
      for (const days of [7, 30]) {
        const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const [row = {}] = await tx.$queryRaw`
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

        windows[`${days}d`] = { signups, depositors, depositRate, totalDepositedNGN, avgFirstDepositNGN, bySource };
      }
      return { generatedAt: now.toISOString(), windows };
    },
    { timeout: QUERY_TIMEOUT_MS },
  );
}

async function alertWatchTower(snapshot, cause) {
  const ageHours = +(snapshotAgeMs(snapshot) / 36e5).toFixed(1);
  const text = `🔴 <b>Cohort stats stale (${ageHours}h)</b>\nSnapshot: ${snapshot.generatedAt}\nCause: ${cause}`;
  const token = process.env.TG_BOT_TOKEN;
  const chat = process.env.TG_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, message_thread_id: 5, text, parse_mode: "HTML" }),
    });
  } catch {}
}

export async function GET(req) {
  const token =
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    new URL(req.url).searchParams.get("token");

  const isCron = token === process.env.CRON_SECRET;
  const isAnalytics = token === process.env.ANALYTICS_READ_TOKEN;

  if (!isCron && !isAnalytics) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: NO_CACHE });
  }

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
      return Response.json({ ok: true, generatedAt: stats.generatedAt }, { headers: NO_CACHE });
    } catch (err) {
      log.error("Cohort Stats", `Writer failed: ${err.message}`);
      return Response.json({ error: "Writer failed", detail: err.message }, { status: 500, headers: NO_CACHE });
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
  } catch (err) {
    log.error("Cohort Stats", `Snapshot read failed: ${err.message}`);
  }

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
        const ageH = +(snapshotAgeMs(snapshot) / 36e5).toFixed(1);
        log.error("Cohort Stats", `Serving stale snapshot (${ageH}h old) from ${snapshot.generatedAt} — self-heal failed`);
        await alertWatchTower(snapshot, err.message);
      } else {
        return Response.json({ error: "No data available" }, { status: 503, headers: NO_CACHE });
      }
    }
  }

  const pretty = new URL(req.url).searchParams.has("pretty");
  const body = pretty ? JSON.stringify(snapshot, null, 2) : JSON.stringify(snapshot);
  return new Response(body, {
    headers: { "Content-Type": "application/json", ...NO_CACHE },
  });
}
