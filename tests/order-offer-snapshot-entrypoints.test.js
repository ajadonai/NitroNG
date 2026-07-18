import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('order offer snapshot entrypoints', () => {
  it('snapshots regular orders and reorders before creation', () => {
    const code = source('app/api/orders/route.js');
    expect(code).toContain('...offerSnapshot');
    expect(code).toContain('...reorderSnapshot');
    expect(code).toContain('getOrderOfferDisplay(o)');
  });

  it('snapshots bulk orders and completed-batch reorders', () => {
    const code = source('app/api/orders/bulk/route.js');
    expect(code).toContain('...o.offerSnapshot');
    expect(code).toContain('...offerSnapshot');
    expect(code).toContain('getOrderOfferDisplay(o)');
  });

  it('copies the original public snapshot onto admin redispatch children', () => {
    const code = source('app/api/admin/orders/route.js');
    expect(code).toContain('sourceOrder: fullOrder');
    expect(code).toContain('...childOfferSnapshot');
    expect(code).toContain('tierLabel: offer.tierLabel');
    expect(code).toContain('offerDisabled: offer.offerDisabled');
    expect(code).toContain('provider: o.service?.provider');
    expect(code).toContain('serviceApiId: o.service?.apiId');
  });

  it('renders the persistent tier and disabled state separately from provider metadata', () => {
    const code = source('components/admin-orders.jsx');
    expect(code).toContain('o.tierLabel');
    expect(code).toContain('o.offerDisabled');
    expect(code).toContain('>Disabled</span>');
    expect(code).toContain('Provider</div>');
    expect(code).toContain('Service ID</div>');
  });

  it('masks the legacy direct-service catalogue endpoint', () => {
    const code = source('app/api/services/route.js');
    expect(code).toContain('getPublicServiceLabel(s.name, s.category)');
    expect(code).not.toContain('name: s.name');
  });

  it('backfills linked snapshots and only recognized legacy tier labels', () => {
    const sql = source('prisma/migrations/20260717020300_add_order_offer_snapshots/migration.sql');
    expect(sql).toContain('"serviceNameAtPurchase" = sg."name"');
    expect(sql).toContain('recognized_tiers');
    expect(sql).toContain('LOWER(BTRIM(st."tier")) = LOWER(nt."tierName")');
  });
});
