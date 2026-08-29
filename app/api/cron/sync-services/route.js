export const maxDuration = 60;

import prisma from '@/lib/prisma';
import { mintMissingResellerIds } from '@/lib/reseller-ids';
import { log } from '@/lib/logger';
import { getServices, isProviderConfigured, getProviderName, PROVIDER_IDS } from '@/lib/smm';
import { invalidateServiceCatalogue } from '@/lib/service-catalog';
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
  // The fallback used to take the provider category's first word verbatim,
  // which minted categories literally named after suppliers — 436 services
  // carried "MoreThanPanel" as their category. Anything smelling of a provider
  // collapses to Other.
  const word = cat.split(' ')[0] || 'Other';
  return /morethanpanel|daosmm|panel|\bjap\b|\bmtp\b|\bdao\b/i.test(word) ? 'Other' : word;
}

const SETTING_KEY = 'cron_sync_services_state';

// Services the provider lists that we have never recorded. Capped per run because
// a first pass can find hundreds and every one needs a price computed.
const MAX_NEW_PER_RUN = 400;

// Writes go out in batches; this bounds how long the run spends on them so a
// large diff stops cleanly instead of being killed mid-batch by maxDuration.
const WRITE_BUDGET_MS = 40_000;
const BATCH = 200;

export async function GET(req) {
  if (!process.env.CRON_SECRET) return Response.json({ error: 'Not configured' }, { status: 503 });
  const secret = req.headers.get('authorization')?.replace('Bearer ', '');
  if (secret !== process.env.CRON_SECRET) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const configured = PROVIDER_IDS.filter(isProviderConfigured);
    if (configured.length === 0) return Response.json({ skipped: true, reason: 'No providers configured' });

    // Keyed by day rather than by half-week: provider prices and availability move
    // daily, and the old cadence let a retired service stay orderable for days.
    const now = new Date();
    const weekKey = now.toISOString().slice(0, 10);

    const setting = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    let state = {};
    try { state = JSON.parse(setting?.value || '{}'); } catch {}

    if (state.week === weekKey && state.done?.length >= configured.length) {
      return Response.json({ skipped: true, reason: 'All providers synced today', week: weekKey, done: state.done });
    }

    if (state.week !== weekKey) state = { week: weekKey, done: [] };

    const next = configured.find(p => !state.done.includes(p));
    if (!next) return Response.json({ skipped: true, reason: 'All providers synced today' });

    const providerServices = await getServices(next);
    if (!Array.isArray(providerServices)) {
      log.warn('CronSync', `Invalid response from ${getProviderName(next)}`);
      return Response.json({ error: `Invalid response from ${getProviderName(next)}` }, { status: 500 });
    }

    const existing = await prisma.service.findMany({
      where: { provider: next },
      select: { id: true, apiId: true, name: true, category: true, costPer1k: true, min: true, max: true, refill: true, dripfeed: true, cancel: true, avgTime: true },
    });
    const existingMap = {};
    existing.forEach(s => { existingMap[s.apiId] = s; });

    // Markup settings, needed to price anything the provider has that we don't.
    const markupRows = await prisma.setting.findMany({ where: { key: { startsWith: 'markup_' } } });
    const markupSettings = {};
    markupRows.forEach(r => { markupSettings[r.key] = r.value; });

    const startedAt = Date.now();
    let updated = 0, unchanged = 0, malformed = 0, created = 0, deferred = 0;
    const toUpdate = [];
    const toCreate = [];

    const parse = (svc) => {
      // Package services quote per package, not per 1000 — the same 1000x
      // adjustment the prices cron applies. Without it a package service is
      // created a thousandfold too cheap.
      const isPackage = svc.type && String(svc.type).toLowerCase().includes('package');
      const rawCost = Math.round(parseFloat(svc.rate) * 100 * (isPackage ? 1000 : 1));
      if (!Number.isFinite(rawCost) || rawCost < 0 || rawCost > 2000000000) return null;
      return {
        costPer1k: rawCost,
        category: categorize(svc.category),
        min: Number(svc.min) || 10,
        max: Number(svc.max) || 100000,
        refill: svc.refill === true || svc.refill === 'true',
        dripfeed: svc.dripfeed === true || svc.dripfeed === 'true',
        cancel: svc.cancel === true || svc.cancel === 'true',
        // Neither provider actually sends average_time — 11,057 rows carry the
        // old '0-2 hrs' default nobody measured. Store it only when real; new
        // services get an empty string, which displays as nothing rather than
        // as a promise.
        avgTime: svc.average_time || '',
      };
    };

    for (const svc of providerServices) {
      const apiId = Number(svc.service);
      if (!apiId) { malformed++; continue; }
      const f = parse(svc);
      // A service whose rate comes back unusable keeps whatever it had rather than
      // being priced from garbage. Counted separately so it shows up in the log.
      if (!f) { malformed++; continue; }

      const ex = existingMap[apiId];

      if (!ex) {
        // The provider offers this and we have no record of it. Previously these
        // were skipped outright, which is why hundreds of live services were
        // missing from the catalogue entirely.
        //
        // A zero cost cannot be priced — calculateTierPrice returns 0 — and a
        // free service would surface in the reseller full catalogue, which keys
        // off provider listing rather than `enabled`. Existing services are left
        // alone: their cost can legitimately dip to zero and recover.
        if (f.costPer1k <= 0) { malformed++; continue; }
        if (toCreate.length >= MAX_NEW_PER_RUN) { deferred++; continue; }
        toCreate.push({
          apiId,
          name: svc.name,
          provider: next,
          category: f.category,
          costPer1k: f.costPer1k,
          // Priced the same way the prices cron prices any untiered service.
          sellPer1k: calculateTierPrice(f.costPer1k, 'Standard', markupSettings, false, 0),
          min: f.min,
          max: f.max,
          refill: f.refill,
          dripfeed: f.dripfeed,
          cancel: f.cancel,
          avgTime: f.avgTime,
          apiType: svc.type || 'Default',
          // Off by default: nothing untested goes on the storefront on its own.
          // It is still provider-listed, so the reseller full catalogue sees it.
          enabled: false,
          providerListedAt: new Date(),
        });
        continue;
      }

      // avgTime only counts as changed when the provider actually sent one;
      // comparing against the fabricated legacy default would mark all 11k rows
      // changed on the first pass for a value that means nothing.
      const avgTimeChanged = f.avgTime !== '' && ex.avgTime !== f.avgTime;
      if (ex.name === svc.name && ex.category === f.category && Number(ex.costPer1k) === f.costPer1k
        && ex.min === f.min && ex.max === f.max && ex.refill === f.refill
        && ex.dripfeed === f.dripfeed && ex.cancel === f.cancel && !avgTimeChanged) {
        unchanged++;
        continue;
      }
      toUpdate.push(prisma.service.update({
        where: { id: ex.id },
        data: { name: svc.name, category: f.category, costPer1k: f.costPer1k, min: f.min, max: f.max, refill: f.refill, dripfeed: f.dripfeed, cancel: f.cancel, ...(f.avgTime !== '' ? { avgTime: f.avgTime } : {}) },
      }));
      updated++;
    }

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      if (Date.now() - startedAt > WRITE_BUDGET_MS) {
        // Out of time. The provider is deliberately not marked done, so the next
        // invocation picks it up again; the writes are idempotent so replaying is
        // safe, just repeated work.
        log.warn('CronSync', `${getProviderName(next)}: write budget reached, ${toUpdate.length - i} updates left for next run`);
        updated -= (toUpdate.length - i);
        return Response.json({ provider: next, partial: true, updated, unchanged, created, week: weekKey });
      }
      await Promise.all(toUpdate.slice(i, i + BATCH));
    }

    if (toCreate.length) {
      const res = await prisma.service.createMany({ data: toCreate, skipDuplicates: true });
      created = res.count;
    }

    // Every service the provider still lists gets stamped, changed or not. This is
    // what separates "the provider dropped it" from "we chose not to stock it",
    // which `enabled` alone could never express.
    const listedIds = providerServices.map(s => Number(s.service)).filter(Boolean);
    for (let i = 0; i < listedIds.length; i += 1000) {
      await prisma.service.updateMany({
        where: { provider: next, apiId: { in: listedIds.slice(i, i + 1000) } },
        data: { providerListedAt: new Date() },
      });
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

    if (updated > 0 || created > 0 || disabled > 0) invalidateServiceCatalogue();
    try {
      const key = `sync_last_${next}`;
      const value = JSON.stringify({ at: new Date().toISOString(), total: providerServices.length, updated, created, disabled, by: 'nightly' });
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    } catch {}

    log.info('CronSync', `${getProviderName(next)}: ${updated} updated, ${created} added, ${disabled} disabled`
      + `${malformed ? `, ${malformed} malformed` : ''}${deferred ? `, ${deferred} new deferred to next run` : ''}`
      + ` (${state.done.length}/${configured.length} done for ${weekKey})`);

    // Anything this sync listed for the first time gets its permanent reseller ID now.
    const minted = await mintMissingResellerIds().catch(e => ({ error: e.message }));
    return Response.json({
      provider: next,
      providerName: getProviderName(next),
      total: providerServices.length,
      minted,
      updated, unchanged, created, malformed, deferred, disabled,
      week: weekKey,
      done: state.done,
      remaining: configured.filter(p => !state.done.includes(p)),
    });
  } catch (err) {
    log.error('CronSync', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
