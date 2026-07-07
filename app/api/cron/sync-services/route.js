export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getServices, isProviderConfigured, getProviderName, PROVIDER_IDS } from '@/lib/smm';
import { calculateTierPrice } from '@/lib/markup';

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

const SETTING_KEY = 'cron_sync_services_state';

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const configured = PROVIDER_IDS.filter(isProviderConfigured);
    if (configured.length === 0) return Response.json({ skipped: true, reason: 'No providers configured' });

    const now = new Date();
    const weekKey = `${now.getUTCFullYear()}-W${Math.ceil(((now - new Date(now.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)}`;

    const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    let state = {};
    try { state = JSON.parse(setting?.value || '{}'); } catch {}

    if (state.week === weekKey && state.done?.length >= configured.length) {
      return Response.json({ skipped: true, reason: 'All providers synced this week', week: weekKey, done: state.done });
    }

    if (state.week !== weekKey) state = { week: weekKey, done: [] };

    const next = configured.find(p => !state.done.includes(p));
    if (!next) return Response.json({ skipped: true, reason: 'All providers synced this week' });

    const providerServices = await getServices(next);
    if (!Array.isArray(providerServices)) {
      log.warn('CronSync', `Invalid response from ${getProviderName(next)}`);
      return Response.json({ error: `Invalid response from ${getProviderName(next)}` }, { status: 500 });
    }

    const markupRows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
    const ms = {};
    markupRows.forEach(s => { ms[s.key] = s.value; });
    const markupSetting = await prisma.setting.findUnique({ where: { key: 'defaultMarkup' } });
    const defaultMarkup = Number(markupSetting?.value) || 54;

    const existing = await prisma.service.findMany({
      where: { provider: next },
      select: { id: true, apiId: true, name: true, category: true, costPer1k: true, min: true, max: true, refill: true, dripfeed: true, avgTime: true },
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
      const dripfeed = svc.dripfeed === true || svc.dripfeed === 'true';
      const avgTime = svc.average_time || '0-2 hrs';

      const ex = existingMap[apiId];
      if (ex) {
        if (ex.name === svc.name && ex.category === category && Number(ex.costPer1k) === costPer1k && ex.min === min && ex.max === max && ex.refill === refill && ex.dripfeed === dripfeed && ex.avgTime === avgTime) {
          unchanged++;
          continue;
        }
        toUpdate.push(prisma.service.update({ where: { id: ex.id }, data: { name: svc.name, category, costPer1k, min, max, refill, dripfeed, avgTime } }));
        updated++;
      } else {
        const initialSell = calculateTierPrice(costPer1k, 'Standard', ms, false) || Math.round(costPer1k * 2);
        toCreate.push({
          apiId, name: svc.name, category, costPer1k, min, max, refill, dripfeed, avgTime, provider: next, sellPer1k: initialSell, markup: defaultMarkup, enabled: false,
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
      const result = await prisma.service.updateMany({
        where: { id: { in: staleServices.map(s => s.id) }, enabled: true },
        data: { enabled: false },
      });
      disabled = result.count;
    }

    state.done.push(next);
    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(state) },
      create: { key: SETTING_KEY, value: JSON.stringify(state) },
    });

    log.info('CronSync', `${getProviderName(next)}: ${created} new, ${updated} updated, ${disabled} disabled (${state.done.length}/${configured.length} done for ${weekKey})`);

    return Response.json({
      provider: next,
      providerName: getProviderName(next),
      total: providerServices.length,
      created, updated, unchanged, skipped, disabled,
      week: weekKey,
      done: state.done,
      remaining: configured.filter(p => !state.done.includes(p)),
    });
  } catch (err) {
    log.error('CronSync', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
