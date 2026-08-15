import { describe, expect, it } from 'vitest';
import { callbackOptions, scheduleRetry, nextWorkingMorning, watLabel } from '@/lib/outreach-time';

// WAT is UTC+1, so 09:00 WAT is 08:00Z. Tue 25 Aug 2026 is a working day.
const wat = (h, m = 0, day = 25) => new Date(Date.UTC(2026, 7, day, h - 1, m));

describe('breaks', () => {
  it('pushes a retry landing in lunch to the end of it', () => {
    // 10:30 + 3h = 13:30 WAT, inside 13:00-14:00.
    expect(watLabel(scheduleRetry(3, wat(10, 30)))).toBe('14:00');
  });

  it('pushes a retry landing in the afternoon refresh to the end of it', () => {
    // 15:15 + 1h = 16:15 WAT, inside 16:00-16:30.
    expect(watLabel(scheduleRetry(1, wat(15, 15)))).toBe('16:30');
  });

  it('leaves a time between the two breaks alone', () => {
    expect(watLabel(scheduleRetry(1, wat(14, 15)))).toBe('15:15');
  });

  it('does not treat the moment a break ends as inside it', () => {
    expect(watLabel(scheduleRetry(1, wat(15, 30)))).toBe('16:30');
    expect(watLabel(scheduleRetry(3, wat(11)))).toBe('14:00');
  });
});

describe('callbackOptions', () => {
  it('never offers a slot inside either break', () => {
    for (let h = 9; h < 18; h++) {
      for (const o of callbackOptions(wat(h))) {
        if (o.label === 'Tomorrow') continue;
        const [hh, mm] = o.label.split(':').map(Number);
        const mins = hh * 60 + mm;
        expect(mins < 13 * 60 || mins >= 14 * 60).toBe(true);
        expect(mins < 16 * 60 || mins >= 16 * 60 + 30).toBe(true);
      }
    }
  });

  it('always offers Tomorrow, even when nothing fits today', () => {
    const late = callbackOptions(wat(17, 30));
    expect(late.some(o => o.label === 'Tomorrow')).toBe(true);
  });
});

describe('nextWorkingMorning', () => {
  it('rolls a Saturday callback past the weekend to Tuesday', () => {
    // Sat 29 Aug 2026, 15:00 WAT.
    const at = nextWorkingMorning(wat(15, 0, 29));
    expect(at.getUTCDay()).toBe(2);
    expect(watLabel(at)).toBe('09:00');
  });
});
