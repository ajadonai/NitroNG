import prisma from '@/lib/prisma';
import { watBounds } from '@/lib/format';
import { log } from '@/lib/logger';
import { tgOutreach } from '@/lib/telegram';
import { sendOutreach as ifySendOutreach } from '@/lib/ify/outreach';
import { poolWhere } from '@/lib/outreach-pool';
import { isOutreachPaused } from '@/lib/outreach-pause';

export const maxDuration = 300;

// Per-touch caps, so no touch can starve the others. Follow-up and Final Nudge
// sit on pools of 100+ and would take the whole budget between them if uncapped.
//
// The sequence is a pipeline: call 50 new people today and those same 50 need a
// follow-up three days later, then a final nudge four days after that. Capping a
// downstream touch below the one feeding it guarantees a queue that only grows,
// so the caps taper with attrition rather than sitting flat.
//
// First Call is highest because it is the only touch with an expiry. Miss the
// 1-4 day window and the lead leaves First Call permanently, landing in Backlog
// to be called cold weeks later off a script written for someone who just signed
// up. Backlog is precisely the accumulation of everyone who missed that window,
// so headroom here is the only thing that stops it growing. It also cannot run
// away with the budget: its pool is bounded by whoever signed up in a four-day
// window, which at ~80 signups a day and roughly a third eligible is ~28.
//
// The caps must sum to less than DAILY_BUDGET, or Backlog is left with nothing.
// Only Backlog is budget-aware; the priority touches take their cap regardless,
// so an over-subscribed set of caps overspends the day and starves Backlog.
// Sized against working time, not appetite. At the observed ~14 contacts an hour,
// 50 First Call cards is three and a half hours of work and 15 Follow-up is one,
// which is why the schedule spaces them that far apart. Handing out a list faster
// than it can be worked is what left a third of every day unworked.
//
// day7 and winback are kept here but are no longer scheduled: neither had a single
// card worked in 30 days, and winback duplicates an email that already goes out
// with credit attached. Re-adding a cron line is all it takes to revive them.
const TOUCH_CAP = {
  day1: 50,
  day3: 15,
  day7: 30,
  winback: 20,
};

// People who actually work cards. Deliberately not OUTREACH_STAFF, which also
// carries admins for command access — one of whom has never worked a card.
const CALLERS = 1;

// One caller sustains about 110 contacts across a 7.5-hour day, so 100 is set just
// under that: the day can genuinely be cleared, which makes "Left: 0" mean
// something. Every additional caller adds another 100. Backlog runs last and
// claims whatever the priority touches left unspent.
const DAILY_BUDGET = 100 * CALLERS;

// tgOutreach sleeps 3s per contact for Telegram's per-group rate limit, so a single
// run cannot exceed ~95 contacts before hitting maxDuration. Hard ceiling per run.
const MAX_RUN = 90;
// Backlog is guaranteed this many sends a day. The priority touches are
// budget-aware: each takes its cap or what is left above the floor, whichever
// is smaller, so an over-subscribed set of caps can no longer starve Backlog.
const BACKLOG_FLOOR = 15;
async function sentTodayCount() {
  const { todayStart: startOfToday } = watBounds();
  return prisma.user.count({
    where: {
      OR: [
        { outreachDay1SentAt: { gte: startOfToday } },
        { outreachDay3SentAt: { gte: startOfToday } },
        { outreachDay7SentAt: { gte: startOfToday } },
        { outreachWinbackSentAt: { gte: startOfToday } },
      ],
    },
  });
}
function priorityTake(cap, sentToday) {
  return Math.max(0, Math.min(cap, DAILY_BUDGET - BACKLOG_FLOOR - sentToday));
}

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
  if (await isOutreachPaused()) return Response.json({ ok: true, paused: true });

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
        take: priorityTake(TOUCH_CAP.winback, await sentTodayCount()),
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
      const sentToday = await sentTodayCount();
      const BATCH_LIMIT = Math.max(0, Math.min(DAILY_BUDGET - sentToday, MAX_RUN));

      const baseWhere = poolWhere('backlog');

      const now = new Date();
      // The weekend window is counted in Lagos time.
      const wat = new Date(now.getTime() + 3600000);
      const day = wat.getUTCDay();
      const daysSinceSat = (day + 1) % 7;
      const lastSat = new Date(Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate() - daysSinceSat) - 3600000);
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
        take: priorityTake(TOUCH_CAP.day1, await sentTodayCount()),
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
        take: priorityTake(TOUCH_CAP[touch], await sentTodayCount()),
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
