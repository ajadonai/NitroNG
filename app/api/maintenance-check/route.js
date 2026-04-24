import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'maintEnabled' } });
    if (row?.value === 'true') {
      const msgRow = await prisma.setting.findUnique({ where: { key: 'maintMessage' } });
      const etaRow = await prisma.setting.findUnique({ where: { key: 'maintETA' } });
      return Response.json({ maintenance: true, message: msgRow?.value || '', eta: etaRow?.value || '' });
    }
    return Response.json({ maintenance: false });
  } catch {
    return Response.json({ maintenance: false });
  }
}
