import { describe, expect, it } from 'vitest';
import {
  calculateOrderPrice,
  formatOrderQuantity,
  getDripSchedule,
  isValidLink,
  validateOrderLink,
} from '@/lib/order-form-core';

describe('order form pricing', () => {
  it('applies loyalty, the promotion cap, and points in the existing order', () => {
    expect(calculateOrderPrice({
      quantity: 2000,
      tier: { price: 1000 },
      loyaltyDiscount: 10,
      activePromotion: { discountPercent: 20, maxDiscountPerOrder: 25_000 },
      pointsRedeemable: true,
      pointsBalance: 500,
      redeemPoints: true,
    })).toEqual({
      basePrice: 2000,
      discountAmount: 200,
      promoDiscountAmount: 360,
      cappedPromoDiscount: 250,
      priceBeforePoints: 1550,
      pointsDiscount: 500,
      price: 1050,
    });
  });

  it('prefers pricePer1k and never redeems more points than the total', () => {
    expect(calculateOrderPrice({
      quantity: 1500,
      tier: { price: 9999, pricePer1k: 2000 },
      pointsRedeemable: true,
      pointsBalance: 5000,
      redeemPoints: true,
    })).toMatchObject({
      basePrice: 3000,
      priceBeforePoints: 3000,
      pointsDiscount: 3000,
      price: 0,
    });
  });
});

describe('order form drip scheduling', () => {
  it('keeps a small followers order on the service floor', () => {
    expect(getDripSchedule(3000, 'followers', 1)).toEqual({
      daysMin: 3,
      daysMax: 5,
      days: 3,
      perDay: 1000,
      remainder: 0,
      dailyCap: 5000,
      zone: 'safe',
    });
  });

  it('caps an aggressive comments schedule at the size-based maximum', () => {
    expect(getDripSchedule(10_000, 'comments', 1)).toMatchObject({
      daysMin: 7,
      daysMax: 7,
      days: 7,
      perDay: 1428,
      remainder: 4,
      zone: 'hot',
    });
  });

  it('clamps a requested duration above the maximum', () => {
    expect(getDripSchedule(25_000, 'views', 99)).toMatchObject({
      daysMin: 1,
      daysMax: 12,
      days: 12,
    });
  });
});

describe('order form link validation', () => {
  it('normalizes a protocol and accepts a matching post link', () => {
    expect(validateOrderLink('https://instagram.com/p/ABC123', {
      platform: 'instagram',
      isPostService: true,
    })).toEqual({ cleaned: 'instagram.com/p/ABC123', error: '' });
  });

  it('rejects a post link for profile services', () => {
    expect(validateOrderLink('x.com/nitro/status/123', {
      platform: 'twitter',
      isProfileService: true,
    }).error).toBe('This service needs your profile link, not a post link');
  });

  it('rejects a profile link for post services', () => {
    expect(validateOrderLink('youtube.com/@nitro', {
      platform: 'youtube',
      isPostService: true,
    }).error).toBe('This service needs a link to a specific post, not your profile');
  });

  it('recognizes short-link domains as post links', () => {
    expect(validateOrderLink('youtu.be/ABC123', {
      platform: 'youtube',
      isPostService: true,
    }).error).toBe('');
  });

  it('preserves bulk-cart validation and quantity formatting', () => {
    expect(isValidLink('@nitro.ng')).toBe(true);
    expect(isValidLink('not a link')).toBe(false);
    expect(formatOrderQuantity(500)).toBe(500);
    expect(formatOrderQuantity(2500)).toBe('2.5K');
    expect(formatOrderQuantity(2_000_000)).toBe('2M');
  });
});
