import { beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Where a deposit actually stopped.
 *
 * 60.0% of deposit initiations end funded; netting the 58% who finish within
 * seven days, true leakage is about 16.6% — roughly ₦20k a day of deposits and
 * ₦13k of gross profit. The rows say "initiated" and "finished" and nothing in
 * between, so somebody who closed the tab before the gateway loaded is
 * indistinguishable from somebody who saw it and walked away.
 *
 * Those are different problems — a slow handoff we can fix, against a pricing
 * or trust question that is a product decision — and one timestamp separates
 * them. Instrument, read a fortnight, then change the flow: the ₦3.25M of
 * "failed attempts" quoted on 11 Sep turned out to be abandonment rather than
 * failure, which is the mistake reading first avoids.
 */
const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), me: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { transaction: { updateMany: mocks.updateMany } } }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.me }));

const { POST } = await import('@/app/api/telemetry/checkout/route');
const page = readFileSync(new URL('../components/addfunds-page.jsx', import.meta.url), 'utf8');
const funnel = readFileSync(new URL('../app/api/admin/checkout-funnel/route.js', import.meta.url), 'utf8');

const beacon = async (body) => {
  const r = await POST(new Request('http://x/api/telemetry/checkout', { method: 'POST', body: JSON.stringify(body) }));
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

beforeEach(() => { vi.clearAllMocks(); mocks.me.mockResolvedValue({ id: 'u1' }); mocks.updateMany.mockResolvedValue({ count: 1 }); });

describe('the handoff beacon', () => {
  it('stamps only the caller\'s own unstamped deposit', async () => {
    await beacon({ reference: 'NTR-ABC' });
    expect(mocks.updateMany.mock.calls[0][0].where).toEqual({
      reference: 'NTR-ABC', userId: 'u1', type: 'deposit', gatewayHandoffAt: null,
    });
  });

  it('never moves a timestamp that already recorded the real handoff', () => {
    // gatewayHandoffAt: null in the where is the whole guard — a retried beacon
    // would otherwise rewrite the moment it is supposed to be measuring.
    const src = readFileSync(new URL('../app/api/telemetry/checkout/route.js', import.meta.url), 'utf8');
    expect(src).toMatch(/gatewayHandoffAt: null/);
  });

  it('refuses a request without a reference, and one without a session', async () => {
    expect((await beacon({})).status).toBe(400);
    mocks.me.mockResolvedValue(null);
    expect((await beacon({ reference: 'NTR-ABC' })).status).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('fires before the redirect, and cannot stop somebody paying', () => {
    const block = page.slice(page.indexOf('if (data.authorization_url) {'), page.indexOf('window.location.href = data.authorization_url;'));
    // sendBeacon, because the navigation on the next line cancels a fetch.
    expect(block).toMatch(/navigator\.sendBeacon\?\.\("\/api\/telemetry\/checkout", blob\)/);
    // Nothing awaited, everything swallowed.
    expect(block).not.toMatch(/await /);
    expect(block).toMatch(/catch \(\) => \{\}\)|catch \{\}/);
  });
});

describe('the funnel it produces', () => {
  it('stays off the protected cohort-stats path', () => {
    // That route's robots allowance and token behaviour are load-bearing for
    // the nightly check; a new subroute there would be changing a protected
    // surface to answer an unrelated question.
    expect(funnel).toMatch(/requireAdmin\('payments'\)/);
    expect(funnel).toMatch(/Deliberately NOT under \/api\/cron\/cohort-stats/);
  });

  it('splits the two failures that used to look identical', () => {
    expect(funnel).toMatch(/left_at_gateway:/);
    expect(funnel).toMatch(/never_arrived:/);
  });

  it('excludes rows from before the beacon rather than calling them abandoned', () => {
    // They carry no handoff and would every one read as never_arrived.
    expect(funnel).toMatch(/const BEACON_LIVE = '2026-09-16T00:00:00Z'/);
    expect(funnel).toMatch(/url\.searchParams\.get\('since'\) \|\| BEACON_LIVE/);
  });
});
