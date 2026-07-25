import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ['maintEnabled', 'maintMessage', 'maintETA'] } } });
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    if (s.maintEnabled === 'true') {
      return Response.json({ maintenance: true, message: s.maintMessage || '', eta: s.maintETA || '' });
    }
    return Response.json({ maintenance: false });
  } catch {
    return Response.json({ maintenance: false });
  }
}
