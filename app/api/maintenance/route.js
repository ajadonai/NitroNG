import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'maintEnabled' } });
    const enabled = setting?.value === 'true';
    return Response.json({ enabled });
  } catch {
    return Response.json({ enabled: false });
  }
}
