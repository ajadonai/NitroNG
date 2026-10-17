import prisma from '@/lib/prisma';
import { isPerItemPackage, platformOf, refillOf } from '@/lib/full-catalogue';
import { formatResellerService } from '@/lib/reseller-format';
import { standardType } from '@/lib/reseller-instructions';
import { staleCutoffs, isListedRecently } from '@/lib/provider-listing';
import { DEAD_ORDER_STATES } from '@/lib/ledger';

/**
 * Everything about one service, from the number a customer quotes.
 *
 * A customer sees one number for a service: on the full list ("#301"), on
 * their order card ("Service ID") and in the API. It is the reseller map's
 * apiId. Admin pages showed the provider's own number instead, so "service
 * 301" could not be found without a database (17 Oct 2026). This answers it:
 * what the service is, what it costs and sells for, whether it is on the full
 * list and the API and why not, what uses it, and how it has been ordering.
 *
 *   ?q=301        the customer's number (a leading # is fine)
 *   ?q=p5603      the provider's number, every provider that has it
 *
 * The visibility answers run the same rules as the full list (buildAll) and
 * the API (listServices, resolveVisible), named one by one, so the reason it
 * gives is the reason a customer is not seeing it.
 */
const LIVE = ['mtp', 'dao'];

export function verdicts(s, map, cutoffs, usdRate) {
  const why = [];
  if (map?.retiredAt) why.push('Retired: the ID now answers "Service discontinued"');
  if (!LIVE.includes(s.provider)) why.push('Its provider is no longer connected');
  if (!s.providerListedAt) why.push('Never confirmed by a provider sync');
  else if (!isListedRecently(s, cutoffs)) why.push(`Not confirmed by the provider since ${new Date(s.providerListedAt).toISOString().slice(0, 10)}`);
  if (!(Number(s.costPer1k) > 0)) why.push('No cost from the provider');
  if (s.blacklisted) why.push('Blacklisted');
  if (s._count.tiers > 0) why.push('Attached to a curated tier, so it sells there instead');
  if (isPerItemPackage(s)) why.push('Sold per item, so a per-1,000 price would mislead');
  // A tier sells at its own price, so the service's stored one does not apply.
  const retail = Number(s.sellPer1k), costKobo = Number(s.costPer1k) * usdRate;
  if (s._count.tiers === 0 && (!retail || retail <= costKobo)) why.push('Price at or below cost until the prices job reaches it');
  const fullOnly = (s.platform || platformOf(s.name, s.category)) ? [] : ['No platform tile to list it under'];
  return { fullList: [...why, ...fullOnly], api: why };
}

async function describeService(s, map, { sensitive, usdRate, cutoffs }) {
  const since = new Date(Date.now() - 30 * 86400000);
  const [recent, allTime, last, up, down, saved] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], where: { serviceId: s.id, createdAt: { gte: since }, deletedAt: null }, _count: { _all: true } }),
    prisma.order.count({ where: { serviceId: s.id, deletedAt: null } }),
    prisma.order.findFirst({ where: { serviceId: s.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.serviceVote.count({ where: { serviceId: s.id, value: 1 } }),
    prisma.serviceVote.count({ where: { serviceId: s.id, value: -1 } }),
    prisma.serviceFavourite.count({ where: { serviceId: s.id } }),
  ]);
  const fmt = formatResellerService(s.name, s.category);
  const { refill, refillLabel } = refillOf(s.name, s.category, s.refill);
  const retail = Number(s.sellPer1k) / 100;
  const cost = Math.round(Number(s.costPer1k) * usdRate) / 100;
  const v = verdicts(s, map, cutoffs, usdRate);
  const byStatus = Object.fromEntries(recent.map(r => [r.status, r._count._all]));
  return {
    sid: s.id,
    id: map?.apiId ?? null,
    providerId: s.apiId,
    ...(sensitive ? { provider: s.provider, cost, margin: cost > 0 ? Math.round(((retail - cost) / cost) * 100) : null } : {}),
    name: s.name,
    label: fmt.label,
    attrs: fmt.attrs || [],
    platform: s.platform || platformOf(s.name, s.category) || null,
    category: s.category,
    type: standardType(s.apiType),
    retail,
    markup: s.markup,
    min: s.min,
    max: s.max,
    refill, refillLabel,
    cancel: !!s.cancel,
    dripfeed: !!s.dripfeed,
    enabled: !!s.enabled,
    blacklisted: !!s.blacklisted,
    lastConfirmed: s.providerListedAt ? new Date(s.providerListedAt).toISOString() : null,
    fullList: { shown: v.fullList.length === 0, why: v.fullList },
    api: { listed: !!map && v.api.length === 0, why: map || v.api.length ? v.api : ['Has no customer number yet'] },
    tierPriced: s._count.tiers > 0,
    tiers: s.tiers.map(ti => ({ tier: ti.tier, group: ti.group?.name || null, platform: ti.group?.platform || null, enabled: !!ti.enabled && !!ti.group?.enabled })),
    orders: {
      last30: Object.values(byStatus).reduce((a, b) => a + b, 0),
      live30: Object.entries(byStatus).filter(([st]) => !DEAD_ORDER_STATES.includes(st)).reduce((a, [, n]) => a + n, 0),
      byStatus,
      allTime,
      lastAt: last?.createdAt ? last.createdAt.toISOString() : null,
    },
    votes: { up, down },
    saved,
  };
}

