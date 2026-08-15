// Who is eligible for each touch. Shared by the daily cron and the webhook's
// replacement pull so the two can never drift apart.
import prisma from '@/lib/prisma';

const DAY = 86400000;
const ACTIVE = { status: 'Active', outreachOptedOutAt: null };
const NO_MONEY = {
  transactions: { none: { type: 'deposit', status: 'Completed' } },
  orders: { none: {} },
};

// Backlog reuses day1's stamp, so a backlog contact is a day1 contact that was
// never worked. That is why the two share a field here.
export const STAMP_FIELD = {
  day1: 'outreachDay1SentAt',
  day3: 'outreachDay3SentAt',
  day7: 'outreachDay7SentAt',
  winback: 'outreachWinbackSentAt',
  backlog: 'outreachDay1SentAt',
};

// Returns null for winback, whose eligibility depends on granted bonus credit
// and is built inline by the cron.
export function poolWhere(touch, now = Date.now()) {
  switch (touch) {
    case 'day1':
      return {
        ...ACTIVE,
        outreachDay1SentAt: null,
        phone: { not: null },
        createdAt: { gte: new Date(now - 4 * DAY), lt: new Date(now - DAY) },
        ...NO_MONEY,
      };
    case 'day3':
      return {
        ...ACTIVE,
        outreachDay3SentAt: null,
        outreachDay1SentAt: { not: null, lt: new Date(now - 3 * DAY) },
        ...NO_MONEY,
      };
    // Keyed off the day3 stamp, not day1, so the sequence cannot skip a step.
    // Keying off day1 let someone 8 days in match day3 and day7 at once and get
    // two calls an hour apart with two different scripts.
    case 'day7':
      return {
        ...ACTIVE,
        outreachDay7SentAt: null,
        outreachDay3SentAt: { not: null, lt: new Date(now - 4 * DAY) },
        ...NO_MONEY,
      };
    case 'backlog':
      return { ...ACTIVE, outreachDay1SentAt: null, phone: { not: null }, ...NO_MONEY };
    default:
      return null;
  }
}

// Pulls fresh contacts to replace ones that turned out to be unusable, stamping
// them so the same person can never be handed out twice. Requires a phone,
// since a replacement without one just wastes the slot again.
export async function pullReplacements(touch, count = 1) {
  const where = poolWhere(touch);
  const field = STAMP_FIELD[touch];
  if (!where || !field || count < 1) return [];

  let batch = await prisma.user.findMany({
    where: { ...where, phone: { not: null } },
    select: { id: true, name: true, phone: true },
    take: count,
  });

  // day1 is a strict subset of backlog: same "never contacted, never paid" people,
  // same script, same stamp field, differing only by signup age. So when the fresh
  // window runs dry an older uncontacted user is a valid stand-in. No other touch
  // can fall back this way, because day3 and day7 require a prior call that a
  // backlog contact has never had.
  if (!batch.length && touch === 'day1') {
    batch = await prisma.user.findMany({
      where: { ...poolWhere('backlog'), phone: { not: null } },
      select: { id: true, name: true, phone: true },
      take: count,
    });
  }
  if (!batch.length) return [];

  const at = new Date();
  await Promise.allSettled(batch.map(u =>
    prisma.user.update({ where: { id: u.id }, data: { [field]: at } })
  ));
  return batch;
}
