import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { reportWindow, snap, windowFor, LAGOS } from '@/lib/report-window';

/**
 * One meaning of "a day" for the whole admin — fault 08 of the 15 Sep review.
 *
 * `createdAt` is a plain timestamp, so anything that truncates it naively cuts
 * the day at midnight UTC, which is 1am in Lagos. 1,935 of 44,500 clicks — 4.3%
 * — land in that hour and were filed on the day before the one they happened
 * on. A push at 1:30am on Friday was reported on Thursday.
 *
 * It was raised rather than fixed at the time, because correcting one page
 * would have made it disagree with every other. The tracking panel was fixed
 * on its own in v2.5.80 and did exactly that, which is what these pin shut.
 */
const analytics = readFileSync(new URL('../app/api/admin/analytics/route.js', import.meta.url), 'utf8');
const financials = readFileSync(new URL('../app/api/admin/financials/route.js', import.meta.url), 'utf8');

// A Tuesday afternoon in Lagos, and the 1am hour that started that same day.
const NOW = new Date('2026-09-15T14:23:00Z');
const LAGOS_1AM = new Date('2026-09-15T00:30:00Z');

const asLagosDate = (d) => d.toLocaleDateString('en-CA', { timeZone: LAGOS });

describe('the hour that was filed on the wrong day', () => {
  it('puts 00:30 UTC on the Lagos day it actually happened on', () => {
    // 00:30 UTC is 01:30 on 15 Sep in Lagos. Cut in UTC it is still the 15th
    // by luck here, but the day it BEGINS is what decides the bucket, and that
    // is the 14th in UTC and the 15th in Lagos.
    expect(asLagosDate(LAGOS_1AM)).toBe('2026-09-15');
    expect(asLagosDate(snap(LAGOS_1AM, 'day'))).toBe('2026-09-15');
    expect(snap(LAGOS_1AM, 'day').toISOString()).toBe('2026-09-14T23:00:00.000Z');
  });

  it('does not lose the first hour of a Lagos day out of the window', () => {
    // The whole fault, stated as a window: a 7-day range must contain 1:30am
    // of its own first day. A UTC cut opens an hour late and drops it.
    const { since } = reportWindow('7d', { now: NOW });
    const firstDay1am = new Date(since.getTime() + 90 * 60000);
    expect(firstDay1am >= since).toBe(true);
    expect(asLagosDate(since)).toBe('2026-09-09');
  });
});

describe('a preset range covers whole Lagos days', () => {
  it('starts at midnight in Lagos, not at this moment minus N days', () => {
    // now - 30 * 86400000 lands mid-afternoon on the 31st date back, so the
    // oldest day of every range was a fragment and the total moved as you
    // watched it.
    for (const [range, days] of [['7d', 7], ['30d', 30], ['90d', 90]]) {
      const { since, until } = reportWindow(range, { now: NOW });
      expect(since.toISOString(), range).toMatch(/T23:00:00\.000Z$/);
      expect((until - since) / 86400000, range).toBe(days);
    }
  });

  it('runs through the end of today, so today is included and in progress', () => {
    const { until } = reportWindow('30d', { now: NOW });
    expect(asLagosDate(new Date(until.getTime() - 1))).toBe('2026-09-15');
    expect(until > NOW).toBe(true);
  });

  it('gives the same answer twice an hour apart', () => {
    // The old arithmetic moved the window every time the page was reloaded,
    // so two admins comparing "the last 30 days" were comparing two windows.
    const a = reportWindow('30d', { now: NOW });
    const b = reportWindow('30d', { now: new Date(NOW.getTime() + 2 * 3600000) });
    expect(a.since.getTime()).toBe(b.since.getTime());
    expect(a.until.getTime()).toBe(b.until.getTime());
  });

  it('reads 24h as whole Lagos hours rather than a rolling instant', () => {
    const { since, until } = reportWindow('24h', { now: NOW });
    expect((until - since) / 3600000).toBe(24);
    expect(since.getUTCMinutes()).toBe(0);
  });

  it('takes its day ranges from the function the charts use', () => {
    // Same definition or the finance page and the chart beside it disagree
    // about which seven days "last 7 days" means.
    const w = windowFor('7d', { now: NOW });
    const r = reportWindow('7d', { now: NOW });
    expect(r.since.getTime()).toBe(w.start.getTime());
    expect(r.until.getTime()).toBe(w.end.getTime());
  });
});

