import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';

export async function GET() {
  const { admin, error } = await requireAdmin('maintenance');
  if (error) return error;

  try {
    const rows = await prisma.setting.findMany({
      where: { key: { startsWith: 'maint' } },
    });
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });

    return Response.json({
      enabled: s.maintEnabled === 'true',
      message: s.maintMessage || '',
      estimatedReturn: s.maintETA || '~30 minutes',
      showTwitter: s.maintShowTwitter !== 'false',
    });
  } catch (err) {
    log.error('Admin Maintenance', err.message);
    return Response.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('maintenance', true);
  if (error) return error;

  if (!canPerformAction(admin, 'maintenance.toggle')) {
    return Response.json({ error: 'Only owner/superadmin can toggle maintenance' }, { status: 403 });
  }

  try {
    const { enabled, message, estimatedReturn, showTwitter } = await req.json();

    const ops = [
      prisma.setting.upsert({ where: { key: 'maintEnabled' }, update: { value: String(!!enabled) }, create: { key: 'maintEnabled', value: String(!!enabled) } }),
    ];
    if (message !== undefined) ops.push(prisma.setting.upsert({ where: { key: 'maintMessage' }, update: { value: message }, create: { key: 'maintMessage', value: message } }));
    if (estimatedReturn !== undefined) ops.push(prisma.setting.upsert({ where: { key: 'maintETA' }, update: { value: estimatedReturn }, create: { key: 'maintETA', value: estimatedReturn } }));
    if (showTwitter !== undefined) ops.push(prisma.setting.upsert({ where: { key: 'maintShowTwitter' }, update: { value: String(!!showTwitter) }, create: { key: 'maintShowTwitter', value: String(!!showTwitter) } }));

    await prisma.$transaction(ops);
    await logActivity(admin.name, enabled ? 'Enabled maintenance mode' : 'Disabled maintenance mode', 'maintenance');

    return Response.json({ success: true });
  } catch (err) {
    log.error('Admin Maintenance POST', err.message);
    return Response.json({ error: 'Failed to save' }, { status: 500 });
  }
}
