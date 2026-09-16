import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Who gets the credit when a contacted person deposits.
 *
 * Outreach could count touches, reach rates and outcomes, and never the money
 * that followed a call — an agent could work a list for a week and see nothing
 * attributed to them. These pin the rule, because an attribution argument is
 * worse than no attribution at all.
 *
 * Measured on 16 Sep: 2,068 contacts, 548 of them human-written with an agent,
 * and 31 of 2,406 deposits over 60 days attribute to somebody. Attribution is
 * the exception, so the quiet path — nobody contacted them — is the one that
 * has to stay cheap and silent.
 */
const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { outreachContact: { findFirst: mocks.findFirst } } }));

const { attributedTouch, ATTRIBUTION_DAYS, NOT_HUMAN_WORK } = await import('@/lib/outreach-attribution');
const src = readFileSync(new URL('../lib/outreach-attribution.js', import.meta.url), 'utf8');

const AT = new Date('2026-09-16T12:00:00Z');

beforeEach(() => { vi.clearAllMocks(); mocks.findFirst.mockResolvedValue(null); });

describe('the attribution rule', () => {
  it('credits the most recent human touch, not the first', async () => {
    // One deposit, one agent. Splitting it or crediting the first caller both
    // produce a number nobody can check against their own memory of the week.
    mocks.findFirst.mockResolvedValue({
      touchType: 'day1', method: 'whatsapp', contactedBy: '1935066216',
      contactedAt: new Date('2026-09-15T17:00:00Z'),
    });
    const t = await attributedTouch('u1', AT);
    expect(t.contactedBy).toBe('1935066216');
    expect(mocks.findFirst.mock.calls[0][0].orderBy).toEqual({ contactedAt: 'desc' });
  });

  it('will not credit a touch older than the window', async () => {
    // A call in June did not cause a deposit in September, and crediting it
    // would quietly inflate whoever worked the oldest lists.
    const where = () => mocks.findFirst.mock.calls[0][0].where;
    await attributedTouch('u1', AT);
    const floor = where().contactedAt.gte;
    expect(Math.round((AT - floor) / 86400000)).toBe(ATTRIBUTION_DAYS);
    expect(where().contactedAt.lte).toEqual(AT);
  });

  it('never credits a row the recycler wrote', async () => {
    // `expired` is written without anybody speaking to anyone. The weekly
    // summary already refuses to count it as work done.
    await attributedTouch('u1', AT);
    expect(mocks.findFirst.mock.calls[0][0].where.touchType).toEqual({ notIn: NOT_HUMAN_WORK });
    expect(NOT_HUMAN_WORK).toContain('expired');
    expect(mocks.findFirst.mock.calls[0][0].where.contactedBy).toEqual({ not: null });
  });

  it('answers null when nobody spoke to them, without inventing an agent', async () => {
    expect(await attributedTouch('u1', AT)).toBeNull();
    expect(await attributedTouch(null, AT)).toBeNull();
  });

  it('reports the gap in whole hours', async () => {
    mocks.findFirst.mockResolvedValue({
      touchType: 'day1', method: 'call', contactedBy: '1935066216',
      contactedAt: new Date('2026-09-16T09:29:00Z'),
    });
    const t = await attributedTouch('u1', AT);
    expect(t.hoursSince).toBe(3);
  });

  it('attributes against the deposit time, not against now', async () => {
    // So a replayed or back-dated credit lands on whoever was actually there.
    const earlier = new Date('2026-08-01T12:00:00Z');
    await attributedTouch('u1', earlier);
    expect(mocks.findFirst.mock.calls[0][0].where.contactedAt.lte).toEqual(earlier);
  });

  it('states the window as a number one edit changes', () => {
    expect(ATTRIBUTION_DAYS).toBe(14);
    expect(src).toMatch(/It is a judgement, not a measurement/);
  });
});
