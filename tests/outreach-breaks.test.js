import { describe, expect, it } from 'vitest';
import { buildBreakMessage } from '@/app/api/cron/outreach-breaks/route';

const strip = (t) => t.replace(/<\/?[bi]>/g, '');
const day = { total: 100, done: 47, left: 53, reached: 28 };

describe('buildBreakMessage', () => {
  it('reports the morning against the whole day, with the reach rate', () => {
    const t = strip(buildBreakMessage('lunchStart', day));
    expect(t).toContain('back at 14:00');
    expect(t).toContain('Done: 47 (of 100)');
    expect(t).toContain('Reached: 28 (60%)');
  });

  // Chirping at someone who has had 30% of calls answered is how a message like
  // this stops being read.
  it('changes its tone with how the morning actually went', () => {
    expect(buildBreakMessage('lunchStart', day)).toContain('Strong morning');
    expect(buildBreakMessage('lunchStart', { ...day, reached: 20 })).toContain('Eat properly');
    expect(buildBreakMessage('lunchStart', { ...day, reached: 8 })).toContain('Some mornings go like that');
  });

  it('says when the next break is, so nobody has to watch the clock', () => {
    expect(buildBreakMessage('lunchEnd', day)).toContain('Next break is 16:00');
  });

  it('eases off as the list empties', () => {
    expect(buildBreakMessage('refreshEnd', { ...day, left: 22 })).toContain('back in the pool');
    expect(buildBreakMessage('refreshEnd', { ...day, left: 8 })).toContain('Close enough');
    expect(buildBreakMessage('refreshEnd', { ...day, left: 0 })).toContain('Nothing outstanding');
  });

  it('counts conversations at the end of the day, and marks a cleared list', () => {
    expect(buildBreakMessage('dayEnd', { total: 100, done: 94, left: 6, reached: 43 }))
      .toContain('43 real conversations');
    expect(buildBreakMessage('dayEnd', { total: 100, done: 100, left: 0, reached: 51 }))
      .toContain('Cleared the whole list');
  });

  it('drops the percentage rather than dividing by zero on an unworked day', () => {
    const t = strip(buildBreakMessage('dayEnd', { total: 100, done: 0, left: 100, reached: 0 }));
    expect(t).toContain('Reached: 0');
    expect(t).not.toContain('%');
  });
});
