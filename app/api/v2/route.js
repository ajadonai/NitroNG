// The reseller API: POST /api/v2, form-encoded, the SMM-panel convention.
//
// It is a second door to the same shop. Any verified account holds a key; the
// catalogue is what that account sees on the site (curated, or full once
// approved), prices are what that account pays (retail, or wholesale once
// approved), and an order goes through the exact function the web route uses,
// stamped source: "api".
//
// Errors follow the convention third-party panels parse: HTTP 200 with
// { "error": "..." }. Only a bad key answers 401.
import prisma from '@/lib/prisma';
import { getResellerTerms, getMarkupSettings, wholesaleOf } from '@/lib/reseller';
import { getServiceCatalogue } from '@/lib/service-catalog';
import { formatResellerService, dedupeCategoryLabels } from '@/lib/reseller-format';
import { standardType, describeTier, describeService, extraOrderFields } from '@/lib/reseller-instructions';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { FULL_CATALOGUE_WHERE } from '@/lib/reseller-ids';
import { createOrderForSession, patchOrderForSession } from '@/app/api/orders/route';
import { refillOrderForSession } from '@/app/api/orders/refill/route';

export const maxDuration = 60;

const FULL_WHERE = { ...FULL_CATALOGUE_WHERE, resellerMap: { isNot: null } };

const STATUS_LABEL = {
  Pending: 'Pending',
  Dispatching: 'Pending',
  Processing: 'In progress',
  Completed: 'Completed',
  Partial: 'Partial',
  Cancelled: 'Canceled',
  Cancelling: 'Canceled',
  Failed: 'Canceled',
  Rejected: 'Canceled',
};

const money = (kobo) => (Number(kobo || 0) / 100).toFixed(2);
const err = (message, status = 200) => Response.json({ error: message }, { status });

async function readParams(req) {
  const type = req.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) return await req.json();
    const text = await req.text();
    return Object.fromEntries(new URLSearchParams(text));
  } catch {
    return {};
  }
}

/** The account behind a key, or null. Every verified account may hold one. */
async function userForKey(key) {
  if (typeof key !== 'string' || key.length < 8) return null;
  const user = await prisma.user.findUnique({
    where: { apiKey: key },
    select: { id: true, email: true, phone: true, name: true, balance: true, emailVerified: true },
  });
  if (!user || !user.emailVerified) return null;
  return user;
}

/**
 * The service or tier a reseller ID points at, only if that reseller may see
 * it. Curated keys see tiers; full keys see tiers and full-catalogue services.
 */
async function resolveVisible(apiId, terms) {
  const id = Number(apiId);
  if (!Number.isInteger(id) || id <= 0) return { error: 'Incorrect service ID' };
  const map = await prisma.resellerServiceMap.findUnique({
    where: { apiId: id },
    select: {
      retiredAt: true,
      tier: { select: { id: true, enabled: true, group: { select: { enabled: true } } } },
      service: { select: { id: true, enabled: true, provider: true, providerListedAt: true, costPer1k: true } },
    },
  });
  if (!map) return { error: 'Incorrect service ID' };
  if (map.retiredAt) return { error: 'Service discontinued' };
  if (map.tier) {
    if (!map.tier.enabled || !map.tier.group?.enabled) return { error: 'Service not available' };
    return { tierId: map.tier.id };
  }
  if (map.service) {
    if (terms?.catalog !== 'full') return { error: 'Incorrect service ID' };
    const s = map.service;
    // `enabled` is the retail menu switch, not a supply switch: the full
    // catalogue is every listed, priced provider service, exactly as `services`
    // lists it. Orderable if the provider still lists it at a real cost.
    if (!s.providerListedAt || !['mtp', 'dao'].includes(s.provider) || !(Number(s.costPer1k) > 0)) return { error: 'Service not available' };
    return { serviceId: s.id };
  }
  return { error: 'Incorrect service ID' };
}

async function listServices(terms) {
  const settings = await getMarkupSettings();
  const out = [];
  // Curated tiers, priced on the tier, exactly as the catalogue page shows them.
  const catalogue = await getServiceCatalogue();
  const tierIds = catalogue.groups.flatMap(g => g.tiers.map(t => t.id));
  const tierMaps = await prisma.resellerServiceMap.findMany({
    where: { tierId: { in: tierIds }, retiredAt: null },
    select: { apiId: true, tierId: true },
  });
  const idByTier = Object.fromEntries(tierMaps.map(m => [m.tierId, m.apiId]));
  const botSetting = await prisma.setting.findUnique({ where: { key: 'discord_bot_url' } }).catch(() => null);
  const botUrl = botSetting?.value || 'https://nowon.tools';
  for (const g of catalogue.groups) {
    for (const t of g.tiers) {
      const apiId = idByTier[t.id];
      if (!apiId) continue;
      out.push({
        service: apiId,
        name: `${g.name} · ${t.tier}`,
        type: standardType(t.apiType, { customComments: !!t.customComments }),
        category: g.platform,
        rate: money(wholesaleOf(Math.round(t.price * 100), terms, settings)),
        min: t.min,
        max: t.max,
        refill: !!t.refill,
        cancel: false,
        description: describeTier(g, t, { botUrl }),
      });
    }
  }
  if (terms?.catalog !== 'full') return out;
  // The full list, priced on the service, with the same labels the catalogue uses.
  const usdSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
  const usdRate = Number(usdSetting?.value || 1600);
  const services = await prisma.service.findMany({
    where: FULL_WHERE,
    select: {
      name: true, category: true, sellPer1k: true, costPer1k: true, min: true, max: true, refill: true, cancel: true, dripfeed: true, apiType: true,
      resellerMap: { select: { apiId: true, retiredAt: true } },
    },
    orderBy: [{ category: 'asc' }, { costPer1k: 'asc' }, { id: 'asc' }],
  });
  const rows = [];
  for (const s of services) {
    if (!s.resellerMap || s.resellerMap.retiredAt) continue;
    const retail = Number(s.sellPer1k);
    if (!retail || retail <= Number(s.costPer1k) * usdRate) continue;
    const fmt = formatResellerService(s.name, s.category);
    rows.push({
      service: s.resellerMap.apiId,
      label: fmt.label,
      attrs: fmt.attrs,
      category: s.category,
      rate: money(wholesaleOf(retail, terms, settings)),
      min: s.min,
      max: s.max,
      refill: !!s.refill,
      cancel: !!s.cancel,
      type: standardType(s.apiType),
      description: describeService(s),
      _raw: s.name,
    });
  }
  dedupeCategoryLabels(rows);
  for (const r of rows) {
    out.push({ service: r.service, name: r.label, type: r.type, category: r.category, rate: r.rate, min: r.min, max: r.max, refill: r.refill, cancel: r.cancel, description: r.description });
  }
  return out;
}

