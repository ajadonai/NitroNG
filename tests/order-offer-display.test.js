import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOrderOfferSnapshot, getOrderOfferDisplay } from '@/lib/order-offer-display';

function activeOrder(overrides = {}) {
  return {
    serviceId: 'service-1',
    tierId: 'tier-1',
    service: {
      name: '🔵 Instagram Real Quality Followers | 30 Day Refill | Max 10M',
      category: 'Instagram',
      enabled: true,
    },
    tier: {
      tier: 'Budget',
      enabled: true,
      serviceId: 'service-1',
      group: {
        name: 'Instagram Followers',
        platform: 'instagram',
        type: 'followers',
        enabled: true,
      },
    },
    ...overrides,
  };
}

describe('order offer display', () => {
  it('keeps the immutable purchase name and tier after the catalogue wording changes', () => {
    const result = getOrderOfferDisplay(activeOrder({
      serviceNameAtPurchase: 'Instagram Followers',
      tierNameAtPurchase: 'Budget',
      platformAtPurchase: 'instagram',
      serviceTypeAtPurchase: 'followers',
      tier: {
        ...activeOrder().tier,
        tier: 'Premium',
        group: { ...activeOrder().tier.group, name: 'Renamed Offer' },
      },
    }));

    expect(result).toEqual({
      serviceName: 'Instagram Followers',
      tierLabel: 'Budget',
      platform: 'instagram',
      serviceType: 'followers',
      fullList: false,
      fullListDisabled: false,
      retiredFromMenu: false,
      offerDisabled: false,
    });
  });

  it('masks a legacy provider name when the tier relationship is already gone', () => {
    const result = getOrderOfferDisplay(activeOrder({ tierId: null, tier: null }));

    expect(result.serviceName).toBe('Instagram Followers');
    expect(result.tierLabel).toBeNull();
    expect(result.offerDisabled).toBe(true);
    expect(result.fullList).toBe(false);
    expect(result.retiredFromMenu).toBe(true);
    expect(result.serviceName).not.toMatch(/refill|max|quality|real/i);
  });

  it('labels a recently listed tierless full-list order without marking it disabled', () => {
    const result = getOrderOfferDisplay(activeOrder({
      tierId: null,
      tier: null,
      serviceNameAtPurchase: 'Instagram Followers',
      tierNameAtPurchase: null,
      service: { ...activeOrder().service, providerListedAt: new Date() },
    }));

    expect(result.fullList).toBe(true);
    expect(result.offerDisabled).toBe(false);
    expect(result.fullListDisabled).toBe(false);
  });

  it('marks a full-list order disabled after the provider sweep stops listing it', () => {
    const result = getOrderOfferDisplay(activeOrder({
      tierId: null,
      tier: null,
      serviceNameAtPurchase: 'Instagram Followers',
      tierNameAtPurchase: null,
      service: { ...activeOrder().service, providerListedAt: new Date(Date.now() - 49 * 60 * 60 * 1000) },
    }));

    expect(result.fullList).toBe(true);
    expect(result.fullListDisabled).toBe(true);
    expect(result.offerDisabled).toBe(true);
  });

  it.each([
    ['missing tier', { tier: null }],
    ['disabled tier', { tier: { ...activeOrder().tier, enabled: false } }],
    ['disabled group', { tier: { ...activeOrder().tier, group: { ...activeOrder().tier.group, enabled: false } } }],
    ['disabled service', { service: { ...activeOrder().service, enabled: false } }],
    ['reassigned tier', { tier: { ...activeOrder().tier, serviceId: 'service-2' } }],
  ])('marks the offer disabled for a %s', (_label, overrides) => {
    expect(getOrderOfferDisplay(activeOrder(overrides)).offerDisabled).toBe(true);
  });

  it('builds a clean public snapshot for a direct legacy service order', () => {
    expect(buildOrderOfferSnapshot({ service: activeOrder().service })).toEqual({
      serviceNameAtPurchase: 'Instagram Followers',
      tierNameAtPurchase: null,
      platformAtPurchase: 'instagram',
      serviceTypeAtPurchase: null,
    });
  });

  it('copies the original snapshot when an order is redispatched', () => {
    const sourceOrder = {
      serviceNameAtPurchase: 'X Tweet Views',
      tierNameAtPurchase: 'Budget',
      platformAtPurchase: 'Twitter/X',
      serviceTypeAtPurchase: 'views',
    };

    expect(buildOrderOfferSnapshot({
      sourceOrder,
      service: activeOrder().service,
      tier: activeOrder().tier,
    })).toEqual(sourceOrder);
  });
});

