import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getBalance } from '@/lib/smm';
import { sendEmail, emailWrap } from '@/lib/email';

export async function GET(req) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { cleanup: {}, balance: {} };

  // ═══ CLEANUP: stale users + permanent deletions ═══
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const stale = await prisma.user.findMany({
      where: { createdAt: { lt: cutoff }, balance: 0 },
      select: { id: true, email: true, createdAt: true, _count: { select: { orders: true } } },
    });

    const toDelete = stale.filter(u => u._count.orders === 0);

    if (toDelete.length > 0) {
      const ids = toDelete.map(u => u.id);
      await prisma.$transaction([
        prisma.transaction.deleteMany({ where: { userId: { in: ids } } }),
        prisma.session.deleteMany({ where: { userId: { in: ids } } }),
        prisma.user.deleteMany({ where: { id: { in: ids } } }),
      ]);
      log.info('Cleanup', `Deleted ${toDelete.length} stale users`);
    }

    results.cleanup.deleted = toDelete.length;

    // Permanent deletion for users past 30-day window
    const pendingUsers = await prisma.user.findMany({
      where: { status: 'PendingDeletion', deletedAt: { lt: new Date() } },
      select: { id: true, email: true, deletedEmail: true, deletedName: true },
    });

    let permDeleted = 0;
    for (const pu of pendingUsers) {
      try {
        const uid = pu.id;
        await prisma.user.updateMany({ where: { referredBy: uid }, data: { referredBy: null } });
        await prisma.$transaction([
          prisma.ticketReply.deleteMany({ where: { ticket: { userId: uid } } }),
          prisma.ticket.deleteMany({ where: { userId: uid } }),
          prisma.session.deleteMany({ where: { userId: uid } }),
          prisma.order.updateMany({ where: { userId: uid }, data: { deletedAt: new Date() } }),
          prisma.user.update({ where: { id: uid }, data: {
            status: 'Deleted', name: 'Deleted User', email: `deleted_${uid}@nitro.ng`,
            password: '', balance: 0, emailVerified: false, verifyToken: null, resetToken: null, phone: null,
          } }),
        ]);
        permDeleted++;
        log.info('Cleanup', `Permanently deleted user ${pu.deletedEmail || pu.email} (${uid})`);
      } catch (e) {
        log.error('Cleanup', `Failed to permanently delete user ${pu.id}: ${e.message}`);
      }
    }
    results.cleanup.permanentlyDeleted = permDeleted;
  } catch (err) {
    log.error('Cleanup', err.message);
    results.cleanup.error = err.message;
  }

  // ═══ BALANCE: check provider balances + alert if low ═══
  try {
    const LOW_BALANCE_USD = 10;
    const providers = [
      { id: 'mtp', name: 'MoreThanPanel', hasKey: !!process.env.MTP_API_KEY },
      { id: 'jap', name: 'JustAnotherPanel', hasKey: !!process.env.JAP_API_KEY },
      { id: 'dao', name: 'DaoSMM', hasKey: !!process.env.DAOSMM_API_KEY },
    ];

    const balances = {};
    const alerts = [];

    for (const provider of providers) {
      if (!provider.hasKey) { balances[provider.id] = { status: 'skipped' }; continue; }
      try {
        const data = await getBalance(provider.id);
        const balance = parseFloat(data.balance) || 0;
        balances[provider.id] = { balance, currency: data.currency || 'USD' };
        if (balance < LOW_BALANCE_USD) alerts.push({ provider: provider.name, balance, threshold: LOW_BALANCE_USD });
      } catch (err) {
        balances[provider.id] = { status: 'error', message: err.message };
        log.warn(`Balance check ${provider.name}`, err.message);
      }
    }

    try {
      await prisma.setting.upsert({
        where: { key: 'provider_balances' },
        update: { value: JSON.stringify({ ...balances, checkedAt: new Date().toISOString() }) },
        create: { key: 'provider_balances', value: JSON.stringify({ ...balances, checkedAt: new Date().toISOString() }) },
      });
    } catch {}

    if (alerts.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const existing = await prisma.setting.findUnique({ where: { key: 'last_balance_alert' } });
      if (!existing?.value?.startsWith(today)) {
        const alertText = alerts.map(a => `${a.provider}: $${a.balance.toFixed(2)} (below $${a.threshold})`).join(', ');
        await prisma.setting.upsert({
          where: { key: 'last_balance_alert' },
          update: { value: `${today}: ${alertText}` },
          create: { key: 'last_balance_alert', value: `${today}: ${alertText}` },
        });
        try {
          const adminEmail = process.env.ADMIN_EMAIL || 'admin@nitro.ng';
          const html = emailWrap({
            label: 'System Alert', labelBg: 'rgba(245,158,11,.12)', labelColor: '#f59e0b',
            title: 'Low Provider Balance',
            body: `
              <p style="font-size:14px;color:#666;margin:0 0 16px;">The following providers have low balances:</p>
              <div style="background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:16px;">
                ${alerts.map(a => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#888;">${a.provider}</span><span style="color:#ef4444;font-weight:600;">$${a.balance.toFixed(2)} <span style="color:#888;font-weight:400;">(min $${a.threshold})</span></span></div>`).join('')}
              </div>
              <p style="font-size:13px;color:#888;margin:0;">Please top up to avoid order failures.</p>`,
          });
          sendEmail(adminEmail, 'Low Provider Balance Alert', html).catch(err => log.warn('Balance alert email', err.message));
        } catch (emailErr) { log.warn('Balance alert email', emailErr.message); }
        log.warn('Low balance alert', alertText);
      }
    }

    results.balance = { balances, alerts: alerts.length };
  } catch (err) {
    log.error('Balance check', err.message);
    results.balance.error = err.message;
  }

  return Response.json({ success: true, ...results });
}
