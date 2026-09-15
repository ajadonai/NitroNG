import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../app/api/orders/bulk/route.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('../components/new-order.jsx', import.meta.url), 'utf8');
const list = readFileSync(new URL('../components/full-list.jsx', import.meta.url), 'utf8');

/**
 * The full list, in bulk.
 *
 * Bulk's cart unit was a (service, tier) pair, and a full-list service has no
 * tier — FULL_WHERE requires `tiers: { none: {} }`. So the cart had nothing to
 * hold and the selector was simply hidden in bulk.
 *
 * A row now names EITHER a tier or a catalogue service, the same choice the
 * single-order route has offered all along, and the shared helpers in
 * lib/order-create-input.server.js have branched on a null tier since before
 * this existed. This suite pins the places the bulk route still assumed one.
 */
describe('bulk accepts a full-list row', () => {
  const loop = route.slice(route.indexOf('for (let i = 0; i < orders.length; i++)'), route.indexOf('if (driftRows.length > 0)'));

  it('takes a tier or a catalogue id, never both and never neither', () => {
    expect(loop).toMatch(/a row names a tier or a catalogue service, not both/);
    expect(loop).toMatch(/if \(\(!row\.tierId && !wantsCatalogue\) \|\| !row\.link \|\| !row\.quantity\)/);
    // A public number off the wire is an integer or it is nothing.
    expect(loop).toMatch(/if \(wantsCatalogue && !Number\.isInteger\(catalogueId\)\)/);
  });

  it('resolves the catalogue id the way the single route does', () => {
    expect(loop).toMatch(/prisma\.resellerServiceMap\.findUnique\(\{\s*where: \{ apiId: catalogueId \}/);
    // A retired mapping is not orderable, in bulk or anywhere.
    expect(loop).toMatch(/if \(!map\?\.serviceId \|\| map\.retiredAt\)/);
  });

  it('applies the Nitro floor only where there is a tier to carry it', () => {
    // That minimum is a property of a curated tier's GROUP. A full-list row has
    // no group, so the provider's own min is the only one there is — which is
    // exactly what calculateCreateOrderPricing does for single orders.
    expect(loop).toMatch(/const nitroMin = tier \? \(NITRO_MINS\[tier\.group\.type\?\.toLowerCase\(\)\] \|\| 50\) : 0;/);
    expect(loop).toMatch(/const effectiveMin = tier \? Math\.max\(service\.min, nitroMin\) : service\.min;/);
  });

  it('prices a tier-less row off the service', () => {
    expect(loop).toMatch(/Number\(tier \? tier\.sellPer1k : service\.sellPer1k\)/);
  });

  it('never dereferences a tier that may be null', () => {
    // Each of these crashed the request the moment a full-list row was in the
    // cart. They are the whole reason this is a branch and not a one-liner.
    expect(loop).not.toMatch(/Number\(tier\.sellPer1k\)/);
    expect(loop).not.toMatch(/\btier\.trafficTargeting/);
    expect(loop).toMatch(/if \(!tier\?\.trafficTargeting\)/);
    expect(loop).toMatch(/tier\?\.group\?\.tags\?\.includes\('drip'\)/);
    expect(loop).toMatch(/const bulkGroupType = \(tier\?\.group\?\.type \|\| ''\)/);
  });

  it('writes a null tierId on the order rather than reaching through one', () => {
    expect(route).toMatch(/tierId: o\.tier \? o\.tier\.id : null,/);
    // And the reorder path, which could not meet a full-list order before —
    // they were single-mode only, and a one-item cart is written batchId null.
    expect(route).toMatch(/Number\(o\.tier \? o\.tier\.sellPer1k : o\.service\.sellPer1k\)/);
  });

  it('keeps the duplicate key from confusing a tier id with a catalogue number', () => {
    // They are different counters. Unnamespaced, tier 412 and service 412 on
    // the same link would have masked one of the two as a duplicate.
    expect(loop).toMatch(/const dupKey = `\$\{wantsCatalogue \? `c\$\{catalogueId\}` : `t\$\{row\.tierId\}`\}:\$\{trimmedLink\}`;/);
  });

  it('names the offer without a tier without leaving a dangling bracket', () => {
    expect(route).toMatch(/\$\{offerSnapshot\.tierNameAtPurchase \? ` \(\$\{offerSnapshot\.tierNameAtPurchase\}\)` : ''\}/);
  });
});

describe('the client half', () => {
  it('sends whichever id the row carries', () => {
    expect(page).toMatch(/\.\.\.\(r\.tierId \? \{ tierId: r\.tierId \} : \{ catalogueId: r\.catalogueId \}\)/);
  });

  it('builds a cart row with no tier and the public number on it', () => {
    const add = page.slice(page.indexOf('const addFullRowToCart'));
    expect(add).toMatch(/svcId: `full:\$\{row\.id\}`, tierId: null, tier: null, catalogueId: row\.id,/);
  });

  it('badges a tier-less cart row as the full list, not as a blank pill', () => {
    // TS[row.tier] is undefined when tier is null, so the tier badge rendered
    // an empty coloured pill.
    expect([...page.matchAll(/\{row\.tier \|\| tr\("Full list"\)\}/g)]).toHaveLength(2);
  });

  it('keys price updates so a tier and a catalogue number cannot collide', () => {
    expect(page).toMatch(/updates\.set\(`t\$\{row\.tierId\}`, price\)/);
    expect(page).toMatch(/updates\.set\(`c\$\{row\.catalogueId\}`, price\)/);
    expect(page).toMatch(/serverUpdates\.get\(`t\$\{tier\.id\}`\)/);
  });

  it('gives the row a + and makes it the only way in', () => {
    expect(list).toMatch(/onAdd\(row\)/);
    expect(list).toMatch(/inCart > 0 \? <span className="m">\{inCart\}<\/span>/);
  });
});

/**
 * Where the bulk-mode instruction lives.
 *
 * It was a bare line at the top of the page — "Bulk mode · tap a tier to add it
 * to your cart" — repeating the ORDER MODE toggle six inches above it and the
 * "Tier · tap to add" label on every card below it, permanently, to somebody
 * who might already have thirteen items.
 *
 * The cart bar had a finished empty state all along — cart icon, "Your cart",
 * and how to add one — that nothing ever rendered, because the bar was gated on
 * having rows. So the instruction moves onto the object it describes, at the
 * bottom where the cart is, and stops being an instruction by becoming the cart.
 */
describe('the bulk-mode hint', () => {
  it('is the cart bar, which is up for the whole of bulk mode', () => {
    expect(page).toMatch(/\{orderMode === "bulk" && cartBounds && <BulkCartBar/);
    expect(page).not.toMatch(/orderMode === "bulk" && cartBounds && cartRows\.length > 0/);
  });

  it('leaves the page clear of the bar whether or not it holds anything', () => {
    // Padding keyed on rows meant the empty bar would sit over the last row.
    expect(page).toMatch(/paddingBottom: orderMode === "bulk" \? 82 : 0/);
  });

  it('says something true about the list you are actually on', () => {
    // "Tap a tier" is no help on the full list, which has none — it has a +.
    expect(page).toMatch(/hint=\{view === "full" \? msg\("Tap \+ on any service to add it"\) : msg\("Tap a tier to add an order"\)\}/);
  });

  it('is gone from the top of the page', () => {
    expect(page).not.toMatch(/tap a tier to add it to your cart/);
  });
});
