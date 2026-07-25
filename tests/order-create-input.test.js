import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  calculateCreateOrderPricing,
  parseCreateOrderInput,
  validateCreateOrderOfferInput,
} from '@/lib/order-create-input.server';

function service(overrides = {}) {
  return {
    name: 'Provider Instagram Real Quality Views',
    category: 'Instagram',
    min: 100,
    max: 100_000,
    sellPer1k: 30_000n,
    costPer1k: 125n,
    apiType: 'Default',
    ...overrides,
  };
}

function tier(type = 'views', overrides = {}) {
  return {
    sellPer1k: 25_000n,
    tier: 'Budget',
    group: {
      name: 'Instagram Views',
      type,
      platform: 'Instagram',
      ...overrides.group,
    },
    ...overrides,
  };
}

describe('create-order request parsing', () => {
  it('normalizes social links and preserves optional flag values', () => {
    const result = parseCreateOrderInput({
      tierId: 'tier-1',
      link: ' https://www.instagram.com/p/ABC123/?utm_source=share#fragment ',
      quantity: '501.9',
      comments: 'first\nsecond',
      dripDays: 3,
      confirmDuplicate: true,
      redeemPoints: true,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        tierId: 'tier-1',
        serviceId: undefined,
        link: 'https://www.instagram.com/p/ABC123/',
        quantity: '501.9',
        comments: 'first\nsecond',
        rawDripDays: 3,
        confirmDuplicate: true,
        redeemPoints: true,
        isUrl: true,
        isUsername: false,
      },
    });
  });

  it.each([
    [{ tierId: 'tier-1', quantity: 100 }, 'Link and quantity required'],
    [{ tierId: 'tier-1', link: '@nitro' }, 'Link and quantity required'],
    [{ link: '@nitro', quantity: 100 }, 'Service or tier required'],
    [{ tierId: 'tier-1', link: 'bad link', quantity: 100 }, 'Please enter a valid URL (https://...) or username'],
  ])('rejects invalid public input %#', (body, error) => {
    expect(parseCreateOrderInput(body)).toEqual({ ok: false, error });
  });

  it.each([
    [null, 'Invalid request body'],
    ['not-an-object', 'Invalid request body'],
    [[], 'Invalid request body'],
    [{ tierId: 123, link: '@nitro', quantity: 100 }, 'Invalid service or tier'],
    [{ tierId: '   ', link: '@nitro', quantity: 100 }, 'Invalid service or tier'],
    [{ tierId: 'tier-1', serviceId: {}, link: '@nitro', quantity: 100 }, 'Invalid service or tier'],
    [{ tierId: 'tier-1', link: 12345, quantity: 100 }, 'Invalid link'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: true }, 'Invalid quantity'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: {} }, 'Invalid quantity'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: 'one hundred' }, 'Invalid quantity'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: 100, comments: [] }, 'Invalid comments'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: 100, comments: null }, 'Invalid comments'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: 100, dripDays: '3' }, 'Invalid drip days'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: 100, dripDays: Infinity }, 'Invalid drip days'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: 100, confirmDuplicate: 'true' }, 'Invalid duplicate confirmation'],
    [{ tierId: 'tier-1', link: '@nitro', quantity: 100, redeemPoints: 1 }, 'Invalid points redemption option'],
  ])('returns a safe validation result for malformed typed input %#', (body, error) => {
    expect(parseCreateOrderInput(body)).toEqual({ ok: false, error });
  });

  it('preserves every typed optional value used by the browser order flow', () => {
    expect(parseCreateOrderInput({
      tierId: 'tier-1',
      link: 'https://x.com/nitro/status/123',
      quantity: 500,
      comments: 'first line',
      dripDays: 0,
      confirmDuplicate: false,
      redeemPoints: false,
      serviceType: 'views',
    })).toMatchObject({
      ok: true,
      value: {
        tierId: 'tier-1',
        quantity: 500,
        comments: 'first line',
        rawDripDays: 0,
        confirmDuplicate: false,
        redeemPoints: false,
      },
    });
  });

  it('accepts direct-service username input', () => {
    expect(parseCreateOrderInput({
      serviceId: 'service-1',
      link: '@nitro.ng',
      quantity: 100,
    })).toMatchObject({
      ok: true,
      value: { link: '@nitro.ng', isUrl: false, isUsername: true },
    });
  });

  it('normalizes accepted social URLs idempotently', () => {
    fc.assert(fc.property(
      fc.stringMatching(/^[A-Za-z0-9_-]{1,40}$/),
      fc.stringMatching(/^[A-Za-z0-9_-]{1,30}$/),
      fc.integer({ min: 1, max: 100_000 }),
      (postId, trackingValue, quantity) => {
        const first = parseCreateOrderInput({
          tierId: 'tier-1',
          link: `https://www.instagram.com/p/${postId}/?utm_source=${trackingValue}#share`,
          quantity,
        });
        expect(first.ok).toBe(true);

        const second = parseCreateOrderInput({
          tierId: 'tier-1',
          link: first.value.link,
          quantity,
        });
        expect(second).toMatchObject({ ok: true, value: { link: first.value.link } });
      },
    ), { numRuns: 100 });
  });

  it('never accepts malformed top-level JSON values', () => {
    const malformedBody = fc.oneof(
      fc.constant(null),
      fc.boolean(),
      fc.integer(),
      fc.string(),
      fc.array(fc.jsonValue(), { maxLength: 5 }),
    );

    fc.assert(fc.property(malformedBody, body => {
      expect(parseCreateOrderInput(body)).toEqual({
        ok: false,
        error: 'Invalid request body',
      });
    }), { numRuns: 100 });
  });
});

