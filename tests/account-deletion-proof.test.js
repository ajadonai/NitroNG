import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { accountHasPassword, verifyAccountDeletionProof } from '@/lib/account-deletion';

// Google sign-ups are stored with password '' (app/api/auth/google/callback).
// The delete route used to demand a password match, which nothing those
// customers typed could satisfy — they could never delete their account.
const googleUser = { email: 'Grace@Example.com', password: '' };
const passwordUser = { email: 'ade@example.com', password: '$2b$12$hash' };
const compare = vi.fn(async (typed, hash) => typed === 'correct' && hash === '$2b$12$hash');

describe('accountHasPassword', () => {
  it("reads '' and missing as no password, a hash as one", () => {
    expect(accountHasPassword(googleUser)).toBe(false);
    expect(accountHasPassword({ email: 'x' })).toBe(false);
    expect(accountHasPassword(null)).toBe(false);
    expect(accountHasPassword(passwordUser)).toBe(true);
  });
});

describe('verifyAccountDeletionProof', () => {
  it('a password account still has to re-enter the password', async () => {
    expect(await verifyAccountDeletionProof(passwordUser, {}, { compare })).toMatchObject({ ok: false, status: 400, error: 'Password required to delete account' });
    expect(await verifyAccountDeletionProof(passwordUser, { password: 'wrong' }, { compare })).toMatchObject({ ok: false, error: 'Incorrect password' });
    expect(await verifyAccountDeletionProof(passwordUser, { password: 'correct' }, { compare })).toEqual({ ok: true, method: 'password' });
  });

  it('a password account cannot swap the password for a typed email', async () => {
    expect((await verifyAccountDeletionProof(passwordUser, { confirmEmail: 'ade@example.com' }, { compare })).ok).toBe(false);
  });

  it('a Google account confirms by typing its email — case and spacing forgiven, anything else refused', async () => {
    expect(await verifyAccountDeletionProof(googleUser, { confirmEmail: '  grace@example.com ' }, { compare })).toEqual({ ok: true, method: 'email' });
    expect((await verifyAccountDeletionProof(googleUser, { confirmEmail: 'someone@else.com' }, { compare })).ok).toBe(false);
    expect((await verifyAccountDeletionProof(googleUser, {}, { compare })).ok).toBe(false);
    // A typed password means nothing on an account that has none.
    expect((await verifyAccountDeletionProof(googleUser, { password: 'anything' }, { compare })).ok).toBe(false);
    expect(compare).not.toHaveBeenCalledWith('anything', '');
  });

  it('never compares against an empty hash', async () => {
    compare.mockClear();
    await verifyAccountDeletionProof(googleUser, { password: 'x', confirmEmail: 'grace@example.com' }, { compare });
    expect(compare).not.toHaveBeenCalled();
  });
});

describe('the route and the page use the proof', () => {
  it('the delete route no longer compares the password itself', () => {
    const route = readFileSync(new URL('../app/api/auth/delete-account/route.js', import.meta.url), 'utf8');
    expect(route).toContain('verifyAccountDeletionProof(user, { password, confirmEmail }');
    expect(route).not.toContain('bcrypt.compare(password, user.password)');
  });

  it('Settings asks a Google account for its email, and the dashboard payload says which it is', () => {
    const page = readFileSync(new URL('../components/settings-page.jsx', import.meta.url), 'utf8');
    expect(page).toContain('{ confirmEmail: deleteProof }');
    expect(page).toContain('tr("Type your email address to confirm")');
    const dashboard = readFileSync(new URL('../app/api/dashboard/route.js', import.meta.url), 'utf8');
    expect(dashboard).toContain('hasPassword:');
  });
});
