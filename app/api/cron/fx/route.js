export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { tgFxUpdate } from '@/lib/telegram';

const API_URL = 'https://open.er-api.com/v6/latest/USD';
const DEFAULT_BUFFER = 200;
const DEFAULT_THRESHOLD = 20;
const MIN_RATE = 800;
const MAX_RATE = 5000;

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const marketRate = data?.rates?.NGN;
    if (!marketRate || typeof marketRate !== 'number' || marketRate < MIN_RATE || marketRate > MAX_RATE) {
      throw new Error(`Invalid rate from API: ${marketRate}`);
    }

    const [bufferRow, thresholdRow, currentRow, currentMarketRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'markup_usd_buffer' } }),
      prisma.setting.findUnique({ where: { key: 'markup_fx_threshold' } }),
      prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } }),
      prisma.setting.findUnique({ where: { key: 'markup_usd_market' } }),
    ]);
    const buffer = Number(bufferRow?.value) || DEFAULT_BUFFER;
    const threshold = Number(thresholdRow?.value) || DEFAULT_THRESHOLD;
    const currentRate = Number(currentRow?.value) || 0;
    const currentMarket = Number(currentMarketRow?.value) || 0;

    const roundedMarket = Math.round(marketRate);
    const drift = Math.abs(roundedMarket - currentMarket);

    if (drift < threshold) {
      return Response.json({ success: true, skipped: true, reason: `Market moved ₦${drift} (below ₦${threshold} threshold)`, rate: currentRate, market: roundedMarket, buffer });
    }

    const newRate = roundedMarket + buffer;

    await Promise.all([
      prisma.setting.upsert({
        where: { key: 'markup_usd_rate' },
        update: { value: String(newRate) },
        create: { key: 'markup_usd_rate', value: String(newRate) },
      }),
      prisma.setting.upsert({
        where: { key: 'markup_usd_market' },
        update: { value: String(roundedMarket) },
        create: { key: 'markup_usd_market', value: String(roundedMarket) },
      }),
    ]);

    await prisma.activityLog.create({
      data: { adminName: 'System', action: `FX rate updated: ₦${currentRate} → ₦${newRate} (market ₦${Math.round(marketRate)} + ₦${buffer} buffer)`, type: 'system' },
    });

    // Trigger reprice now that the rate changed
    let repriceResult = null;
    try {
      const origin = new URL(req.url).origin;
      const priceRes = await fetch(`${origin}/api/cron/prices`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      repriceResult = await priceRes.json().catch(() => ({}));
      log.info('FX', `Reprice triggered: ${repriceResult.repriced || 0} repriced`);
    } catch (err) {
      log.warn('FX', `Reprice trigger failed: ${err.message}`);
    }

    tgFxUpdate(currentRate, newRate, roundedMarket, buffer);
    log.info('FX', `Rate updated: ${currentRate} → ${newRate} (market ${Math.round(marketRate)} + ${buffer})`);
    return Response.json({ success: true, previous: currentRate, rate: newRate, market: Math.round(marketRate), buffer, repriceResult });
  } catch (err) {
    log.error('FX', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
