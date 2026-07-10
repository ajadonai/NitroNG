export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getBalance } from '@/lib/smm';
import { sendEmail, emailWrap, emailRow, emailDataBox, sendNudgeIdleFunds, sendNudgeIdleBalance, sendAdActivationDay1, sendAdActivationDay3, sendAdActivationDay6, sendWinback30Email, sendWinback60Email } from '@/lib/email';
import { tgProviderBalance, tgDailySummary } from '@/lib/telegram';
import { releaseHeldCommissions } from '@/lib/commissions';
import { expireBonusCredits, grantWinbackCredit } from '@/lib/bonus-credit';
import { getTierConfig } from '@/lib/affiliate-settings';

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

  // ═══ AD ACTIVATION: 3-touch sequence for ad signups who haven't deposited ═══
  const AD_SOURCES = ['alabi-ad'];
  const activationTouches = [
    { day: 1, field: 'adActivationDay1SentAt', send: sendAdActivationDay1, label: 'Day1' },
    { day: 3, field: 'adActivationDay3SentAt', send: sendAdActivationDay3, label: 'Day3' },
    { day: 6, field: 'adActivationDay6SentAt', send: sendAdActivationDay6, label: 'Day6' },
  ];
  for (const touch of activationTouches) {
    try {
      const windowStart = new Date(Date.now() - (touch.day + 1) * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(Date.now() - touch.day * 24 * 60 * 60 * 1000);
      let sent = 0;
      const batch = await prisma.user.findMany({
        where: {
          status: 'Active',
          notifPromo: true,
          [touch.field]: null,
          signupSource: { in: AD_SOURCES },
          createdAt: { gte: windowStart, lte: windowEnd },
          transactions: { none: { type: 'deposit', status: 'Completed' } },
        },
        select: { id: true, name: true, email: true },
        take: 50,
      });
      for (const user of batch) {
        try {
          await touch.send(user.name || 'there', user.email);
          await prisma.user.update({ where: { id: user.id }, data: { [touch.field]: new Date() } });
          sent++;
        } catch (e) {
          log.warn(`AdActivation${touch.label}`, `Failed: ${user.email}: ${e.message}`);
          await prisma.user.update({ where: { id: user.id }, data: { [touch.field]: new Date(0) } }).catch(() => {});
        }
      }
      if (sent > 0) log.info(`AdActivation${touch.label}`, `Sent ${sent} of ${batch.length}`);
      results[`adActivation${touch.label}`] = { sent, total: batch.length };
    } catch (err) {
      log.error(`AdActivation${touch.label}`, err.message);
      results[`adActivation${touch.label}`] = { error: err.message };
    }
  }

  // ═══ WINBACK PLAY 7: credit-backed 2-touch re-engagement ═══
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

  // Reset winback flags when user completed a new order since last touch
  try {
    const resetCount = await prisma.$executeRaw`
      UPDATE users SET "winback30SentAt" = NULL, "winback60SentAt" = NULL
      WHERE "winback30SentAt" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM orders
        WHERE orders."userId" = users.id
        AND orders.status = 'Completed'
        AND orders."deletedAt" IS NULL
        AND orders."createdAt" > users."winback30SentAt"
      )`;
    if (resetCount > 0) log.info('WinbackReset', `Reset ${resetCount} users with new orders`);
    results.winbackReset = { reset: resetCount };
  } catch (err) {
    log.error('WinbackReset', err.message);
    results.winbackReset = { error: err.message };
  }

  // Load winback settings
  let wb30Pct = 15, wb30Min = 100, wb30Cap = 500;
  let wb60Pct = 25, wb60Min = 150, wb60Cap = 1000;
  let wbExpiryDays = 7;
  try {
    const wbKeys = ['winback30_pct', 'winback30_min_naira', 'winback30_cap_naira', 'winback60_pct', 'winback60_min_naira', 'winback60_cap_naira', 'winback_credit_expiry_days'];
    const wbSettings = await prisma.setting.findMany({ where: { key: { in: wbKeys } } });
    const ws = Object.fromEntries(wbSettings.map(r => [r.key, parseInt(r.value)]));
    if (ws.winback30_pct) wb30Pct = ws.winback30_pct;
    if (ws.winback30_min_naira) wb30Min = ws.winback30_min_naira;
    if (ws.winback30_cap_naira) wb30Cap = ws.winback30_cap_naira;
    if (ws.winback60_pct) wb60Pct = ws.winback60_pct;
    if (ws.winback60_min_naira) wb60Min = ws.winback60_min_naira;
    if (ws.winback60_cap_naira) wb60Cap = ws.winback60_cap_naira;
    if (ws.winback_credit_expiry_days) wbExpiryDays = ws.winback_credit_expiry_days;
  } catch {}

  function winbackCredit(lifetimeSpendKobo, pct, minNaira, capNaira) {
    const raw = Math.floor(lifetimeSpendKobo * pct / 100);
    return Math.min(Math.max(raw, minNaira * 100), capNaira * 100);
  }

  // Spacing guard: no marketing email of any kind within 10 days
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
  const spacingGuard = {
    NOT: {
      OR: [
        { nudgeIdleFundsSentAt: { gt: tenDaysAgo } },
        { nudgeComebackSentAt: { gt: tenDaysAgo } },
        { nudgeLapsedSentAt: { gt: tenDaysAgo } },
        { nudgeIdleBalanceSentAt: { gt: tenDaysAgo } },
        { winbackSentAt: { gt: tenDaysAgo } },
        { winback30SentAt: { gt: tenDaysAgo } },
        { winback60SentAt: { gt: tenDaysAgo } },
        { adActivationDay1SentAt: { gt: tenDaysAgo } },
        { adActivationDay3SentAt: { gt: tenDaysAgo } },
        { adActivationDay6SentAt: { gt: tenDaysAgo } },
      ],
    },
  };

  // Retry markers: Date(1) = 1st fail, Date(2) = 2nd fail, Date(0) = permanent give-up
  const RETRY_ELIGIBLE = [new Date(1), new Date(2)];
  const STALE_CUTOFF_MS = 4 * 86400000;

  // Day-30 touch (fresh + retries)
  try {
    let wb30Sent = 0;
    const wb30Batch = await prisma.user.findMany({
      where: {
        status: 'Active', emailVerified: true, notifPromo: true,
        OR: [{ winback30SentAt: null }, { winback30SentAt: { in: RETRY_ELIGIBLE } }],
        ...spacingGuard,
        orders: {
          some: { status: 'Completed', deletedAt: null },
          none: { status: 'Completed', deletedAt: null, createdAt: { gt: thirtyDaysAgo } },
        },
      },
      select: { id: true, name: true, email: true, winback30SentAt: true },
      take: 50,
    });
    for (const user of wb30Batch) {
      try {
        const isRetry = user.winback30SentAt !== null;
        const attempt = isRetry ? user.winback30SentAt.getTime() + 1 : 1;
        let creditNaira, daysLeft;

        if (isRetry) {
          const bc = await prisma.bonusCredit.findFirst({
            where: { userId: user.id, source: 'winback', amountRemaining: { gt: 0 }, expiredAt: null },
            orderBy: { grantedAt: 'desc' },
            select: { expiresAt: true, amountGranted: true },
          });
          const msLeft = bc ? bc.expiresAt.getTime() - Date.now() : 0;
          if (!bc || msLeft < STALE_CUTOFF_MS) {
            await prisma.user.update({ where: { id: user.id }, data: { winback30SentAt: new Date(0) } });
            continue;
          }
          creditNaira = bc.amountGranted / 100;
          daysLeft = Math.max(1, Math.ceil(msLeft / 86400000));
        } else {
          const agg = await prisma.order.aggregate({
            where: { userId: user.id, status: 'Completed', deletedAt: null },
            _sum: { charge: true },
          });
          const creditKobo = winbackCredit(agg._sum.charge || 0, wb30Pct, wb30Min, wb30Cap);
          creditNaira = creditKobo / 100;
          await grantWinbackCredit(prisma, user.id, creditKobo, wbExpiryDays);
          daysLeft = wbExpiryDays;
        }

        try {
          await sendWinback30Email(user.name || 'there', user.email, creditNaira, daysLeft);
          await prisma.user.update({ where: { id: user.id }, data: { winback30SentAt: new Date() } });
          wb30Sent++;
        } catch (emailErr) {
          log.warn('Winback30', `Email failed (attempt ${attempt}): ${user.email}: ${emailErr.message}`);
          await prisma.user.update({ where: { id: user.id }, data: { winback30SentAt: attempt >= 3 ? new Date(0) : new Date(attempt) } }).catch(() => {});
        }
      } catch (e) {
        log.warn('Winback30', `Failed: ${user.email}: ${e.message}`);
        await prisma.user.update({ where: { id: user.id }, data: { winback30SentAt: new Date(0) } }).catch(() => {});
      }
    }
    if (wb30Sent > 0) log.info('Winback30', `Sent ${wb30Sent} of ${wb30Batch.length}`);
    results.winback30 = { sent: wb30Sent, total: wb30Batch.length };
  } catch (err) {
    log.error('Winback30', err.message);
    results.winback30 = { error: err.message };
  }

  // Day-60 touch (fresh + retries)
  try {
    let wb60Sent = 0;
    const wb60Batch = await prisma.user.findMany({
      where: {
        status: 'Active', emailVerified: true, notifPromo: true,
        winback30SentAt: { not: null, gt: new Date(1000) },
        OR: [{ winback60SentAt: null }, { winback60SentAt: { in: RETRY_ELIGIBLE } }],
        ...spacingGuard,
        orders: {
          some: { status: 'Completed', deletedAt: null },
          none: { status: 'Completed', deletedAt: null, createdAt: { gt: sixtyDaysAgo } },
        },
      },
      select: { id: true, name: true, email: true, winback60SentAt: true },
      take: 50,
    });
    for (const user of wb60Batch) {
      try {
        const isRetry = user.winback60SentAt !== null;
        const attempt = isRetry ? user.winback60SentAt.getTime() + 1 : 1;
        let creditNaira, daysLeft;

        if (isRetry) {
          const bc = await prisma.bonusCredit.findFirst({
            where: { userId: user.id, source: 'winback', amountRemaining: { gt: 0 }, expiredAt: null },
            orderBy: { grantedAt: 'desc' },
            select: { expiresAt: true, amountGranted: true },
          });
          const msLeft = bc ? bc.expiresAt.getTime() - Date.now() : 0;
          if (!bc || msLeft < STALE_CUTOFF_MS) {
            await prisma.user.update({ where: { id: user.id }, data: { winback60SentAt: new Date(0) } });
            continue;
          }
          creditNaira = bc.amountGranted / 100;
          daysLeft = Math.max(1, Math.ceil(msLeft / 86400000));
        } else {
          const agg = await prisma.order.aggregate({
            where: { userId: user.id, status: 'Completed', deletedAt: null },
            _sum: { charge: true },
          });
          const creditKobo = winbackCredit(agg._sum.charge || 0, wb60Pct, wb60Min, wb60Cap);
          creditNaira = creditKobo / 100;
          await grantWinbackCredit(prisma, user.id, creditKobo, wbExpiryDays);
          daysLeft = wbExpiryDays;
        }

        try {
          await sendWinback60Email(user.name || 'there', user.email, creditNaira, daysLeft);
          await prisma.user.update({ where: { id: user.id }, data: { winback60SentAt: new Date() } });
          wb60Sent++;
        } catch (emailErr) {
          log.warn('Winback60', `Email failed (attempt ${attempt}): ${user.email}: ${emailErr.message}`);
          await prisma.user.update({ where: { id: user.id }, data: { winback60SentAt: attempt >= 3 ? new Date(0) : new Date(attempt) } }).catch(() => {});
        }
      } catch (e) {
        log.warn('Winback60', `Failed: ${user.email}: ${e.message}`);
        await prisma.user.update({ where: { id: user.id }, data: { winback60SentAt: new Date(0) } }).catch(() => {});
      }
    }
    if (wb60Sent > 0) log.info('Winback60', `Sent ${wb60Sent} of ${wb60Batch.length}`);
    results.winback60 = { sent: wb60Sent, total: wb60Batch.length };
  } catch (err) {
    log.error('Winback60', err.message);
    results.winback60 = { error: err.message };
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

  // ═══ RETIRED: comeback (7d one-timer) and lapsed (14d multi-order) nudges ═══
  // Replaced by Play 7 winback sequence above — the only reactivation voice for past buyers.
  // DB fields nudgeComebackSentAt / nudgeLapsedSentAt kept (harmless).

  // ═══ NUDGE: has ₦500+ balance, no orders in 7+ days ═══
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let idleBalSent = 0;
    const idleBalBatch = await prisma.user.findMany({
      where: {
        status: 'Active', emailVerified: true, notifPromo: true,
        nudgeIdleBalanceSentAt: null,
        balance: { gte: 50000 },
        // Reverse guard: exclude users in an active Play 7 window
        bonusCredits: { none: { amountRemaining: { gt: 0 }, expiredAt: null, expiresAt: { gt: new Date() } } },
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

  // ═══ COMMISSIONS: release held affiliate commissions past 7-day hold ═══
  try {
    const released = await releaseHeldCommissions();
    results.commissions = { released };
    if (released > 0) log.info('Commissions', `Released ${released} held commissions`);
  } catch (err) {
    log.error('Commissions', err.message);
    results.commissions = { error: err.message };
  }

  // ═══ TIER RECALCULATION: promote/demote crew members by active referred users ═══
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const TIERS = await getTierConfig();

    const members = await prisma.crewMember.findMany({
      where: { status: 'approved', role: { not: 'chief' } },
      select: { id: true, tier: true, commissionRate: true, links: { select: { slug: true } } },
    });

    let tierChanges = 0;
    for (const m of members) {
      const slugs = m.links.map(l => l.slug);
      if (!slugs.length) continue;
      const activeUsers = await prisma.user.count({
        where: {
          signupSource: { in: slugs },
          deletedAt: null,
          orders: { some: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'Cancelled' }, deletedAt: null } },
        },
      });
      let newTier = 'starter';
      if (activeUsers >= TIERS.pro.min) newTier = 'pro';
      else if (activeUsers >= TIERS.growth.min) newTier = 'growth';

      if (newTier !== m.tier) {
        await prisma.crewMember.update({
          where: { id: m.id },
          data: { tier: newTier, commissionRate: TIERS[newTier].rate },
        });
        tierChanges++;
      }
    }
    results.tierRecalc = { checked: members.length, changed: tierChanges };
    if (tierChanges > 0) log.info('TierRecalc', `${tierChanges} tier changes from ${members.length} members`);
  } catch (err) {
    log.error('TierRecalc', err.message);
    results.tierRecalc = { error: err.message };
  }

  // ═══ BONUS EXPIRY: expire past-due bonus credits ═══
  try {
    const bonusExpired = await expireBonusCredits(prisma);
    results.bonusExpiry = { expired: bonusExpired };
    if (bonusExpired > 0) log.info('BonusExpiry', `Expired ${bonusExpired} bonus credits`);
  } catch (err) {
    log.error('BonusExpiry', err.message);
    results.bonusExpiry = { error: err.message };
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
              <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">The following providers have low balances:</p>
              ${emailDataBox(alerts.map(a => emailRow(a.provider, `$${a.balance.toFixed(2)} (min $${a.threshold})`, '#ef4444')).join(''), '#f59e0b')}
              <p class="em-m" style="font-size:13px;color:#9a948d;margin:0;">Please top up to avoid order failures.</p>`,
          });
          sendEmail(adminEmail, 'Low Provider Balance Alert', html).catch(err => log.warn('Balance alert email', err.message));
        } catch (emailErr) { log.warn('Balance alert email', emailErr.message); }
        tgProviderBalance(alerts);
        log.warn('Low balance alert', alertText);
      }
    }

    results.balance = { balances, alerts: alerts.length };
  } catch (err) {
    log.error('Balance check', err.message);
    results.balance.error = err.message;
  }

  const summary = {};
  if (results.cleanup?.deleted) summary['Stale users cleaned'] = results.cleanup.deleted;
  if (results.cleanup?.permanentlyDeleted) summary['Permanently deleted'] = results.cleanup.permanentlyDeleted;
  if (results.tickets?.closed) summary['Tickets auto-closed'] = results.tickets.closed;
  const nudgeKeys = ['nudgeIdleFunds', 'nudgeIdleBalance'];
  const totalNudges = nudgeKeys.reduce((s, k) => s + (results[k]?.sent || 0), 0);
  if (totalNudges) summary['Nudge emails sent'] = totalNudges;
  const totalAds = (results.adActivationDay1?.sent || 0) + (results.adActivationDay3?.sent || 0) + (results.adActivationDay6?.sent || 0);
  if (totalAds) summary['Activation emails'] = totalAds;
  const totalWinback = (results.winback30?.sent || 0) + (results.winback60?.sent || 0);
  if (totalWinback) summary['Winback credits sent'] = totalWinback;
  if (results.winbackReset?.reset) summary['Winback resets'] = results.winbackReset.reset;
  if (results.commissions?.released) summary['Commissions released'] = results.commissions.released;
  if (results.tierRecalc?.changed) summary['Tier changes'] = results.tierRecalc.changed;
  if (results.bonusExpiry?.expired) summary['Bonus credits expired'] = results.bonusExpiry.expired;
  if (results.balance?.alerts) summary['Low balance alerts'] = results.balance.alerts;
  const bals = results.balance?.balances || {};
  Object.entries(bals).forEach(([k, v]) => { if (v.balance != null) summary[`${k.toUpperCase()} bal`] = `$${v.balance.toFixed(2)}`; });
  if (Object.keys(summary).length) tgDailySummary(summary);

  return Response.json({ success: true, ...results });
}
