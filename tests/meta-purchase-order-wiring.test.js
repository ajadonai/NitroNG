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

    expect(customer).toMatch(/const eventId = `purchase_\$\{orderId\}`/);
    expect(customer).toMatch(/const reorderEventId = `purchase_\$\{newOrderId\}`/);
    expect(bulk).toMatch(/eventId: `purchase_\$\{newBatchId\}`/);
    expect(bulk).toMatch(/\? `purchase_\$\{batchId\}`/);
    expect(bulk).toMatch(/: `purchase_\$\{createdOrders\[0\]\.orderId\}`/);
  });

  it('cancels a deferred Purchase in the same permanent-rejection refund transaction', () => {
    const customer = read('app/api/orders/route.js');

    expect(customer).toMatch(
      /await cancelQueuedMetaEvent\(tx, `purchase_\$\{orderId\}`, 'provider_rejected_and_fully_refunded'\)/,
    );
    expect(customer).toContain('notBefore: new Date(Date.now() + 5 * 60 * 1000)');
  });

  it('sends no Purchase at all from the admin paths', () => {
    // An order staff keyed in for a customer is not a web conversion — reporting
    // it as one taught the optimiser that a WhatsApp sale came from whatever ad
    // the customer last clicked — and a re-dispatch is the parent sale cut again,
    // whose Purchase already went. Both used to send; since 13 Sep 2026 neither does.
    const create = read('app/api/admin/orders/create/route.js');
    const orders = read('app/api/admin/orders/route.js');

    expect(create).not.toContain('enqueueMetaEvent');
    expect(orders).not.toContain('enqueueMetaEvent');
    expect(create).toContain("source: 'admin'");
  });
});
