import prisma from '@/lib/prisma';

export async function GET() {
  const checks = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  // Database check. One quick retry: a refused first connect on a cold instance
  // (Neon compute waking, pooler cycling during a rollout) is instant and
  // transient, and paging on it tells nobody anything. A real outage fails both.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'ok';
      break;
    } catch (err) {
      if (attempt === 0) { await new Promise(r => setTimeout(r, 300)); continue; }
      checks.services.database = 'error';
      checks.status = 'degraded';
      // The reason used to be swallowed here, which made a 503 wave undiagnosable
      // from the outside. Surface it in the body and the function log.
      checks.services.databaseError = String(err?.message || err).slice(0, 200);
      console.error('[Health] database check failed:', String(err?.message || err).slice(0, 300));
    }
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return Response.json(checks, { status: statusCode });
}
