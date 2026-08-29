import prisma from '@/lib/prisma';
import { watBounds } from '@/lib/format';
import { log } from '@/lib/logger';
import { sendOutreach, OUTREACH_TOPICS } from '@/lib/telegram';
import { isOutreachPaused } from '@/lib/outreach-pause';

export const maxDuration = 60;

// Seven crons now run this pipeline unattended. Nothing checks that they ran:
// log.error only writes to the console, and a cron that never fires produces no
// error at all. The first signal of a silent failure is somebody noticing an
// empty topic, which could be days later.
//
// This runs after the day's lists should have gone out and reports anything that
// looks wrong. It stays quiet when everything is fine, so a message from it
// always means something needs attention.

// Duplicate accounts created before phone normalisation was consistent. Only a
// count above this is new breakage worth waking someone for.
const KNOWN_PHONE_COLLISIONS = 7;

// touch -> the hour (UTC) its list is built, and the stamp it writes.
const EXPECTED = [
  { touch: 'day1', hour: 8, field: 'outreachDay1SentAt', label: 'First Call' },
  { touch: 'winback', hour: 10, field: 'outreachWinbackSentAt', label: 'Winback' },
  { touch: 'day3', hour: 11, field: 'outreachDay3SentAt', label: 'Follow-up' },
  { touch: 'day7', hour: 13, field: 'outreachDay7SentAt', label: 'Final Nudge' },
];

// A touch that sends nothing is only a problem if it had people to send.
async function poolFor(touch) {
  const { poolWhere } = await import('@/lib/outreach-pool');
  const where = poolWhere(touch);
  if (!where) return null;
  return prisma.user.count({ where });
}

export async function GET(req) {
  const token = req.nextUrl.searchParams.get('token');
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && authHeader !== `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (await isOutreachPaused()) return Response.json({ ok: true, paused: true });

  const { todayStart } = watBounds();
  const problems = [];

  try {
    for (const e of EXPECTED) {
      const sent = await prisma.user.count({ where: { [e.field]: { gte: todayStart } } });
      if (sent > 0) continue;
      const waiting = await poolFor(e.touch);
      // Silent because there was nobody to call is fine. Silent while people are
      // waiting means the cron did not run, or ran and failed.
      if (waiting === null || waiting === 0) continue;
      problems.push(`\u{2716} <b>${e.label}</b> sent nothing, but ${waiting} were waiting (due ${String(e.hour).padStart(2, '0')}:00 UTC)`);
    }

    // Callbacks that came due and were never posted: the callbacks cron is the
    // only thing that clears callbackAt, so a backlog here means it is stuck.
    const overdue = await prisma.outreachContact.count({
      where: { callbackAt: { not: null, lt: new Date(Date.now() - 2 * 3600000) } },
    });
    if (overdue > 0) {
      problems.push(`\u{2716} <b>${overdue} callbacks</b> more than 2h overdue \u{2014} the callbacks cron may be stuck`);
    }

    // Cards handed out and never actioned. Not a failure, but worth surfacing:
    // this is the number that sat at ~80% for weeks with nothing reporting it.
    const handed = await prisma.user.count({
      where: {
        OR: EXPECTED.map(e => ({ [e.field]: { gte: todayStart } })),
      },
    });
    const worked = await prisma.outreachContact.count({
      where: { contactedAt: { gte: todayStart }, method: { not: 'expired' } },
    });
    if (handed > 0 && worked / handed < 0.5) {
      problems.push(`\u{26A0} Only <b>${worked} of ${handed}</b> cards worked today (${Math.round((worked / handed) * 100)}%)`);
    }

    // Phone is unique, but "+2340803..." and "+234803..." are different strings,
    // so a number stored without its leading zero stripped slips past the
    // constraint and lets one person hold two accounts. Every current signup path
    // normalises correctly and the last of these was created in July, but a
    // regression would otherwise go unnoticed for months.
    const withPhone = await prisma.user.findMany({
      where: { status: 'Active', phone: { not: null } },
      select: { phone: true },
    });
    const canonical = new Map();
    for (const u of withPhone) {
      const digits = String(u.phone).replace(/\D/g, '').replace(/^234/, '').replace(/^0+/, '');
      canonical.set(digits, (canonical.get(digits) || 0) + 1);
    }
    const collisions = [...canonical.values()].filter(n => n > 1).length;
    if (collisions > KNOWN_PHONE_COLLISIONS) {
      problems.push(`\u{2716} <b>${collisions} phone collisions</b> (was ${KNOWN_PHONE_COLLISIONS}) \u{2014} a signup path may have stopped normalising`);
    }

    if (problems.length) {
      await sendOutreach(
        `\u{1F6A8} <b>Outreach watchdog</b>\n\n${problems.join('\n')}`,
        OUTREACH_TOPICS.watchdog,
      );
      log.error('Outreach Watchdog', problems.join(' | '));
    }

    return Response.json({ ok: true, problems: problems.length, detail: problems });
  } catch (err) {
    log.error('Outreach Watchdog', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