describe('create-order pricing', () => {
  it('applies Nitro quantity floors, floors quantity, and keeps amounts in kobo', () => {
    const result = calculateCreateOrderPricing({
      tier: tier('views'),
      service: service(),
      quantity: '501.9',
      usdRate: 1600,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        qty: 501,
        chargeKobo: 12_600,
        costKobo: 100_200,
        offerSnapshot: {
          serviceNameAtPurchase: 'Instagram Views',
          tierNameAtPurchase: 'Budget',
          platformAtPurchase: 'Instagram',
          serviceTypeAtPurchase: 'views',
        },
        tierName: 'Instagram Views (Budget)',
      },
    });
  });

  it('uses the legacy service minimum when no tier is selected', () => {
    const result = calculateCreateOrderPricing({
      service: service({ min: 20, sellPer1k: 10_000n }),
      quantity: 25,
      usdRate: 1600,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { qty: 25, chargeKobo: 300, costKobo: 5_000 },
    });
  });

  it.each([
    [0, 'Invalid quantity'],
    ['not-a-number', 'Invalid quantity'],
    [499, 'Quantity must be between 500 and 100,000'],
    [100_001, 'Quantity must be between 500 and 100,000'],
  ])('rejects invalid tier quantity %s', (quantity, error) => {
    expect(calculateCreateOrderPricing({
      tier: tier('views'),
      service: service(),
      quantity,
      usdRate: 1600,
    })).toEqual({ ok: false, error });
  });

  it('rejects a non-positive configured sell price', () => {
    expect(calculateCreateOrderPricing({
      tier: tier('likes', { sellPer1k: 0n }),
      service: service(),
      quantity: 100,
      usdRate: 1600,
    })).toEqual({ ok: false, error: 'Service pricing not configured' });
  });

  it('keeps positive prices monotonic and rounded to whole-naira kobo', () => {
    fc.assert(fc.property(
      fc.integer({ min: 500, max: 99_999 }),
      fc.integer({ min: 1, max: 100_000 }),
      fc.integer({ min: 1, max: 10_000 }),
      fc.integer({ min: 100, max: 5_000 }),
      (firstQuantity, delta, sellPer1k, usdRate) => {
        const secondQuantity = Math.min(100_000, firstQuantity + delta);
        const selectedTier = tier('views', { sellPer1k: BigInt(sellPer1k) });
        const backingService = service({ costPer1k: BigInt(sellPer1k) });
        const first = calculateCreateOrderPricing({
          tier: selectedTier,
          service: backingService,
          quantity: firstQuantity,
          usdRate,
        });
        const second = calculateCreateOrderPricing({
          tier: selectedTier,
          service: backingService,
          quantity: secondQuantity,
          usdRate,
        });

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        expect(first.value.chargeKobo % 100).toBe(0);
        expect(first.value.costKobo % 100).toBe(0);
        expect(second.value.chargeKobo).toBeGreaterThanOrEqual(first.value.chargeKobo);
        expect(second.value.costKobo).toBeGreaterThanOrEqual(first.value.costKobo);
      },
    ), { numRuns: 100 });
  });
});

