import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';
import { sendEmail, emailWrap } from '@/lib/email';
import { escapeHtml } from '@/lib/validate';

async function getHistory() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'notification_history' } });
    return row ? JSON.parse(row.value) : [];
  } catch { return []; }
}

async function saveHistory(history) {
  await prisma.setting.upsert({
    where: { key: 'notification_history' },
    update: { value: JSON.stringify(history.slice(0, 100)) },
    create: { key: 'notification_history', value: JSON.stringify(history.slice(0, 100)) },
  });
}

export async function GET() {
  const { admin, error } = await requireAdmin('notifications');
  if (error) return error;

  try {
    const [history, promoCount, totalCount] = await Promise.all([
      getHistory(),
      prisma.user.count({ where: { status: 'Active', notifEmail: true, notifPromo: true } }),
      prisma.user.count({ where: { status: 'Active' } }),
    ]);
    return Response.json({ history, promoCount, totalCount });
  } catch (err) {
    log.error('Admin Notifications', err.message);
    return Response.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('notifications', true);
  if (error) return error;
  if (!canPerformAction(admin, 'notifications.send')) return Response.json({ error: 'Not authorized to send notifications' }, { status: 403 });

  try {
    const { subject, message, target, clearHistory } = await req.json();

    if (clearHistory) {
      await saveHistory([]);
      return Response.json({ success: true });
    }

    if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 });

    const subj = subject?.trim().slice(0, 200) || 'Notification from Nitro';
    const msg = message.trim().slice(0, 5000);

    // Get target users
    let whereClause = { status: 'Active' };
    if (target === 'new') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      whereClause.createdAt = { gte: weekAgo };
    } else if (target === 'active') {
      whereClause.orders = { some: {} };
    }

    const users = await prisma.user.findMany({
      where: { ...whereClause, notifEmail: true, notifPromo: true },
      select: { email: true, name: true },
    });

    if (users.length === 0) {
      return Response.json({ error: 'No users match the target' }, { status: 400 });
    }

    // Build email HTML using branded wrapper
    const html = await emailWrap({
      label: 'Announcement',
      labelBg: 'rgba(196,125,142,.12)',
      labelColor: '#c47d8e',
      title: subj,
      body: `<p style="font-size:15px;color:#444;line-height:1.7;white-space:pre-wrap;margin:0;">${escapeHtml(msg)}</p>`,
    });

    // Save to history immediately as "sending"
    const historyId = Date.now().toString();
    const history = await getHistory();
    history.unshift({
      id: historyId,
      subject: subj,
      message: msg,
      target: target || 'all',
      sentBy: admin.name,
      sentAt: new Date().toISOString(),
      status: 'sending',
      recipients: users.length,
      sent: 0,
      failed: 0,
    });
    await saveHistory(history);

    await logActivity(admin.name, `Queued notification "${subj}" to ${users.length} users`, 'notification');

    // Send emails in background — don't block the response
    const sendInBackground = async () => {
      let sent = 0;
      let failed = 0;
      const batchSize = 10;

      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(u => sendEmail(u.email, subj, html))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value?.success) sent++;
          else failed++;
        });
      }

      // Update history with final status
      const finalStatus = failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial';
      try {
        const h = await getHistory();
        const entry = h.find(e => e.id === historyId);
        if (entry) { entry.status = finalStatus; entry.sent = sent; entry.failed = failed; }
        await saveHistory(h);
      } catch {}
    };

    // Use globalThis.setTimeout as a fire-and-forget background task
    // On Vercel, the function stays alive briefly after response — enough for small batches
    // For large blasts, the history shows "sending" and updates once complete
    sendInBackground().catch(err => log.error('Email Blast Background', err.message));

    return Response.json({
      success: true,
      message: `Sending to ${users.length} users in background...`,
      status: 'sending',
    });
  } catch (err) {
    log.error('Admin Notifications POST', err.message);
    return Response.json({ error: 'Failed to send' }, { status: 500 });
  }
}
