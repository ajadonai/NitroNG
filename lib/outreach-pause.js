import prisma from '@/lib/prisma';

// One switch for the whole outreach machine. While it is on, the crons that
// build daily lists, nudge callbacks, watch the day and announce breaks all
// answer { paused: true } and touch nothing, so no contact is stamped as
// "sent" while nobody is there to send. Flipped from Admin → Outreach.
export async function isOutreachPaused() {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'outreach_paused' } });
    return row?.value === 'true';
  } catch {
    return false;
  }
}
