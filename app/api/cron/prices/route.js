export const maxDuration = 60;

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
    const deadServices = [];

    for (const s of services) {
      const pid = s.provider || 'mtp';
      const rateMap = rateMaps[pid];
      const liveCost = rateMap?.[String(s.apiId)];
      if (rateMap && s.apiId && liveCost === undefined) {
        deadServices.push({ serviceId: s.id, name: s.name, apiId: s.apiId, provider: pid, category: s.category });
      }
      const cost = liveCost !== undefined ? liveCost : s.costPer1k;
      const costChanged = liveCost !== undefined && liveCost !== s.costPer1k;
      if (costChanged) stats.updated++;

      const costKobo = cost * usdRate;

      if (s.tiers.length > 0) {
        for (const t of s.tiers) {
          const ng = t.group?.nigerian || false;
          const newSell = calculateTierPrice(cost, t.tier, ms, ng);
          if (newSell !== t.sellPer1k) {
            ops.push(prisma.serviceTier.update({ where: { id: t.id }, data: { sellPer1k: newSell } }));
            stats.repriced++;
          }
          if (newSell > 0 && newSell < costKobo) {
            losers.push({ service: s.name.slice(0, 50), category: s.category, tier: t.tier, costNaira: Math.round(costKobo / 100), sellNaira: Math.round(newSell / 100), lossPerK: Math.round(costKobo / 100) - Math.round(newSell / 100) });
          }
        }
      }

      const baseNewSell = s.tiers.length === 0 ? calculateTierPrice(cost, 'Standard', ms, false) : s.sellPer1k;
      if (costChanged || (s.tiers.length === 0 && baseNewSell !== s.sellPer1k)) {
        ops.push(prisma.service.update({ where: { id: s.id }, data: { ...(costChanged ? { costPer1k: liveCost } : {}), ...(s.tiers.length === 0 ? { sellPer1k: baseNewSell } : {}) } }));
        if (s.tiers.length === 0 && baseNewSell !== s.sellPer1k) stats.repriced++;
      } else if (costChanged) {
        ops.push(prisma.service.update({ where: { id: s.id }, data: { costPer1k: liveCost } }));
      }

      if (s.tiers.length === 0 && baseNewSell > 0 && baseNewSell < costKobo) {
        losers.push({ service: s.name.slice(0, 50), category: s.category, tier: null, costNaira: Math.round(costKobo / 100), sellNaira: Math.round(baseNewSell / 100), lossPerK: Math.round(costKobo / 100) - Math.round(baseNewSell / 100) });
      }
    }

    if (ops.length > 0) {
      for (let i = 0; i < ops.length; i += 50) {
        await prisma.$transaction(ops.slice(i, i + 50));
      }
    }

    stats.losers = losers.length;
    stats.dead = deadServices.length;

    if (deadServices.length > 0) {
      try {
        const existingIssue = await prisma.adminIssue.findFirst({
          where: { type: 'dead_service', status: 'open' },
        });
        const title = `${deadServices.length} service${deadServices.length > 1 ? 's' : ''} removed by provider`;
        const message = deadServices.map(d => `${d.name} (${d.provider.toUpperCase()} #${d.apiId})`).join('\n');
        const metadata = JSON.stringify({ count: deadServices.length, services: deadServices });
        if (existingIssue) {
          await prisma.adminIssue.update({
            where: { id: existingIssue.id },
            data: { title, message, metadata, createdAt: new Date() },
          });
        } else {
          await prisma.adminIssue.create({
            data: { type: 'dead_service', title, message, metadata },
          });
        }
      } catch (err) {
        log.warn('PriceSync', `Failed to create dead service issues: ${err.message}`);
      }
    }

    await prisma.setting.upsert({
      where: { key: 'price_alerts' },
      update: { value: JSON.stringify({ losers, checkedAt: new Date().toISOString(), usdRate }) },
      create: { key: 'price_alerts', value: JSON.stringify({ losers, checkedAt: new Date().toISOString(), usdRate }) },
    });

    if (losers.length > 0) {
      await prisma.activityLog.create({
        data: { adminName: 'System', action: `Price sync: ${losers.length} services still below cost after reprice`, type: 'alert' },
      });
      try {
        const existingAlert = await prisma.adminIssue.findFirst({
          where: { type: 'price_alert', status: 'open' },
        });
        if (existingAlert) {
          await prisma.adminIssue.update({
            where: { id: existingAlert.id },
            data: {
              title: `${losers.length} service${losers.length > 1 ? 's' : ''} selling below cost`,
              message: losers.slice(0, 10).map(l => `${l.service} (${l.tier || 'base'}) — sell ₦${l.sellNaira.toLocaleString()} vs cost ₦${l.costNaira.toLocaleString()}, losing ₦${l.lossPerK.toLocaleString()}/1K`).join('\n'),
              metadata: JSON.stringify({ count: losers.length, usdRate, losers: losers.slice(0, 20) }),
              createdAt: new Date(),
            },
          });
        } else {
          await prisma.adminIssue.create({
            data: {
              type: 'price_alert',
              title: `${losers.length} service${losers.length > 1 ? 's' : ''} selling below cost`,
              message: losers.slice(0, 10).map(l => `${l.service} (${l.tier || 'base'}) — sell ₦${l.sellNaira.toLocaleString()} vs cost ₦${l.costNaira.toLocaleString()}, losing ₦${l.lossPerK.toLocaleString()}/1K`).join('\n'),
              metadata: JSON.stringify({ count: losers.length, usdRate, losers: losers.slice(0, 20) }),
            },
          });
        }
      } catch (err) {
        log.warn('PriceSync', `Failed to create price alert issue: ${err.message}`);
      }
    }

    log.info('PriceSync', `Synced ${stats.synced}, updated ${stats.updated} costs, repriced ${stats.repriced}, ${stats.losers} losers, ${stats.dead} dead`);
    return Response.json({ success: true, ...stats, losers: losers.slice(0, 20) });
  } catch (err) {
    log.error('PriceSync', err.stack || err.message);
    return Response.json({ error: err.message || 'Price sync failed' }, { status: 500 });
  }
}
