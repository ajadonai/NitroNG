import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, validateName, sanitizeEmail, sanitizeString } from '@/lib/validate';

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.name@domain.ng')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('missing@tld')).toBe(false);
    expect(validateEmail('@no-local.com')).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts valid passwords', () => {
    expect(validatePassword('abc123')).toBe(true);
    expect(validatePassword('a'.repeat(128))).toBe(true);
  });

  it('rejects too short', () => {
    expect(validatePassword('12345')).toBe(false);
    expect(validatePassword('')).toBe(false);
  });

  it('rejects too long', () => {
    expect(validatePassword('a'.repeat(129))).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(validatePassword(null)).toBe(false);
    expect(validatePassword(123456)).toBe(false);
  });
});

describe('validateName', () => {
  it('accepts valid names', () => {
    expect(validateName('Chioma Adeola')).toBe(true);
    expect(validateName("O'Brien")).toBe(true);
    expect(validateName('Anne-Marie')).toBe(true);
    expect(validateName('José García')).toBe(true);
  });

  it('rejects names with special characters', () => {
    expect(validateName('user<script>')).toBe(false);
    expect(validateName('DROP TABLE')).toBe(true); // only letters — this is fine
    expect(validateName('12345')).toBe(false);
    expect(validateName('user@name')).toBe(false);
  });

  it('rejects too short or too long', () => {
    expect(validateName('A')).toBe(false);
    expect(validateName('a'.repeat(101))).toBe(false);
  });
});

describe('sanitizeEmail', () => {
  it('lowercases and trims', () => {
    expect(sanitizeEmail('  USER@Example.COM  ')).toBe('user@example.com');
  });

  it('truncates at 254 chars', () => {
    const long = 'a'.repeat(300) + '@test.com';
    expect(sanitizeEmail(long).length).toBeLessThanOrEqual(254);
  });

  it('handles null/undefined', () => {
    expect(sanitizeEmail(null)).toBe('');
    expect(sanitizeEmail(undefined)).toBe('');
  });
});

describe('sanitizeString', () => {
  it('trims and slices', () => {
    expect(sanitizeString('  hello  ', 5)).toBe('hello');
    expect(sanitizeString('longstring', 4)).toBe('long');
  });

  it('handles non-strings', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(123)).toBe('');
  });
});
