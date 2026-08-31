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
