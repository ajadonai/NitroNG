import { describe, expect, it } from 'vitest';
import { GUEST_CODE_ALPHABET, newGuestCode, normalizeGuestCode } from '../lib/guest-code.js';

describe('guest codes', () => {
  it('look like G7K2-9XQM and use only the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const code = newGuestCode();
      expect(code).toMatch(/^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/);
      expect(code).not.toMatch(/[01ILOU]/);
    }
    expect(GUEST_CODE_ALPHABET).toHaveLength(30);
  });

  it('do not repeat in practice', () => {
    const seen = new Set(Array.from({ length: 5000 }, newGuestCode));
    expect(seen.size).toBe(5000);
  });

  it('accept what people actually type', () => {
    expect(normalizeGuestCode('g7k2-9xqm')).toBe('G7K2-9XQM');
    expect(normalizeGuestCode(' G7K2 9XQM ')).toBe('G7K2-9XQM');
    expect(normalizeGuestCode('G7K29XQM')).toBe('G7K2-9XQM');
  });

  it('refuse anything that cannot be a code', () => {
    for (const bad of ['', null, 'G7K2-9XQ', 'G7K2-9XQMM', 'G7K2-9XQ0', 'NTR-15978', 'O7K2-9XQM'])
      expect(normalizeGuestCode(bad), String(bad)).toBeNull();
  });
});
