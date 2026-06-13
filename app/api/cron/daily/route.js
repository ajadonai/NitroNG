export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getBalance } from '@/lib/smm';
import { sendEmail, emailWrap, emailRow, emailDataBox, sendWinbackEmail, sendNudgeIdleFunds, sendNudgeComeback, sendNudgeLapsed, sendNudgeIdleBalance } from '@/lib/email';

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isScheduled = req.headers.get('x-vercel-cron') === '1';
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

  // ═══ TICKETS: auto-close inactive tickets ═══
  try {
    const inactiveCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const staleTickets = await prisma.ticket.findMany({
      where: { status: { in: ['Open', 'In Progress'] }, updatedAt: { lt: inactiveCutoff } },
      select: { id: true, ticketId: true },
    });

    let ticketsClosed = 0;
    for (const ticket of staleTickets) {
      try {
        await prisma.ticketReply.create({
          data: {
            ticketId: ticket.id,
            from: 'system',
            message: 'This ticket has been closed due to inactivity. If you still need help, please open a new ticket.',
          },
        });
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { status: 'Resolved', unreadByUser: true },
        });
        ticketsClosed++;
      } catch (e) {
        log.error('Ticket auto-close', `Failed to close ticket ${ticket.ticketId}: ${e.message}`);
      }
    }

    if (ticketsClosed > 0) log.info('Tickets', `Auto-closed ${ticketsClosed} inactive tickets`);
    results.tickets = { closed: ticketsClosed };
  } catch (err) {
    log.error('Ticket auto-close', err.message);
    results.tickets = { error: err.message };
  }

  // ═══ LOG RETENTION: prune activity logs older than 90 days ═══
  try {
    const logCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { count } = await prisma.activityLog.deleteMany({ where: { createdAt: { lt: logCutoff } } });
    results.logRetention = { pruned: count };
    if (count > 0) log.info('Log retention', `Pruned ${count} activity logs older than 90 days`);
  } catch (err) {
    log.error('Log retention', err.message);
    results.logRetention = { error: err.message };
  }

  // ═══ WIN-BACK: email inactive new users after 7 days ═══
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let winbackSent = 0;
    let winbackFailed = 0;
    const batch = await prisma.user.findMany({
      where: {
        status: 'Active',
        emailVerified: true,
        notifPromo: true,
        winbackSentAt: null,
        createdAt: { gte: thirtyDaysAgo, lte: sevenDaysAgo },
        orders: { none: {} },
      },
      select: { id: true, name: true, email: true },
      take: 50,
    });
    for (const user of batch) {
      try {
        await sendWinbackEmail(user.name || 'there', user.email);
        await prisma.user.update({ where: { id: user.id }, data: { winbackSentAt: new Date() } });
        winbackSent++;
      } catch (e) {
        log.warn('Winback', `Failed to send to ${user.email}: ${e.message}`);
        await prisma.user.update({ where: { id: user.id }, data: { winbackSentAt: new Date(0) } }).catch(() => {});
        winbackFailed++;
      }
    }
    if (winbackSent > 0 || winbackFailed > 0) log.info('Winback', `Sent ${winbackSent}, failed ${winbackFailed} of ${batch.length}`);
    results.winback = { sent: winbackSent, failed: winbackFailed, total: batch.length };
  } catch (err) {
    log.error('Winback', err.message);
    results.winback = { error: err.message };
  }

  // ═══ NUDGE: funded wallet but never ordered (7+ days) ═══
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let idleFundsSent = 0;
    const idleFundsBatch = await prisma.user.findMany({
      where: {
        status: 'Active', emailVerified: true, notifPromo: true,
        nudgeIdleFundsSentAt: null,
        balance: { gt: 0 },
        createdAt: { lte: sevenDaysAgo },
        orders: { none: {} },
        transactions: { some: { type: { in: ['deposit', 'admin_credit', 'admin_gift'] } } },
      },
      select: { id: true, name: true, email: true, balance: true },
      take: 50,
    });
    for (const user of idleFundsBatch) {
      try {
        await sendNudgeIdleFunds(user.name || 'there', user.email, user.balance / 100);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeIdleFundsSentAt: new Date() } });
        idleFundsSent++;
      } catch (e) {
        log.warn('NudgeIdleFunds', `Failed: ${user.email}: ${e.message}`);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeIdleFundsSentAt: new Date(0) } }).catch(() => {});
      }
    }
    if (idleFundsSent > 0) log.info('NudgeIdleFunds', `Sent ${idleFundsSent} of ${idleFundsBatch.length}`);
    results.nudgeIdleFunds = { sent: idleFundsSent, total: idleFundsBatch.length };
  } catch (err) {
    log.error('NudgeIdleFunds', err.message);
    results.nudgeIdleFunds = { error: err.message };
  }

  // ═══ NUDGE: ordered once, quiet 7+ days ═══
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let comebackSent = 0;
    const comebackBatch = await prisma.user.findMany({
      where: {
        status: 'Active', emailVerified: true, notifPromo: true,
        nudgeComebackSentAt: null,
        orders: { some: { status: 'Completed', createdAt: { lte: sevenDaysAgo } } },
      },
      select: { id: true, name: true, email: true, _count: { select: { orders: { where: { status: { not: 'Cancelled' }, deletedAt: null } } } } },
      take: 50,
    });
    const oneTimers = comebackBatch.filter(u => u._count.orders === 1);
    for (const user of oneTimers) {
      try {
        await sendNudgeComeback(user.name || 'there', user.email);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeComebackSentAt: new Date() } });
        comebackSent++;
      } catch (e) {
        log.warn('NudgeComeback', `Failed: ${user.email}: ${e.message}`);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeComebackSentAt: new Date(0) } }).catch(() => {});
      }
    }
    if (comebackSent > 0) log.info('NudgeComeback', `Sent ${comebackSent} of ${oneTimers.length}`);
    results.nudgeComeback = { sent: comebackSent, total: oneTimers.length };
  } catch (err) {
    log.error('NudgeComeback', err.message);
    results.nudgeComeback = { error: err.message };
  }

  // ═══ NUDGE: was active, gone 14+ days ═══
  try {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    let lapsedSent = 0;
    const lapsedBatch = await prisma.user.findMany({
      where: {
        status: 'Active', emailVerified: true, notifPromo: true,
        nudgeLapsedSentAt: null,
        orders: {
          some: { status: { not: 'Cancelled' }, deletedAt: null },
          none: { createdAt: { gt: fourteenDaysAgo }, deletedAt: null },
        },
      },
      select: { id: true, name: true, email: true, _count: { select: { orders: { where: { status: { not: 'Cancelled' }, deletedAt: null } } } } },
      take: 50,
    });
    const multiOrderLapsed = lapsedBatch.filter(u => u._count.orders >= 2);
    for (const user of multiOrderLapsed) {
      try {
        await sendNudgeLapsed(user.name || 'there', user.email);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeLapsedSentAt: new Date() } });
        lapsedSent++;
      } catch (e) {
        log.warn('NudgeLapsed', `Failed: ${user.email}: ${e.message}`);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeLapsedSentAt: new Date(0) } }).catch(() => {});
      }
    }
    if (lapsedSent > 0) log.info('NudgeLapsed', `Sent ${lapsedSent} of ${multiOrderLapsed.length}`);
    results.nudgeLapsed = { sent: lapsedSent, total: multiOrderLapsed.length };
  } catch (err) {
    log.error('NudgeLapsed', err.message);
    results.nudgeLapsed = { error: err.message };
  }

  // ═══ NUDGE: has ₦500+ balance, no orders in 7+ days ═══
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let idleBalSent = 0;
    const idleBalBatch = await prisma.user.findMany({
      where: {
        status: 'Active', emailVerified: true, notifPromo: true,
        nudgeIdleBalanceSentAt: null,
        balance: { gte: 50000 },
        orders: {
          some: { deletedAt: null },
          none: { createdAt: { gt: sevenDaysAgo }, deletedAt: null },
        },
      },
      select: { id: true, name: true, email: true, balance: true },
      take: 50,
    });
    for (const user of idleBalBatch) {
      try {
        await sendNudgeIdleBalance(user.name || 'there', user.email, user.balance / 100);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeIdleBalanceSentAt: new Date() } });
        idleBalSent++;
      } catch (e) {
        log.warn('NudgeIdleBalance', `Failed: ${user.email}: ${e.message}`);
        await prisma.user.update({ where: { id: user.id }, data: { nudgeIdleBalanceSentAt: new Date(0) } }).catch(() => {});
      }
    }
    if (idleBalSent > 0) log.info('NudgeIdleBalance', `Sent ${idleBalSent} of ${idleBalBatch.length}`);
    results.nudgeIdleBalance = { sent: idleBalSent, total: idleBalBatch.length };
  } catch (err) {
    log.error('NudgeIdleBalance', err.message);
    results.nudgeIdleBalance = { error: err.message };
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
          const html = await emailWrap({
            label: 'System Alert', labelBg: 'rgba(245,158,11,.12)', labelColor: '#f59e0b',
            title: 'Low Provider Balance',
            body: `
              <p style="font-size:14px;color:#666;margin:0 0 16px;">The following providers have low balances:</p>
              ${emailDataBox(alerts.map(a => emailRow(a.provider, `$${a.balance.toFixed(2)} (min $${a.threshold})`, '#ef4444')).join(''))}
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