/**
 * The provider's own category is not a platform.
 *
 * Trip found it in the Telegram feed: an order reading "Instagram Likes" with a
 * link labelled "Cheap". A curated order carries its group's platform, but a
 * full-list order has no tier at all, and the fallback was `service.category` —
 * which is whatever the provider filed it under. Twenty-eight orders in ninety
 * days went out labelled Cheap, Cheapest, Vip, Private or Other.
 *
 * It is the house rule in CLAUDE.md, and the same leak reached customers: the
 * dashboard's platform grouping had the identical fallback.
 */
describe('the provider category never becomes a platform', () => {
  const svc = (name, category) => ({ id: 's1', name, category, enabled: true });

  it('maps a full-list service to a Nitro tile instead of its provider category', () => {
    for (const [name, category] of [
      ['Instagram Likes | Cheap | Fast', 'Cheap'],
      ['Instagram Followers [Vip]', 'Vip'],
      ['TikTok Views — private server', 'Private'],
    ]) {
      const snap = buildOrderOfferSnapshot({ service: svc(name, category) });
      expect([category, category.toLowerCase()], `${category} leaked`).not.toContain(snap.platformAtPurchase);
    }
  });

  it('answers null rather than inventing one it cannot map', () => {
    // A missing platform is better than the provider's word for it — tgNewOrder
    // falls back to the label "Link", which says nothing about where we buy.
    const snap = buildOrderOfferSnapshot({ service: svc('Something Unrecognisable', 'Cheapest') });
    expect(snap.platformAtPurchase).toBeNull();
  });

  it('maps on the way out too, so orders already stored clean up on display', () => {
    const shown = getOrderOfferDisplay({ service: svc('Instagram Likes | Cheap', 'Cheap') });
    expect(shown.platform).not.toBe('Cheap');
  });

  it('keeps the provider category out of the customer dashboard query', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'app/api/dashboard/route.js'), 'utf8');
    expect(route).toMatch(/COALESCE\(o\."platformAtPurchase", sg\.platform, 'unknown'\)/);
    expect(route, 's.category must not be a platform fallback').not.toMatch(/COALESCE\(o\."platformAtPurchase", sg\.platform, s\.category/);
  });
});

/**
 * The two disabled states are different things, and the code that acts on them
 * has to ask the right one.
 *
 * `enabled` on a service row means "curated by Nitro", not "sellable" — 9,849
 * of the 9,937 orderable full-list rows have it false by design. Reorder gated
 * on it, so every full-list order offered a button the server then refused:
 * 523 of them on 18 Sep 2026.
 */
describe('reorder asks the catalogue the right question', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/api/orders/route.js'), 'utf8');

  it('does not gate reorder on a service row being curated', () => {
    const block = src.slice(src.indexOf("action === 'reorder'"), src.indexOf("action === 'reorder'") + 1800);
    expect(block).not.toMatch(/!order\.service\.enabled/);
    expect(block).toContain('reorderOffer.offerDisabled');
  });

  it('still refuses when the offer really is gone', () => {
    // A curated tier switched off.
    const retired = getOrderOfferDisplay(activeOrder({
      tier: { ...activeOrder().tier, enabled: false },
    }));
    expect(retired.offerDisabled).toBe(true);
    expect(retired.retiredFromMenu).toBe(true);

    // A full-list row the sweep stopped refreshing.
    const dropped = getOrderOfferDisplay(activeOrder({
      tierId: null, tier: null,
      serviceNameAtPurchase: 'Instagram Followers', tierNameAtPurchase: null,
      service: { ...activeOrder().service, providerListedAt: new Date(Date.now() - 49 * 60 * 60 * 1000) },
    }));
    expect(dropped.offerDisabled).toBe(true);
    expect(dropped.fullListDisabled).toBe(true);
  });

  it('lets a live full-list order through even though its service is not curated', () => {
    const live = getOrderOfferDisplay(activeOrder({
      tierId: null, tier: null,
      serviceNameAtPurchase: 'Instagram Followers', tierNameAtPurchase: null,
      service: { ...activeOrder().service, enabled: false, providerListedAt: new Date() },
    }));
    expect(live.fullList).toBe(true);
    expect(live.offerDisabled).toBe(false);
  });

  it('every surface that shows an order gets the split, not just the verdict', () => {
    for (const p of ['app/api/admin/orders/route.js', 'app/api/orders/route.js', 'app/api/dashboard/route.js']) {
      const s = fs.readFileSync(path.join(process.cwd(), p), 'utf8');
      expect(s, `${p} fullListDisabled`).toContain('fullListDisabled');
      expect(s, `${p} retiredFromMenu`).toContain('retiredFromMenu');
    }
  });
});
