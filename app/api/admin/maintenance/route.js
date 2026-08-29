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

    let history = []; try { history = JSON.parse(s.maintHistory || '[]'); } catch {}
    return Response.json({
      enabled: s.maintEnabled === 'true',
      message: s.maintMessage || '',
      estimatedReturn: s.maintETA || '~30 minutes',
      durationMinutes: Number(s.maintMinutes) || 60,
      since: s.maintEnabled === 'true' ? (s.maintSince || null) : null,
      history,
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
    const { enabled, message, estimatedReturn, showTwitter, durationMinutes } = await req.json();

    // When it went down, and a short history of past downtimes for the page.
    const prevRows = await prisma.setting.findMany({ where: { key: { in: ['maintEnabled', 'maintSince', 'maintMinutes', 'maintHistory'] } } });
    const prev = {}; prevRows.forEach(r => { prev[r.key] = r.value; });
    const wasOn = prev.maintEnabled === 'true';
    const now = new Date().toISOString();

    const ops = [
      prisma.setting.upsert({ where: { key: 'maintEnabled' }, update: { value: String(!!enabled) }, create: { key: 'maintEnabled', value: String(!!enabled) } }),
    ];
    if (message !== undefined) ops.push(prisma.setting.upsert({ where: { key: 'maintMessage' }, update: { value: message }, create: { key: 'maintMessage', value: message } }));
    if (estimatedReturn !== undefined) ops.push(prisma.setting.upsert({ where: { key: 'maintETA' }, update: { value: estimatedReturn }, create: { key: 'maintETA', value: estimatedReturn } }));
    if (showTwitter !== undefined) ops.push(prisma.setting.upsert({ where: { key: 'maintShowTwitter' }, update: { value: String(!!showTwitter) }, create: { key: 'maintShowTwitter', value: String(!!showTwitter) } }));

    if (durationMinutes !== undefined) ops.push(prisma.setting.upsert({ where: { key: 'maintMinutes' }, update: { value: String(Number(durationMinutes) || 60) }, create: { key: 'maintMinutes', value: String(Number(durationMinutes) || 60) } }));
    if (enabled && !wasOn) ops.push(prisma.setting.upsert({ where: { key: 'maintSince' }, update: { value: now }, create: { key: 'maintSince', value: now } }));
    if (!enabled && wasOn && prev.maintSince) {
      let history = []; try { history = JSON.parse(prev.maintHistory || '[]'); } catch {}
      history.unshift({ from: prev.maintSince, to: now, saidMinutes: Number(prev.maintMinutes) || null, by: admin.name });
      const value = JSON.stringify(history.slice(0, 12));
      ops.push(prisma.setting.upsert({ where: { key: 'maintHistory' }, update: { value }, create: { key: 'maintHistory', value } }));
    }

    await prisma.$transaction(ops);
    await logActivity(admin.name, enabled ? 'Enabled maintenance mode' : 'Disabled maintenance mode', 'maintenance');

    return Response.json({ success: true });
  } catch (err) {
    log.error('Admin Maintenance POST', err.message);
    return Response.json({ error: 'Failed to save' }, { status: 500 });
  }
}
