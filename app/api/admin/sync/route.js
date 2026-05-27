import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';
import { getServices, getBalance, isProviderConfigured, getProviderName, checkOrder } from '@/lib/smm';
import { placeWithProvider } from '@/lib/bulk-dispatch';
import { calculateTierPrice } from '@/lib/markup';

export const maxDuration = 60;

export async function GET() {
  const { admin, error } = await requireAdmin('services');
  if (error) return error;

  return Response.json({
    status: {
      mtp: isProviderConfigured('mtp'),
      jap: isProviderConfigured('jap'),
      dao: isProviderConfigured('dao'),
    },
  });
}

export async function POST(req) {
  const { admin, error } = await requireAdmin('services', true);
  if (error) return error;

  try {
    const body = await req.json();
    const { action, provider: pid } = body;
    const VALID_PROVIDERS = ['mtp', 'jap', 'dao'];

    if (action === 'test') {
      const providerId = pid || 'mtp';
      if (!VALID_PROVIDERS.includes(providerId)) return Response.json({ error: `Unknown provider: ${providerId}. Use: ${VALID_PROVIDERS.join(', ')}` }, { status: 400 });
      if (!isProviderConfigured(providerId)) return Response.json({ error: `${getProviderName(providerId)} API key not set` }, { status: 400 });
      const balance = await getBalance(providerId);
      return Response.json({ success: true, balance });
    }

    if (action === 'sync') {
      const providerId = pid || 'mtp';
      if (!VALID_PROVIDERS.includes(providerId)) return Response.json({ error: `Unknown provider: ${providerId}. Use: ${VALID_PROVIDERS.join(', ')}` }, { status: 400 });
      if (!isProviderConfigured(providerId)) return Response.json({ error: `${getProviderName(providerId)} API key not set` }, { status: 400 });

      const providerServices = await getServices(providerId);

      if (!Array.isArray(providerServices)) {
        return Response.json({ error: `Invalid response from ${getProviderName(providerId)}` }, { status: 400 });
      }

      const markupSetting = await prisma.setting.findUnique({ where: { key: 'defaultMarkup' } });
      const defaultMarkup = Number(markupSetting?.value) || 54;

      // Pre-load markup settings for price calculation
      const { calculateTierPrice } = await import('@/lib/markup');
      const markupRows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
      const ms = {};
      markupRows.forEach(s => { ms[s.key] = s.value; });

      const existing = await prisma.service.findMany({
        where: { provider: providerId },
        select: { id: true, apiId: true, markup: true, name: true, category: true, costPer1k: true, min: true, max: true, refill: true, avgTime: true },
      });
      const existingMap = {};
      existing.forEach(s => { existingMap[s.apiId] = s; });

      let created = 0, updated = 0, unchanged = 0, skipped = 0;
      const toCreate = [];
      const toUpdate = [];

      for (const svc of providerServices) {
        const apiId = Number(svc.service);
        if (!apiId) { skipped++; continue; }

        const rawCost = Math.round(parseFloat(svc.rate) * 100);
        if (rawCost > 2000000000 || rawCost < 0 || isNaN(rawCost)) { skipped++; continue; }
        const costPer1k = rawCost;
        const category = categorize(svc.category);
        const min = Number(svc.min) || 10;
        const max = Number(svc.max) || 100000;
        const refill = svc.refill === true || svc.refill === 'true';
        const avgTime = svc.average_time || '0-2 hrs';

        const ex = existingMap[apiId];
        if (ex) {
          if (ex.name === svc.name && ex.category === category && ex.costPer1k === costPer1k && ex.min === min && ex.max === max && ex.refill === refill && ex.avgTime === avgTime) {
            unchanged++;
            continue;
          }
          toUpdate.push(prisma.service.update({ where: { id: ex.id }, data: { name: svc.name, category, costPer1k, min, max, refill, avgTime } }));
          updated++;
        } else {
          const initialSell = calculateTierPrice(costPer1k, 'Standard', ms, false) || Math.round(costPer1k * 2);
          toCreate.push({
            apiId, name: svc.name, category, costPer1k, min, max, refill, avgTime, provider: providerId, sellPer1k: initialSell, markup: defaultMarkup, enabled: false,
          });
          created++;
        }
      }

      if (toCreate.length > 0) {
        await prisma.service.createMany({ data: toCreate, skipDuplicates: true });
      }

      for (let i = 0; i < toUpdate.length; i += 200) {
        await Promise.all(toUpdate.slice(i, i + 200));
      }

      const liveApiIds = new Set(providerServices.map(s => Number(s.service)).filter(Boolean));
      const staleServices = existing.filter(s => s.apiId && !liveApiIds.has(s.apiId));
      let disabled = 0;
      if (staleServices.length > 0) {
        const staleIds = staleServices.map(s => s.id);
        const result = await prisma.service.updateMany({
          where: { id: { in: staleIds }, enabled: true },
          data: { enabled: false },
        });
        disabled = result.count;
      }

      await logActivity(admin.name, `Synced from ${getProviderName(providerId)}: ${created} new, ${updated} updated, ${skipped} skipped, ${disabled} disabled (removed by provider)`, 'service');

      return Response.json({ success: true, provider: providerId, total: providerServices.length, created, updated, skipped, disabled });
    }

    if (action === 'sync-orders') {
      const stats = { checked: 0, updated: 0, refunded: 0, dispatched: 0, errors: 0 };

      // 1. Check status of orders already placed with providers
      const activeOrders = await prisma.order.findMany({
        where: {
          status: { in: ['Processing', 'Pending', 'In progress'] },
          apiOrderId: { not: null },
          deletedAt: null,
        },
        include: { service: { select: { provider: true } } },
        take: 200,
        orderBy: { createdAt: 'asc' },
      });

      const byProvider = {};
      for (const order of activeOrders) {
        const provider = order.service?.provider || 'mtp';
        if (!byProvider[provider]) byProvider[provider] = [];
        byProvider[provider].push(order);
      }

      for (const [provider, orders] of Object.entries(byProvider)) {
        if (!isProviderConfigured(provider)) {
          stats.errors += orders.length;
          continue;
        }
        for (const order of orders) {
          try {
            stats.checked++;
            const result = await checkOrder(provider, order.apiOrderId);
            const providerStatus = (result.status || '').toLowerCase();
            let newStatus = null;

            if (['completed', 'complete'].includes(providerStatus)) newStatus = 'Completed';
            else if (['partial', 'partially completed'].includes(providerStatus)) newStatus = 'Partial';
            else if (['cancelled', 'canceled', 'refunded'].includes(providerStatus)) newStatus = 'Cancelled';
            else if (['in progress', 'inprogress', 'processing', 'pending'].includes(providerStatus)) newStatus = 'Processing';

            const liveRemains = result.remains != null ? Number(result.remains) : null;

            if (!newStatus && liveRemains != null && liveRemains !== order.remains) {
              await prisma.order.update({ where: { id: order.id }, data: { remains: liveRemains } });
              continue;
            }

            if (!newStatus || newStatus === order.status) continue;

            await prisma.order.update({ where: { id: order.id }, data: { status: newStatus, ...(liveRemains != null ? { remains: liveRemains } : {}) } });
            stats.updated++;

            if (newStatus === 'Cancelled' && order.charge > 0) {
              const exists = await prisma.transaction.findFirst({ where: { userId: order.userId, type: 'refund', reference: `REF-${order.orderId}` } });
              if (!exists) {
                await prisma.$transaction(async (tx) => {
                  await tx.$executeRaw`UPDATE users SET balance = balance + ${order.charge} WHERE id = ${order.userId}`;
                  await tx.transaction.create({ data: { userId: order.userId, type: 'refund', amount: order.charge, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Auto-refund for cancelled order ${order.orderId}` } });
                });
                stats.refunded++;
              }
            }

            if (newStatus === 'Partial' && result.remains) {
              const remains = Number(result.remains) || 0;
              if (remains > 0 && order.charge > 0 && order.quantity > 0) {
                const refundAmount = Math.round((remains / order.quantity) * order.charge);
                if (refundAmount > 0) {
                  const exists = await prisma.transaction.findFirst({ where: { userId: order.userId, type: 'refund', reference: `REF-${order.orderId}` } });
                  if (!exists) {
                    await prisma.$transaction(async (tx) => {
                      await tx.$executeRaw`UPDATE users SET balance = balance + ${refundAmount} WHERE id = ${order.userId}`;
                      await tx.transaction.create({ data: { userId: order.userId, type: 'refund', amount: refundAmount, method: 'wallet', status: 'Completed', reference: `REF-${order.orderId}`, note: `Partial refund for ${order.orderId}` } });
                    });
                    stats.refunded++;
                  }
                }
              }
            }
          } catch (err) {
            stats.errors++;
            log.warn(`Sync order ${order.orderId}`, err.message);
          }
          await new Promise(r => setTimeout(r, 200));
        }
      }

      // 2. Dispatch pending orders that haven't been placed with a provider yet
      const undispatched = await prisma.order.findMany({
        where: {
          status: 'Pending', apiOrderId: null, deletedAt: null,
          retryCount: { lt: 5 },
          createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        include: { service: true, tier: { include: { group: true } } },
        take: 50, orderBy: { createdAt: 'asc' },
      });

      for (const order of undispatched) {
        if (order.link && order.serviceId) {
          const blocking = await prisma.order.findFirst({
            where: { serviceId: order.serviceId, link: order.link, status: { in: ['Pending', 'Processing', 'In progress'] }, apiOrderId: { not: null }, id: { not: order.id }, deletedAt: null },
          });
          if (blocking) continue;
        }
        const claimed = await prisma.order.updateMany({
          where: { id: order.id, status: 'Pending', apiOrderId: null },
          data: { status: 'Dispatching', dispatchedAt: new Date() },
        });
        if (claimed.count === 0) continue;
        try {
          const apiOrderId = await placeWithProvider({ id: order.id, service: order.service, tier: order.tier, link: order.link, quantity: order.quantity, comments: order.comments });
          if (apiOrderId) { stats.dispatched++; }
          else { await prisma.order.update({ where: { id: order.id }, data: { status: 'Pending', retryCount: { increment: 1 } } }); }
        } catch (err) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'Pending', retryCount: { increment: 1 }, lastError: err.message.slice(0, 500) } });
          stats.errors++;
          log.warn(`Dispatch ${order.orderId}`, err.message);
        }
        await new Promise(r => setTimeout(r, 300));
      }

      await logActivity(admin.name, `Synced orders: ${stats.checked} checked, ${stats.updated} updated, ${stats.refunded} refunded, ${stats.dispatched} dispatched`, 'order');
      return Response.json({ success: true, ...stats });
    }

    if (action === 'sync-prices') {
      const markupRows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
      const ms = {};
      markupRows.forEach(s => { ms[s.key] = s.value; });
      const usdRate = Number(ms.markup_usd_rate) || 1600;

      const configuredProviders = ['mtp', 'jap', 'dao'].filter(isProviderConfigured);
      const rateMaps = {};
      const stats = { synced: 0, updated: 0, repriced: 0, losers: 0, errors: 0 };

      for (const p of configuredProviders) {
        try {
          const svcs = await getServices(p);
          if (!Array.isArray(svcs)) continue;
          rateMaps[p] = {};
          for (const s of svcs) rateMaps[p][String(s.service)] = Math.round(parseFloat(s.rate) * 100);
          stats.synced += svcs.length;
        } catch (err) {
          stats.errors++;
          log.warn('PriceSync', `Failed to fetch ${p}: ${err.message}`);
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
        const liveCost = rateMap?.[String(s.apiId)];
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

      await prisma.setting.upsert({
        where: { key: 'price_alerts' },
        update: { value: JSON.stringify({ losers, checkedAt: new Date().toISOString(), usdRate }) },
        create: { key: 'price_alerts', value: JSON.stringify({ losers, checkedAt: new Date().toISOString(), usdRate }) },
      });

      await logActivity(admin.name, `Price sync: ${stats.updated} costs updated, ${stats.repriced} repriced, ${stats.losers} below cost`, 'service');

      return Response.json({ success: true, ...stats, losers: losers.slice(0, 20) });
    }

    if (action === 'test-order') {
      const { serviceId, provider: testProvider, link, quantity } = body;
      if (!serviceId || !link || !quantity) return Response.json({ error: 'Need serviceId, link, quantity' }, { status: 400 });
      const providerId = testProvider || 'jap';
      if (!isProviderConfigured(providerId)) return Response.json({ error: `${getProviderName(providerId)} not configured` }, { status: 400 });

      const { placeOrder, getBalance: getBal } = await import('@/lib/smm');
      const balBefore = await getBal(providerId).catch(e => ({ error: e.message }));
      try {
        const result = await placeOrder(providerId, serviceId, link, quantity);
        const balAfter = await getBal(providerId).catch(e => ({ error: e.message }));
        return Response.json({ success: true, result, balanceBefore: balBefore, balanceAfter: balAfter });
      } catch (err) {
        const balAfter = await getBal(providerId).catch(e => ({ error: e.message }));
        return Response.json({ success: false, error: err.message, balanceBefore: balBefore, balanceAfter: balAfter, request: { provider: providerId, serviceId, link, quantity } });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('Sync', err.stack || err.message);
    return Response.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

function categorize(cat) {
  if (!cat) return 'Other';
  const c = cat.toLowerCase();
  if (c.includes('instagram')) return 'Instagram';
  if (c.includes('tiktok') || c.includes('tik tok')) return 'TikTok';
  if (c.includes('youtube')) return 'YouTube';
  if (c.includes('twitter') || c.includes('/x')) return 'Twitter/X';
  if (c.includes('facebook') || c.includes('fb')) return 'Facebook';
  if (c.includes('telegram')) return 'Telegram';
  if (c.includes('spotify')) return 'Spotify';
  if (c.includes('snapchat')) return 'Snapchat';
  if (c.includes('linkedin')) return 'LinkedIn';
  if (c.includes('pinterest')) return 'Pinterest';
  if (c.includes('twitch')) return 'Twitch';
  if (c.includes('discord')) return 'Discord';
  if (c.includes('thread')) return 'Threads';
  if (c.includes('audiomack')) return 'Audiomack';
  if (c.includes('boomplay')) return 'Boomplay';
  if (c.includes('apple music')) return 'Apple Music';
  if (c.includes('whatsapp')) return 'WhatsApp';
  if (c.includes('soundcloud')) return 'SoundCloud';
  if (c.includes('reddit')) return 'Reddit';
  if (c.includes('quora')) return 'Quora';
  return cat.split(' ')[0] || 'Other';
}