function statusOf(order) {
  const qty = order.quantity || 0;
  const remains = order.status === 'Completed' ? 0 : order.remains != null ? Math.max(0, order.remains) : qty;
  return {
    charge: money(order.charge),
    start_count: String(order.startCount ?? 0),
    status: STATUS_LABEL[order.status] || 'Pending',
    remains: String(remains),
    currency: 'NGN',
  };
}

async function ownOrders(userId, ids) {
  return prisma.order.findMany({
    where: { userId, orderId: { in: ids }, deletedAt: null },
    select: { orderId: true, status: true, charge: true, quantity: true, remains: true, startCount: true },
  });
}

const parseIds = (value) => String(value || '').split(',').map(v => v.trim()).filter(Boolean).slice(0, 100);

export async function POST(req) {
  const p = await readParams(req);
  const user = await userForKey(p.key);
  if (!user) return err('Invalid API key', 401);
  const limit = await rateLimit(req, { maxAttempts: 60, windowMs: 60 * 1000, key: `rl:api:${user.id}` });
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many requests. Slow down.', limit.retryAfter);
  // Null terms means retail: wholesaleOf returns the retail price untouched.
  const terms = await getResellerTerms(user.id);
  const session = { id: user.id, email: user.email, phone: user.phone, name: user.name };

  switch (String(p.action || '').toLowerCase()) {
    case 'balance': {
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } });
      return Response.json({ balance: money(fresh?.balance), currency: 'NGN' });
    }
    case 'services':
      return Response.json(await listServices(terms));
    case 'add': {
      const target = await resolveVisible(p.service, terms);
      if (target.error) return err(target.error);
      const quantity = Number(p.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) return err('Incorrect quantity');
      if (!p.link || String(p.link).length > 2000) return err('Incorrect link');
      // Panels retry. The same key, service, link and quantity inside sixty
      // seconds is the same order, so answer with the one already placed.
      const replay = await prisma.order.findFirst({
        where: {
          userId: user.id, source: 'api', link: String(p.link), quantity, deletedAt: null,
          ...(target.tierId ? { tierId: target.tierId } : { serviceId: target.serviceId }),
          createdAt: { gte: new Date(Date.now() - 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        select: { orderId: true },
      });
      if (replay) return Response.json({ order: replay.orderId });
      const res = await createOrderForSession(session, {
        ...(target.tierId ? { tierId: target.tierId } : { serviceId: target.serviceId }),
        link: String(p.link),
        quantity,
        ...extraOrderFields(p),
        confirmDuplicate: true,
      }, req, { source: 'api', catalogue: terms?.catalog === 'full' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.order?.id) return err(data?.error || 'Order could not be placed');
      return Response.json({ order: data.order.id });
    }
    case 'status': {
      if (p.orders) {
        const ids = parseIds(p.orders);
        const found = await ownOrders(user.id, ids);
        const byId = Object.fromEntries(found.map(o => [o.orderId, o]));
        const out = {};
        for (const id of ids) out[id] = byId[id] ? statusOf(byId[id]) : { error: 'Incorrect order ID' };
        return Response.json(out);
      }
      const [order] = await ownOrders(user.id, parseIds(p.order));
      if (!order) return err('Incorrect order ID');
      return Response.json(statusOf(order));
    }
    case 'refill': {
      const id = parseIds(p.order)[0];
      if (!id) return err('Incorrect order ID');
      const res = await refillOrderForSession(session, id);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return err(data?.error || 'Refill could not be requested');
      return Response.json({ refill: '1' });
    }
    case 'cancel': {
      const ids = parseIds(p.orders || p.order);
      if (!ids.length) return err('Incorrect order ID');
      const out = [];
      for (const id of ids) {
        const res = await patchOrderForSession(session, { action: 'cancel', orderId: id }, req);
        const data = await res.json().catch(() => ({}));
        out.push({ order: id, cancel: res.ok ? 1 : { error: data?.error || 'Order cannot be cancelled' } });
      }
      return Response.json(out);
    }
    default:
      return err('Incorrect action');
  }
}
