import prisma from '@/lib/prisma';
import { watBounds } from '@/lib/format';
import { log } from '@/lib/logger';
import { sendOutreach } from '@/lib/telegram';
import { row, pct } from '@/lib/outreach-format';
import { isOutreachPaused } from '@/lib/outreach-pause';

export const maxDuration = 60;

// Posted to General rather than a touch topic: these are for the person, not for
// a list, and burying them under First Call would mean they read as work.
const GENERAL = undefined;

// Break boundaries in WAT minutes-from-midnight. One cron fires every half hour
// and picks the moment it lands on, rather than five separate cron entries.
const MOMENTS = [
  { at: 13 * 60, kind: 'lunchStart' },
  { at: 14 * 60, kind: 'lunchEnd' },
  { at: 16 * 60, kind: 'refreshStart' },
  { at: 16 * 60 + 30, kind: 'refreshEnd' },
  { at: 18 * 60, kind: 'dayEnd' },
];

// Vercel fires crons within a minute or two of the mark, so match a window rather
// than an exact time. Ten minutes is wide enough never to miss and narrow enough
// that two moments can never both match.
const TOLERANCE = 10;

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (await isOutreachPaused()) return Response.json({ ok: true, paused: true });

  const wat = new Date(Date.now() + 3600000);
  const mins = wat.getUTCHours() * 60 + wat.getUTCMinutes();
  const moment = MOMENTS.find(m => Math.abs(mins - m.at) <= TOLERANCE);
  if (!moment) return Response.json({ ok: true, skipped: 'not a break boundary' });

  try {
    const { todayStart } = watBounds();
    const stamped = (f) => prisma.user.count({ where: { [f]: { gte: todayStart } } });
    const [handed, contacts] = await Promise.all([
      Promise.all([
        stamped('outreachDay1SentAt'), stamped('outreachDay3SentAt'),
        stamped('outreachDay7SentAt'), stamped('outreachWinbackSentAt'),
      ]),
      prisma.outreachContact.findMany({
        // Rows the recycler wrote are not work, and telling someone they have made
        // 300 calls when they have made 40 turns the whole thing into noise.
        where: { contactedAt: { gte: todayStart }, method: { not: 'expired' } },
        select: { method: true },
      }),
    ]);

    const total = handed.reduce((a, b) => a + b, 0);
    // A day with no list is a holiday, a day off, or a broken cron. None of them
    // want a message congratulating someone on a break they are not taking.
    if (!total) return Response.json({ ok: true, skipped: 'nothing handed out today' });

    const done = contacts.length;
    const left = Math.max(0, total - done);
    const reached = contacts.filter(c => c.method === 'call').length;

    await sendOutreach(buildBreakMessage(moment.kind, { total, done, left, reached }), GENERAL);
    log.info('Outreach Breaks', moment.kind);
    return Response.json({ ok: true, sent: moment.kind });
  } catch (err) {
    log.error('Outreach Breaks', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export function buildBreakMessage(kind, { total, done, left, reached }) {
  const head = (icon, title) => `${icon} <b>${title}</b>`;
  const rate = done ? pct(reached, done) : 0;
  const cleared = left === 0;

  if (kind === 'lunchStart') {
    // The tone follows the morning. Reporting a rough one cheerfully is how a
    // message like this stops being read.
    const note = rate >= 55 ? `Strong morning \u{2014} ${reached} people actually picked up.`
      : rate >= 35 ? 'Eat properly, and leave the phone on the desk.'
        : 'Quiet one on the phones. Some mornings go like that. Go and eat.';
    return [
      head('\u{1F37D}', 'Lunch \u{2014} back at 14:00'),
      '',
      row('\u{2705}', 'Done', done, `of ${total}`),
      row('\u{1F3AF}', 'Reached', reached, done ? `${rate}%` : null),
      '',
      note,
    ].join('\n');
  }

  if (kind === 'lunchEnd') {
    // Saying when the next break is saves the clock-watching that a long
    // afternoon block otherwise invites.
    return [
      head('\u{1F44B}', 'Back on'),
      '',
      row('\u{23F3}', 'Left', left),
      '',
      cleared
        ? 'List is clear. Backlog lands at 14:30 \u{2014} next break 16:00.'
        : 'Backlog lands at 14:30. Next break is 16:00.',
    ].join('\n');
  }

  if (kind === 'refreshStart') {
    return [
      head('\u{2615}', 'Thirty minutes \u{2014} back at 16:30'),
      '',
      row('\u{2705}', 'Done', done, `of ${total}`),
      '',
      // Not a platitude: 16:00 runs at a 39% reach rate against 61% in the
      // morning, which is the entire reason this break sits where it does.
      'Four o\u{2019}clock is the worst hour on the phones, every day. Leave the desk.',
    ].join('\n');
  }

  if (kind === 'refreshEnd') {
    const note = cleared ? 'Nothing outstanding. Anything new that lands is a bonus.'
      : left > 20 ? 'Whatever you don\u{2019}t reach goes back in the pool. Don\u{2019}t chase it.'
        : 'Close enough to finish. No need to rush the last few.';
    return [
      head('\u{1F44B}', 'Ninety minutes left'),
      '',
      row('\u{23F3}', 'Left', left),
      '',
      note,
    ].join('\n');
  }

  const note = cleared ? `Cleared the whole list. ${reached} real conversations \u{2014} that is the day.`
    : reached ? `${reached} real conversations today. Close it there.`
      : 'Close it there.';
  return [
    head('\u{1F319}', 'Done for today'),
    '',
    row('\u{2705}', 'Contacted', done, `of ${total}`),
    row('\u{1F3AF}', 'Reached', reached, done ? `${rate}%` : null),
    '',
    `${note} Fresh list at 09:00.`,
  ].join('\n');
}