const SERVICE_SELECT = {
  id: true, apiId: true, name: true, category: true, platform: true, provider: true, apiType: true,
  costPer1k: true, sellPer1k: true, markup: true, min: true, max: true, refill: true, cancel: true, dripfeed: true,
  enabled: true, blacklisted: true, providerListedAt: true,
  _count: { select: { tiers: true } },
  tiers: { select: { tier: true, enabled: true, group: { select: { name: true, platform: true, enabled: true } } } },
  resellerMap: { select: { apiId: true, retiredAt: true } },
};

/**
 * The answer for one query, without the admin check — the route does that.
 * Returns { status, body }.
 */
export async function lookupService(rawQuery, { sensitive }) {
  const raw = String(rawQuery || '').trim().toLowerCase().replace(/^#/, '');
  const provider = raw.match(/^p\s*#?\s*(\d{1,9})$/);
  const nitro = raw.match(/^(\d{1,9})$/);
  if (!provider && !nitro) return { status: 400, body: { error: 'Type the number a customer quotes, like 301, or p5603 for the provider\'s own number.' } };

  const [usdSetting, cutoffs] = await Promise.all([prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } }), staleCutoffs()]);
  const ctx = { sensitive, usdRate: Number(usdSetting?.value || 1600), cutoffs };

  if (provider) {
    const rows = await prisma.service.findMany({ where: { apiId: Number(provider[1]) }, select: SERVICE_SELECT, take: 5 });
    if (!rows.length) return { status: 200, body: { kind: 'none', query: raw } };
    const services = await Promise.all(rows.map(s => describeService(s, s.resellerMap, ctx)));
    return { status: 200, body: { kind: 'service', query: raw, services } };
  }

  const map = await prisma.resellerServiceMap.findUnique({
    where: { apiId: Number(nitro[1]) },
    select: {
      apiId: true, retiredAt: true,
      service: { select: SERVICE_SELECT },
      tier: { select: { tier: true, enabled: true, sellPer1k: true, group: { select: { name: true, platform: true, enabled: true } }, service: { select: SERVICE_SELECT } } },
    },
  });
  if (!map) return { status: 200, body: { kind: 'none', query: raw } };
  if (map.service) return { status: 200, body: { kind: 'service', query: raw, services: [await describeService(map.service, map, ctx)] } };
  if (map.tier) {
    const t = map.tier;
    return {
      status: 200,
      body: {
        kind: 'tier', query: raw, id: map.apiId, retired: !!map.retiredAt,
        tier: (() => {
          const retail = Number(t.sellPer1k) / 100;
          const cost = t.service ? Math.round(Number(t.service.costPer1k) * ctx.usdRate) / 100 : null;
          return { tier: t.tier, group: t.group?.name || null, platform: t.group?.platform || null, enabled: !!t.enabled && !!t.group?.enabled, retail, ...(sensitive && cost ? { margin: Math.round(((retail - cost) / cost) * 100) } : {}) };
        })(),
        services: t.service ? [await describeService(t.service, t.service.resellerMap, ctx)] : [],
      },
    };
  }
  return { status: 200, body: { kind: 'retired', query: raw, id: map.apiId } };
}
