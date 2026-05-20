import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getServices, isProviderConfigured } from '@/lib/smm';
import { calculateTierPrice } from '@/lib/markup';

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const stats = { synced: 0, updated: 0, repriced: 0, losers: 0, errors: 0 };

  try {
    const markupRows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
    const ms = {};
    markupRows.forEach(s => { ms[s.key] = s.value; });
    const usdRate = Number(ms.markup_usd_rate) || 1600;

    const providers = ['mtp', 'jap', 'dao'].filter(isProviderConfigured);
    const rateMaps = {};

    for (const pid of providers) {
      try {
        const svcs = await getServices(pid);
        if (!Array.isArray(svcs)) continue;
        rateMaps[pid] = {};
        for (const s of svcs) {
          rateMaps[pid][String(s.service)] = Math.round(parseFloat(s.rate) * 100);
        }
        stats.synced += svcs.length;
      } catch (err) {
        stats.errors++;
        log.warn('PriceSync', `Failed to fetch ${pid}: ${err.message}`);
      }
    }

    const services = await prisma.service.findMany({
      where: { enabled: true },
      select: { id: true, name: true, apiId: true, costPer1k: true, sellPer1k: true, provider: true, category: true, tiers: { where: { enabled: true }, select: { id: true, tier: true, sellPer1k: true, group: { select: { nigerian: true } } } } },
    });

    const ops = [];
    const losers = [];

    for (const s of services) {
      const rateMap = rateMaps[s.provider || 'mtp'];
      if (!rateMap) continue;

      const liveCost = rateMap[String(s.apiId)];
      if (liveCost === undefined) continue;

      const costChanged = liveCost !== s.costPer1k;
      if (costChanged) {
        stats.updated++;
      }

      if (s.tiers.length > 0) {
        for (const t of s.tiers) {
          const ng = t.group?.nigerian || false;
          const newSell = calculateTierPrice(liveCost, t.tier, ms, ng);
          if (costChanged || newSell !== t.sellPer1k) {
            ops.push(prisma.serviceTier.update({ where: { id: t.id }, data: { sellPer1k: newSell } }));
            stats.repriced++;
          }
          const costKobo = liveCost * usdRate;
          if (newSell > 0 && newSell < costKobo) {
            losers.push({ service: s.name.slice(0, 50), category: s.category, tier: t.tier, costNaira: Math.round(costKobo / 100), sellNaira: Math.round(newSell / 100), lossPerK: Math.round(costKobo / 100) - Math.round(newSell / 100) });
          }
        }
      } else {
        const newSell = calculateTierPrice(liveCost, 'Standard', ms, false);
        if (costChanged || newSell !== s.sellPer1k) {
          stats.repriced++;
        }
        const costKobo = liveCost * usdRate;
        if (newSell > 0 && newSell < costKobo) {
          losers.push({ service: s.name.slice(0, 50), category: s.category, tier: null, costNaira: Math.round(costKobo / 100), sellNaira: Math.round(newSell / 100), lossPerK: Math.round(costKobo / 100) - Math.round(newSell / 100) });
        }
      }

      const baseNewSell = s.tiers.length === 0 ? calculateTierPrice(liveCost, 'Standard', ms, false) : s.sellPer1k;
      if (costChanged || (s.tiers.length === 0 && baseNewSell !== s.sellPer1k)) {
        ops.push(prisma.service.update({ where: { id: s.id }, data: { costPer1k: liveCost, ...(s.tiers.length === 0 ? { sellPer1k: baseNewSell } : {}) } }));
      }
    }

    if (ops.length > 0) {
      for (let i = 0; i < ops.length; i += 50) {
        await prisma.$transaction(ops.slice(i, i + 50));
      }
    }

    stats.losers = losers.length;

    await prisma.setting.upsert({
      where: { key: 'price_alerts' },
      update: { value: JSON.stringify({ losers, checkedAt: new Date().toISOString(), usdRate }) },
      create: { key: 'price_alerts', value: JSON.stringify({ losers, checkedAt: new Date().toISOString(), usdRate }) },
    });

    if (losers.length > 0) {
      await prisma.activityLog.create({
        data: { adminName: 'System', action: `Price sync: ${losers.length} services still below cost after reprice`, type: 'alert' },
      });
    }

    log.info('PriceSync', `Synced ${stats.synced}, updated ${stats.updated} costs, repriced ${stats.repriced}, ${stats.losers} losers`);
    return Response.json({ success: true, ...stats, losers: losers.slice(0, 20) });
  } catch (err) {
    log.error('PriceSync', err.stack || err.message);
    return Response.json({ error: err.message || 'Price sync failed' }, { status: 500 });
  }
}
