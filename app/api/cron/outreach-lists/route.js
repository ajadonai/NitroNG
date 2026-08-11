import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { tgOutreach } from '@/lib/telegram';
import { sendOutreach as ifySendOutreach } from '@/lib/ify/outreach';

export const maxDuration = 60;

const TOUCHES = {
  day1: { field: 'outreachDay1SentAt', daysAgo: 1, label: 'Day 1 — new signups' },
  day3: { field: 'outreachDay3SentAt', daysAgo: 3, label: 'Day 3 — follow up' },
  day7: { field: 'outreachDay7SentAt', daysAgo: 7, label: 'Day 7 — last nudge' },
  winback: { field: 'outreachWinbackSentAt', label: 'Winback — 30 days inactive' },
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
        take: 200,
      });

      if (batch.length > 0) {
        const creditMap = new Map();
        batch.forEach(u => {
          const credit = u.bonusCredits?.[0]?.amountGranted;
          if (credit) creditMap.set(u.id, credit / 100);
        });
        await tgOutreach(batch, 'winback', { label: config.label, creditMap });
        const stampDate = new Date();
        for (const u of batch) {
          const creditNaira = creditMap.get(u.id) || 0;
          prisma.user.update({ where: { id: u.id }, data: { [config.field]: stampDate } }).catch(() => {});
          ifySendOutreach({ user: u, trigger: 'winback', extra: { creditNaira } }).catch(() => {});
        }
      }
      results.sent = batch.length;
    } else {
      const windowStart = new Date(Date.now() - (config.daysAgo + 1) * 86400000);
      const windowEnd = new Date(Date.now() - config.daysAgo * 86400000);
      const batch = await prisma.user.findMany({
        where: {
          status: 'Active',
          outreachOptedOutAt: null,
          [config.field]: null,
          createdAt: { gte: windowStart, lt: windowEnd },
          transactions: { none: { type: 'deposit', status: 'Completed' } },
          orders: { none: {} },
        },
        select: { id: true, name: true, phone: true },
        take: 200,
      });

      if (batch.length > 0) {
        await tgOutreach(batch, touch, { label: config.label });
        const stampDate = new Date();
        for (const u of batch) {
          prisma.user.update({ where: { id: u.id }, data: { [config.field]: stampDate } }).catch(() => {});
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
