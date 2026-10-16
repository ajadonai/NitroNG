import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placeAuthError } from '../lib/auth-errors.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('placeAuthError', () => {
  it('puts each login failure on the field it is about', () => {
    expect(placeAuthError('No account found with this email')).toEqual({ field: 'email', code: 'no-account' });
    // Mentions both fields; it is the password that was wrong.
    expect(placeAuthError('Invalid email or password')).toEqual({ field: 'password', code: 'wrong-password' });
  });

  it('sends taken emails and numbers back to their fields', () => {
    expect(placeAuthError('This email is already in use')).toEqual({ field: 'email', code: 'taken' });
    expect(placeAuthError('This WhatsApp number is already in use')).toEqual({ field: 'phone', code: 'taken' });
  });

  it('reads the typo suggestion out of the sentence', () => {
    expect(placeAuthError('Did you mean ada.obi@gmail.com?')).toEqual({ field: 'email', code: 'typo', suggestion: 'ada.obi@gmail.com' });
  });

  it('places invalid emails, numbers, names and passwords', () => {
    expect(placeAuthError('Please enter a valid email address').field).toBe('email');
    expect(placeAuthError("Disposable email addresses aren't allowed. Please use a permanent email.").field).toBe('email');
    expect(placeAuthError('Enter a valid Nigerian number (e.g. 08012345678)').field).toBe('phone');
    expect(placeAuthError('Enter your WhatsApp number').field).toBe('phone');
    expect(placeAuthError('This name is reserved').field).toBe('name');
    expect(placeAuthError('First name and last name are required (letters only, no spaces)').field).toBe('name');
    expect(placeAuthError('Password must be 6-128 characters').field).toBe('password');
  });

  it('leaves anything it does not recognise for the line under the button', () => {
    for (const m of ['Too many login attempts. Try again in a minute.', 'Something went wrong. Please try again.', '', undefined, null])
      expect(placeAuthError(m)).toEqual({ field: null, code: 'other' });
  });

  it('still matches the sentences the routes actually send', () => {
    // If a route rewords one of these, the message would quietly fall through
    // to the line under the button. This keeps the two in step.
    const login = source('app/api/auth/login/route.js');
    const signup = source('app/api/auth/signup/route.js');
    expect(login).toContain("'No account found with this email'");
    expect(login).toContain("'Invalid email or password'");
    expect(signup).toContain("'This email is already in use'");
    expect(signup).toContain("'This WhatsApp number is already in use'");
    expect(signup).toContain('Did you mean ${');
  });
});
