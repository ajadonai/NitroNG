import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { phoneSearchDigits } from '../lib/phone-search.js';

describe('phone search', () => {
  // Stored numbers look like +2347061668928. These are the ways an admin types one.
  it('finds the same digits however the number is written', () => {
    for (const typed of ['07061668928', '+2347061668928', '2347061668928', '7061668928', '0706 166 8928', '+234 706-166-8928']) {
      expect(phoneSearchDigits(typed), typed).toBe('7061668928');
    }
  });

  // Since signup opened to five countries, a stored number can carry any of
  // their dial codes — searching only worked if the admin typed +234 before.
  it('finds a foreign number typed locally or in full', () => {
    for (const typed of ['07911123456', '+447911123456', '447911123456', '7911123456']) {
      expect(phoneSearchDigits(typed), typed).toBe('7911123456');
    }
    expect(phoneSearchDigits('+14155552671')).toBe('4155552671');
    expect(phoneSearchDigits('+254712345678')).toBe('712345678');
  });

  it('strips the longest matching dial code, so +234 is never read as +2', () => {
    // 234… is Nigeria, not a US number beginning 34.
    expect(phoneSearchDigits('+2348012345678')).toBe('8012345678');
  });

  it('accepts a partial number', () => {
    expect(phoneSearchDigits('668928')).toBe('668928');
    expect(phoneSearchDigits('07061')).toBe('7061');
  });

  it('ignores anything too short or not a number to search on', () => {
    for (const typed of ['', null, undefined, '070', '0706', '00', 'aisha', 'a@b.com']) {
      expect(phoneSearchDigits(typed), String(typed)).toBeNull();
    }
  });

  it('is used by the admin users and orders searches', () => {
    for (const f of ['app/api/admin/users/route.js', 'app/api/admin/orders/route.js']) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).toContain("import { phoneSearchDigits } from '@/lib/phone-search'");
      expect(src, f).toContain('const searchPhone = phoneSearchDigits(search)');
      expect(src, f).toMatch(/searchPhone \? \[\{ (user: \{ )?phone: \{ contains: searchPhone \}/);
    }
  });
});