describe('resolved offer input rules', () => {
  it('rejects a post URL for a profile offer', () => {
    const result = validateCreateOrderOfferInput({
      tier: tier('followers'),
      service: service(),
      link: 'https://instagram.com/p/ABC123',
      isUrl: true,
    });

    expect(result).toEqual({
      ok: false,
      error: 'This service needs a profile link, not a post link. Example: https://instagram.com/yourpage. Learn more: https://nitro.ng/blog/how-to-find-the-right-link',
    });
  });

  it('rejects usernames and profile URLs for post offers', () => {
    expect(validateCreateOrderOfferInput({
      tier: tier('views'),
      service: service(),
      link: '@nitro',
      isUrl: false,
    })).toEqual({
      ok: false,
      error: 'This service needs a link to your post or video, not a username. Learn more: https://nitro.ng/blog/how-to-find-the-right-link',
    });

    expect(validateCreateOrderOfferInput({
      tier: tier('views'),
      service: service(),
      link: 'https://instagram.com/nitro',
      isUrl: true,
    })).toEqual({
      ok: false,
      error: 'This service needs a post/content link, not a profile link. Example: https://instagram.com/p/ABC123. Learn more: https://nitro.ng/blog/how-to-find-the-right-link',
    });
  });

  it('recognizes shortened content URLs and multi-post profile offers', () => {
    expect(validateCreateOrderOfferInput({
      tier: tier('views'),
      service: service({ category: 'TikTok' }),
      link: 'https://vm.tiktok.com/ABC123',
      isUrl: true,
    })).toMatchObject({ ok: true });

    expect(validateCreateOrderOfferInput({
      tier: tier('views', { group: { name: 'Last 5 posts', type: 'views' } }),
      service: service(),
      link: 'https://instagram.com/p/ABC123',
      isUrl: true,
    })).toMatchObject({
      ok: false,
      error: expect.stringContaining('needs a profile link'),
    });
  });

  it.each([
    ['SEO', undefined, 'Keywords are required for this service'],
    ['Mention Hashtag', '', 'Usernames are required for this service'],
    ['Poll', '   ', 'An answer selection is required for this service'],
    ['Custom Comments', null, 'Comments are required for this service'],
  ])('requires text for %s provider offers', (apiType, comments, error) => {
    expect(validateCreateOrderOfferInput({
      service: service({ apiType }),
      link: '@nitro',
      isUrl: false,
      comments,
    })).toEqual({ ok: false, error });
  });

  it('enforces the established comment-line minimum and returns dispatch flags', () => {
    expect(validateCreateOrderOfferInput({
      service: service({ apiType: 'Custom Comments', min: 10 }),
      link: 'https://instagram.com/p/ABC123',
      isUrl: true,
      comments: 'one\ntwo',
    })).toEqual({
      ok: false,
      error: 'Please provide at least 10 unique comments (one per line). You entered 2.',
    });

    expect(validateCreateOrderOfferInput({
      service: service({ apiType: 'SEO' }),
      link: 'https://example.com/page',
      isUrl: true,
      comments: 'nitro views',
    })).toEqual({
      ok: true,
      value: {
        apiType: 'seo',
        needsUsernames: false,
        needsAnswer: false,
        needsKeywords: true,
      },
    });
  });
});
