import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { requireAdmin, logActivity } from '@/lib/admin';
import { getServices, getBalance, isProviderConfigured, getProviderName } from '@/lib/smm';

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
    const { action, provider: pid } = await req.json();
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

      // Scope by provider — different providers can have same apiId numbers
      const existing = await prisma.service.findMany({
        where: { provider: providerId },
        select: { id: true, apiId: true, markup: true },
      });
      const existingMap = {};
      existing.forEach(s => { existingMap[s.apiId] = s; });

      let created = 0, updated = 0, skipped = 0;
      const toCreate = [];
      const toUpdate = [];

      for (const svc of providerServices) {
        const apiId = Number(svc.service);
        if (!apiId) { skipped++; continue; }

        const rawCost = Math.round(parseFloat(svc.rate) * 100);
        if (rawCost > 2000000000 || rawCost < 0 || isNaN(rawCost)) { skipped++; continue; }
        const costPer1k = rawCost;
        const category = categorize(svc.category);
        const data = {
          name: svc.name,
          category,
          costPer1k,
          min: Number(svc.min) || 10,
          max: Number(svc.max) || 100000,
          refill: svc.refill === true || svc.refill === 'true',
          avgTime: svc.average_time || '0-2 hrs',
        };

        const ex = existingMap[apiId];
        if (ex) {
          toUpdate.push(prisma.service.update({ where: { id: ex.id }, data }));
          updated++;
        } else {
          const initialSell = calculateTierPrice(costPer1k, 'Standard', ms, false) || Math.round(costPer1k * 2);
          toCreate.push({
            apiId, ...data, provider: providerId, sellPer1k: initialSell, markup: defaultMarkup, enabled: false,
          });
          created++;
        }
      }

      const ops = [...toUpdate];
      if (toCreate.length > 0) {
        ops.push(prisma.service.createMany({ data: toCreate, skipDuplicates: true }));
      }

      if (ops.length > 0) {
        for (let i = 0; i < ops.length; i += 50) {
          await prisma.$transaction(ops.slice(i, i + 50));
        }
      }

      await logActivity(admin.name, `Synced from ${getProviderName(providerId)}: ${created} new, ${updated} updated, ${skipped} skipped`, 'service');

      return Response.json({ success: true, provider: providerId, total: providerServices.length, created, updated, skipped });
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
