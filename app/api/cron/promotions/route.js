import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { sendPromotionBlast } from '@/lib/email';

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // SCHEDULED → ACTIVE when startAt has passed
    const activated = await prisma.platformCampaign.updateMany({
      where: { status: 'SCHEDULED', startAt: { lte: now } },
      data: { status: 'ACTIVE' },
    });

    // ACTIVE → ENDED when endAt has passed
    const ended = await prisma.platformCampaign.updateMany({
      where: { status: 'ACTIVE', endAt: { lt: now } },
      data: { status: 'ENDED' },
    });

    if (activated.count || ended.count) {
      log.info('PromoCron', `Activated ${activated.count}, ended ${ended.count}`);
    }

    // Send email blast for newly active promos that haven't been emailed
    let emailed = 0;
    const unemaledActive = await prisma.platformCampaign.findMany({
      where: { status: 'ACTIVE', emailedAt: null },
    });
    for (const promo of unemaledActive) {
      try {
        const sent = await sendPromotionBlast(promo);
        await prisma.platformCampaign.update({
          where: { id: promo.id },
          data: { emailedAt: new Date() },
        });
        emailed++;
        log.info('PromoCron', `Emailed "${promo.name}" to ${sent} users`);
      } catch (err) {
        log.error('PromoCron', `Email failed for "${promo.name}": ${err.message}`);
      }
    }

    return Response.json({ activated: activated.count, ended: ended.count, emailed });
  } catch (err) {
    log.error('PromoCron', err.message);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
