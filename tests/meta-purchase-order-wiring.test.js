import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Meta Purchase order entrypoints', () => {
  it('uses the durable outbox instead of a fire-and-forget direct send', () => {
    const sources = [
      read('app/api/orders/route.js'),
      read('app/api/orders/bulk/route.js'),
      read('app/api/admin/orders/create/route.js'),
      read('app/api/admin/orders/route.js'),
    ];

    for (const source of sources) {
      expect(source).not.toMatch(/sendEvent\(['"]Purchase['"]/);
    }
  });

  it('preserves browser-facing event IDs and adds deterministic server-only IDs', () => {
    const customer = read('app/api/orders/route.js');
    const bulk = read('app/api/orders/bulk/route.js');
    const adminCreate = read('app/api/admin/orders/create/route.js');
    const adminOrders = read('app/api/admin/orders/route.js');

    expect(customer).toMatch(/const eventId = `purchase_\$\{orderId\}`/);
    expect(customer).toMatch(/const reorderEventId = `purchase_\$\{newOrderId\}`/);
    expect(bulk).toMatch(/eventId: `purchase_\$\{newBatchId\}`/);
    expect(bulk).toMatch(/\? `purchase_\$\{batchId\}`/);
    expect(bulk).toMatch(/: `purchase_\$\{createdOrders\[0\]\.orderId\}`/);
    expect(adminCreate).toMatch(/eventId: `purchase_\$\{batchId\}`/);
    expect(adminCreate).toMatch(/eventId: `purchase_\$\{id\}`/);
    expect(adminOrders).toMatch(/eventId: `purchase_\$\{newId\}`/);
  });

  it('cancels a deferred Purchase in the same permanent-rejection refund transaction', () => {
    const customer = read('app/api/orders/route.js');

    expect(customer).toMatch(
      /await cancelQueuedMetaEvent\(tx, `purchase_\$\{orderId\}`, 'provider_rejected_and_fully_refunded'\)/,
    );
    expect(customer).toContain('notBefore: new Date(Date.now() + 5 * 60 * 1000)');
  });

  it('keeps explicitly free admin orders out of Purchase reporting', () => {
    const adminCreate = read('app/api/admin/orders/create/route.js');
    const adminOrders = read('app/api/admin/orders/route.js');

    expect(adminCreate).toContain('if (totalCharge > 0) {\n          await enqueueMetaEvent');
    expect(adminCreate).toContain('if (chargeKobo > 0) {');
    expect(adminOrders).toContain('if (newCharge > 0) {');
  });
});
