import prisma from '@/lib/prisma';

export async function GET() {
  const checks = { status: 'ok', timestamp: new Date().toISOString(), services: {} };

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = 'ok';
  } catch {
    checks.services.database = 'error';
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  return Response.json(checks, { status: statusCode });
}
