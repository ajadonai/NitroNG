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
        platform: 'Instagram',
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
      platformAtPurchase: 'Instagram',
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
      platform: 'Instagram',
      serviceType: 'followers',
      offerDisabled: false,
    });
  });

  it('masks a legacy provider name when the tier relationship is already gone', () => {
    const result = getOrderOfferDisplay(activeOrder({ tierId: null, tier: null }));

    expect(result.serviceName).toBe('Instagram Followers');
    expect(result.tierLabel).toBeNull();
    expect(result.offerDisabled).toBe(true);
    expect(result.serviceName).not.toMatch(/refill|max|quality|real/i);
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
      platformAtPurchase: 'Instagram',
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
