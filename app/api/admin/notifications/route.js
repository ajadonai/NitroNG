import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity, canPerformAction } from '@/lib/admin';
import { sendEmail } from '@/lib/email';

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
    const history = await getHistory();
    return Response.json({ history });
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
    const { subject, message, target } = await req.json();
    if (!message?.trim()) return Response.json({ error: 'Message required' }, { status: 400 });

    const subj = subject?.trim() || 'Notification from Nitro';
    const msg = message.trim();

    // Get target users
    let whereClause = { status: 'Active' };
    if (target === 'new') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      whereClause.createdAt = { gte: weekAgo };
    } else if (target === 'active') {
      whereClause.orders = { some: {} };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: { email: true, name: true },
    });

    if (users.length === 0) {
      return Response.json({ error: 'No users match the target' }, { status: 400 });
    }

    // Build email HTML
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #c47d8e, #8b5e6b); display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff;">N</div>
        </div>
        <h1 style="font-size: 20px; font-weight: 600; color: #1a1a1a; text-align: center; margin-bottom: 16px;">${subj}</h1>
        <div style="font-size: 15px; color: #444; line-height: 1.7; white-space: pre-wrap;">${msg}</div>
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
          <p style="font-size: 12px; color: #bbb;">Nitro — Premium SMM Services</p>
        </div>
      </div>
    `;

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