describe('the calendar ranges', () => {
  it('opens the month at Lagos midnight on the 1st', () => {
    const { since } = reportWindow('month', { now: NOW });
    expect(since.toISOString()).toBe('2026-08-31T23:00:00.000Z');
    expect(asLagosDate(since)).toBe('2026-09-01');
  });

  it('closes last month where this one opens, with no gap and no overlap', () => {
    const last = reportWindow('lastmonth', { now: NOW });
    const thisOne = reportWindow('month', { now: NOW });
    expect(last.until.getTime()).toBe(thisOne.since.getTime());
    expect(asLagosDate(last.since)).toBe('2026-08-01');
  });

  it('opens the year on 1 January in Lagos', () => {
    expect(reportWindow('year', { now: NOW }).since.toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });

  it('filters nothing for all time', () => {
    expect(reportWindow('all', { now: NOW })).toEqual({ since: null, until: null });
  });
});

describe('the date picker agrees with the presets beside it', () => {
  it('cuts a custom range in Lagos on both pages', () => {
    // financials did `new Date(fromParam)` — a UTC midnight — while analytics
    // subtracted an hour by hand. The same fortnight gave two answers
    // depending on which page asked.
    const { since, until } = reportWindow('30d', { now: NOW, from: '2026-09-01', to: '2026-09-15' });
    expect(asLagosDate(since)).toBe('2026-09-01');
    expect(asLagosDate(new Date(until.getTime() - 1))).toBe('2026-09-15');
  });

  it('includes the whole of the to-date and nothing of the next day', () => {
    // `rangeEnd.setHours(23, 59, 59, 999)` ran in the server's timezone, so
    // the end of the range moved with the deploy region.
    const { until } = reportWindow('30d', { now: NOW, from: '2026-09-01', to: '2026-09-15' });
    expect(until.toISOString()).toBe('2026-09-15T23:00:00.000Z');
    expect(asLagosDate(until)).toBe('2026-09-16');
  });

  it('beats the preset when both are given', () => {
    const { since } = reportWindow('7d', { now: NOW, from: '2026-01-05' });
    expect(asLagosDate(since)).toBe('2026-01-05');
  });
});

describe('both finance pages read the same clock', () => {
  it('neither keeps its own range arithmetic', () => {
    for (const [name, src] of [['analytics', analytics], ['financials', financials]]) {
      expect(src, name).toMatch(/reportWindow\(range, \{ now, from: fromParam, to: toParam \}\)/);
      expect(src, `${name} still counts back in milliseconds`).not.toMatch(/24 \* 60 \* 60 \* 1000\)/);
      expect(src, `${name} still uses watBounds`).not.toMatch(/watBounds/);
    }
  });

  it('closes every window exclusively, custom ranges included', () => {
    // One page closed with lte and the other with lt, so a row landing on the
    // final millisecond was counted by one and not the other.
    expect(financials).not.toMatch(/rangeEndOp/);
    expect(financials).toMatch(/\{ gte: since, \.\.\.\(rangeEnd \? \{ lt: rangeEnd \} : \{\}\) \}/);
    expect(analytics).toMatch(/\{ gte: since, \.\.\.\(until && \{ lt: until \}\) \}/);
  });

  it('walks the chart in Lagos days rather than the server timezone', () => {
    // `d.setDate(d.getDate() + 1)` advanced the date in whatever zone the
    // server ran in — a silent dependency on the deploy region for a chart
    // about Nigerian days.
    expect(analytics).not.toMatch(/d\.setDate\(d\.getDate\(\) \+ 1\)/);
    expect(analytics).toMatch(/snap\(new Date\(d\.getTime\(\) \+ 36 \* 3600000\), 'day'\)/);
  });
});
