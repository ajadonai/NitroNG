import { describe, expect, it } from 'vitest';
import {
  TOUCH_LABEL, METHOD_LABEL, message, block, row, outcomeRows, touchRows, staffRows, pct, naira,
} from '@/lib/outreach-format';

describe('row', () => {
  it('bolds the value and parenthesises the note', () => {
    expect(row('📇', 'Handed out', 96)).toBe('  📇 Handed out: <b>96</b>');
    expect(row('✅', 'Worked', 71, '74%')).toBe('  ✅ Worked: <b>71</b> (74%)');
  });

  it('drops the icon slot entirely when there is none', () => {
    expect(row('', 'First Call', 30)).toBe('  First Call: <b>30</b>');
  });
});

describe('block', () => {
  it('returns null for an empty section so callers can omit it', () => {
    expect(block('Outcomes', [])).toBeNull();
    expect(block('Outcomes', [null, undefined])).toBeNull();
  });

  it('drops empty rows rather than printing gaps', () => {
    expect(block('Cards', [row('', 'a', 1), null, row('', 'b', 2)]))
      .toBe('<b>Cards</b>\n  a: <b>1</b>\n  b: <b>2</b>');
  });
});

describe('message', () => {
  it('separates sections by a blank line and skips the null ones', () => {
    expect(message('head', block('A', [row('', 'x', 1)]), block('B', [])))
      .toBe('head\n\n<b>A</b>\n  x: <b>1</b>');
  });
});

describe('outcomeRows', () => {
  it('keeps METHOD_LABEL order rather than insertion order', () => {
    const out = outcomeRows({ wrong_number: 5, call: 22 });
    expect(out[0]).toContain('Reached');
    expect(out[1]).toContain('Wrong number');
  });

  it('omits outcomes with no count', () => {
    expect(outcomeRows({ call: 1 })).toHaveLength(1);
  });
});

describe('touchRows', () => {
  it('sorts biggest first and omits touches nobody worked', () => {
    const out = touchRows({ day3: 12, day1: 30 });
    expect(out[0]).toContain('First Call');
    expect(out[1]).toContain('Follow-up');
    expect(out).toHaveLength(2);
  });
});

describe('staffRows', () => {
  it('sorts by volume', () => {
    expect(staffRows({ Eshiema: 27, Nitro: 44 })[0]).toContain('Nitro');
  });
});

describe('labels', () => {
  // firstDeposit and firstOrder are topics, not touch types. Listing them here
  // would let a topic-scoped lookup match a touch no contact row can carry.
  it('covers only the five real touch types', () => {
    expect(Object.keys(TOUCH_LABEL).sort())
      .toEqual(['backlog', 'day1', 'day3', 'day7', 'winback']);
  });

  it('gives every recorded outcome an icon and a label', () => {
    for (const v of Object.values(METHOD_LABEL)) {
      expect(v).toHaveLength(2);
      expect(v[0]).not.toBe('');
    }
  });
});

describe('numbers', () => {
  it('rounds kobo to naira with separators', () => {
    expect(naira(61000000)).toBe('₦610,000');
  });

  it('does not divide by zero', () => {
    expect(pct(5, 0)).toBe(0);
  });
});
