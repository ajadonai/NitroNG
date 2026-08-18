import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { tgOutreach } from '@/lib/telegram';
import { sendOutreach as ifySendOutreach } from '@/lib/ify/outreach';
import { poolWhere } from '@/lib/outreach-pool';

export const maxDuration = 300;

// Per-touch cap for the four priority touches, so none can starve the others.
const BATCH_SIZE = 30;

// Total contacts handed to staff across all touches in a day. Raised to 200 because
// a large share of numbers are unreachable and clear in seconds, so headline
// throughput overstates conversation capacity — more volume is needed to surface the
// same number of real conversations. Backlog runs after the priority touches and
// claims whatever they left unspent, so a slow signup day clears old contacts
// instead of idling staff. Two backlog runs, because MAX_RUN caps a single one.
const DAILY_BUDGET = 200;

// tgOutreach sleeps 3s per contact for Telegram's per-group rate limit, so a single
// run cannot exceed ~95 contacts before hitting maxDuration. Hard ceiling per run.
const MAX_RUN = 90;

const TOUCHES = {
  day1: { field: 'outreachDay1SentAt', daysAgo: 1, label: 'First Call — new signups' },
  day3: { field: 'outreachDay3SentAt', daysAgo: 3, label: 'Follow-up' },
  day7: { field: 'outreachDay7SentAt', daysAgo: 7, label: 'Final Nudge' },
  winback: { field: 'outreachWinbackSentAt', label: 'Winback — 30 days inactive' },
  backlog: { field: 'outreachDay1SentAt', label: 'Backlog' },
};

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const touch = req.nextUrl.searchParams.get('touch');
  if (!touch || !TOUCHES[touch]) {
    return Response.json({ error: 'Invalid touch param. Use: day1, day3, day7, winback' }, { status: 400 });
  }

  const config = TOUCHES[touch];
  const results = { touch, sent: 0 };

  try {
    if (touch === 'winback') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const batch = await prisma.user.findMany({
        where: {
          status: 'Active',
          outreachOptedOutAt: null,
          [config.field]: null,
          orders: {
            some: { status: 'Completed', deletedAt: null },
            none: { status: 'Completed', deletedAt: null, createdAt: { gt: thirtyDaysAgo } },
          },
          bonusCredits: {
            some: { source: 'winback', amountRemaining: { gt: 0 }, expiredAt: null, expiresAt: { gt: new Date() } },
          },
        },
        select: {
          id: true, name: true, phone: true,
          bonusCredits: {
            where: { source: 'winback', amountRemaining: { gt: 0 }, expiredAt: null },
            orderBy: { grantedAt: 'desc' },
            take: 1,
            select: { amountGranted: true },
          },
        },
        take: BATCH_SIZE,
      });

      if (batch.length > 0) {
        const creditMap = new Map();
        batch.forEach(u => {
          const credit = u.bonusCredits?.[0]?.amountGranted;
          if (credit) creditMap.set(u.id, credit / 100);
        });
        const stampDate = new Date();
        await Promise.allSettled(batch.map(u =>
          prisma.user.update({ where: { id: u.id }, data: { [config.field]: stampDate } })
        ));
        await tgOutreach(batch, 'winback', { label: config.label, creditMap });
        for (const u of batch) {
          const creditNaira = creditMap.get(u.id) || 0;
          ifySendOutreach({ user: u, trigger: 'winback', extra: { creditNaira } }).catch(() => {});
        }
      }
      results.sent = batch.length;
    } else if (touch === 'backlog') {
      const BACKLOG_CUTOFF = new Date('2026-08-16T00:00:00Z');

      // Backlog is the flex valve. Count what the priority touches already handed out
      // today and claim the rest of the budget, capped by what one run can send.
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const sentToday = await prisma.user.count({
        where: {
          OR: [
            { outreachDay1SentAt: { gte: startOfToday } },
            { outreachDay3SentAt: { gte: startOfToday } },
            { outreachDay7SentAt: { gte: startOfToday } },
            { outreachWinbackSentAt: { gte: startOfToday } },
          ],
        },
      });
      const BATCH_LIMIT = Math.max(0, Math.min(DAILY_BUDGET - sentToday, MAX_RUN));

      const baseWhere = poolWhere('backlog');

      const now = new Date();
      const day = now.getUTCDay();
      const daysSinceSat = (day + 1) % 7;
      const lastSat = new Date(now);
      lastSat.setUTCDate(lastSat.getUTCDate() - daysSinceSat);
      lastSat.setUTCHours(0, 0, 0, 0);
      const weekendEnd = new Date(lastSat);
      weekendEnd.setUTCDate(weekendEnd.getUTCDate() + 2);

      const weekendBatch = BATCH_LIMIT > 0 ? await prisma.user.findMany({
        where: { ...baseWhere, createdAt: { gte: lastSat, lt: weekendEnd } },
        select: { id: true, name: true, phone: true },
        orderBy: { createdAt: 'desc' },
        take: BATCH_LIMIT,
      }) : [];

      const remaining = BATCH_LIMIT - weekendBatch.length;
      let oldBatch = [];
      if (remaining > 0) {
        oldBatch = await prisma.user.findMany({
          where: { ...baseWhere, createdAt: { lt: BACKLOG_CUTOFF } },
          select: { id: true, name: true, phone: true },
          take: remaining,
        });
      }

      const batch = [...weekendBatch, ...oldBatch];

      if (batch.length > 0) {
        const stampDate = new Date();
        await Promise.allSettled(batch.map(u =>
          prisma.user.update({ where: { id: u.id }, data: { outreachDay1SentAt: stampDate } })
        ));
        await tgOutreach(batch, 'backlog', { label: config.label });
        for (const u of batch) {
          ifySendOutreach({ user: u, trigger: 'day1' }).catch(() => {});
        }
      }
      results.sent = batch.length;
      results.weekend = weekendBatch.length;
      results.old = oldBatch.length;
      results.budget = { spentByOtherTouches: sentToday, allocatedToBacklog: BATCH_LIMIT };
    } else if (touch === 'day1') {
      const batch = await prisma.user.findMany({
        where: poolWhere('day1'),
        select: { id: true, name: true, phone: true },
        take: BATCH_SIZE,
      });

      if (batch.length > 0) {
        const stampDate = new Date();
        await Promise.allSettled(batch.map(u =>
          prisma.user.update({ where: { id: u.id }, data: { outreachDay1SentAt: stampDate } })
        ));
        await tgOutreach(batch, touch, { label: config.label });
        for (const u of batch) {
          ifySendOutreach({ user: u, trigger: touch }).catch(() => {});
        }
      }
      results.sent = batch.length;
    } else {
      const batch = await prisma.user.findMany({
        where: poolWhere(touch),
        select: { id: true, name: true, phone: true },
        take: BATCH_SIZE,
      });

      if (batch.length > 0) {
        const stampDate = new Date();
        await Promise.allSettled(batch.map(u =>
          prisma.user.update({ where: { id: u.id }, data: { [config.field]: stampDate } })
        ));
        await tgOutreach(batch, touch, { label: config.label });
        for (const u of batch) {
          ifySendOutreach({ user: u, trigger: touch }).catch(() => {});
        }
      }
      results.sent = batch.length;
    }

    log.info('Outreach Lists', `${touch}: ${results.sent} users`);
    return Response.json({ ok: true, ...results });
  } catch (err) {
    log.error('Outreach Lists', `${touch}: ${err.message}`);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
