import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routes = [
  'app/api/admin/overview/route.js',
  'app/api/pulse/route.js',
  'app/api/live/route.js',
];

const source = route => readFileSync(new URL(`../${route}`, import.meta.url), 'utf8');

describe('normal admin order labels', () => {
  for (const route of routes) {
    it(`${route} delegates public order labels to the shared resolver`, () => {
      const code = source(route);

      expect(code).toContain("import { getOrderOfferDisplay } from '@/lib/order-offer-display';");
      expect(code).toContain('getOrderOfferDisplay(o)');
      expect(code).toContain('service: offer.serviceName');
      expect(code).toContain('tier: offer.tierLabel');
      expect(code).not.toMatch(/service:\s*o\.tier\?\.|service:\s*o\.service\?\.name/);
    });
  }

  it('uses the clean resolver in financial order exports while retaining provider metadata separately', () => {
    const code = source('app/api/admin/financials/route.js');

    expect(code).toContain("import { getOrderOfferDisplay } from '@/lib/order-offer-display';");
    expect(code).toContain('const offer = getOrderOfferDisplay(order)');
    expect(code).toContain('service: offer.serviceName');
    expect(code).toContain('tier: offer.tierLabel');
    expect(code).toContain('provider: order.service?.provider');
    expect(code).not.toContain("service: order.service?.name || ''");
  });
});
