import prisma from '@/lib/prisma';
import { requireAdmin, logActivity } from '@/lib/admin';

async function getHistory() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'notification_history' } });
    return row ? JSON.parse(row.value) : [];
  } catch { return []; }
}

export async function GET() {
  const { admin, error } = await requireAdmin('notifications');
  if (error) return error;

  try {
    const history = await getHistory();
    return Response.json({ history });
  } catch (err) {
    console.error('[Admin Notifications]', err.message);
    return Response.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('notifications', true);
  if (error) return error;

  try {
    const { subject, message, target } = await req.json();
    if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 });

    // Store in history (actual email sending is Phase 4 — needs email provider)
    const history = await getHistory();
    history.unshift({
      id: Date.now().toString(),
      subject: subject?.trim() || 'Notification',
      message: message.trim(),
      target: target || 'all',
      sentBy: admin.name,
      sentAt: new Date().toISOString(),
      status: 'queued', // Will be 'sent' when email provider is wired
    });

    // Keep last 100
    await prisma.setting.upsert({
      where: { key: 'notification_history' },
      update: { value: JSON.stringify(history.slice(0, 100)) },
      create: { key: 'notification_history', value: JSON.stringify(history.slice(0, 100)) },
    });

    await logActivity(admin.name, `Sent notification: "${subject?.trim() || message.trim().slice(0, 40)}"`, 'notification');
    return Response.json({ success: true, message: 'Notification queued' });
  } catch (err) {
    console.error('[Admin Notifications POST]', err.message);
    return Response.json({ error: 'Failed to send' }, { status: 500 });
  }
}
