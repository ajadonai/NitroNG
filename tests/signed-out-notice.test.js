import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { safeReturnTo } from '../lib/safe-return.js';
import { SIGNOUT_REASON } from '../lib/auth.js';

const landing = readFileSync(new URL('../components/landing-v3.jsx', import.meta.url), 'utf8');
const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');
const route = readFileSync(new URL('../app/api/dashboard/route.js', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../components/auth-modal.jsx', import.meta.url), 'utf8');

/**
 * The notice used to tell everybody their account had been signed into on
 * another device. Nitro allows five concurrent sessions, so that is the one
 * cause it almost never has — while a 24-hour timeout, which is what nearly
 * everybody sees, was being reported as a possible account takeover.
 */
describe('the return path', () => {
  it('keeps ordinary same-site paths', () => {
    for (const p of ['/dashboard', '/new-order', '/wallet?topup=1', '/orders/48120'])
      expect(safeReturnTo(p), p).toBe(p);
  });

  it('refuses a protocol-relative URL, which is the open-redirect hole', () => {
    // A browser reads "//evil.com" as another origin, so this would turn a
    // nitro.ng link into a redirect onto someone's copy of our login page.
    for (const p of ['//evil.com', '//evil.com/login', '///evil.com'])
      expect(safeReturnTo(p), p).toBe('');
  });

  it('refuses backslashes, which some browsers fold into slashes', () => {
    for (const p of ['/\\evil.com', '\\\\evil.com', '/ok\\..\\evil'])
      expect(safeReturnTo(p), p).toBe('');
  });

  it('refuses absolute and relative URLs', () => {
    for (const p of ['https://evil.com', 'http://evil.com', 'dashboard', 'javascript:alert(1)'])
      expect(safeReturnTo(p), p).toBe('');
  });

  it('refuses nothing at all', () => {
    for (const p of ['', null, undefined, 0, {}, []]) expect(safeReturnTo(p)).toBe('');
  });
});

describe('the reason', () => {
  it('names only causes that can be proved', () => {
    // A missing session row is the same row whether it was removed by a remote
    // sign-out, the five-session cap, or a password change. One reason covers
    // all three rather than the notice picking one and sounding certain.
    expect(Object.values(SIGNOUT_REASON).sort()).toEqual(['aged_out', 'blocked', 'expired', 'revoked']);
  });

  it('travels on the 401 body', () => {
    expect(route).toMatch(/getCurrentUserWithReason\(\)/);
    expect(route).toMatch(/error: 'Not authenticated', reason/);
  });

  it('is read back with the path the session ended on', () => {
    expect(dash).toMatch(/signedOutRedirect/);
    expect(dash).toMatch(/p\.set\("signed_out", reason\)/);
    expect(dash).toMatch(/window\.location\.pathname \+ window\.location\.search/);
    // Both 401 sites, not just the one that was easy to find.
    expect(dash.match(/await signedOutRedirect\(res\)/g)).toHaveLength(2);
    expect(dash).not.toMatch(/session_expired=1/);
  });

  it('picks copy per cause, and never claims another device', () => {
    for (const r of ['expired', 'aged_out', 'revoked', 'blocked']) expect(landing).toContain(`${r}:{t:`);
    expect(landing).not.toContain('Your account was logged in on another device');
  });

  it('sends a suspended account to WhatsApp rather than to a login form', () => {
    // getCurrentUser returns null for a Suspended or PendingDeletion account
    // too, so that person was being told their account was accessed elsewhere.
    expect(landing).toContain("This account can't be used right now");
    expect(landing).toMatch(/blocked=signOutReason==="blocked"/);
    expect(landing).toMatch(/\{!blocked&&</);
  });
});

describe('the notice', () => {
  it('centres the badge against the block, not the first line', () => {
    expect(landing).toMatch(/<div className="flex gap-2\.5 items-center">/);
  });

  it('carries one action, and drops the second button', () => {
    expect(landing).toContain('{tr("Sign in")}');
    expect(landing).not.toContain('tr(tr("Log In"))');
    expect(landing).not.toContain('{tr("Reset Password")}');
  });

  it('only promises to restore a page when there is one', () => {
    expect(landing).toMatch(/\{returnTo&&<div/);
  });

  it('hands the destination to the login form', () => {
    expect(landing).toMatch(/returnTo=\{returnTo\}/);
    expect(modal).toMatch(/returnTo = ""/);
    expect(modal).toMatch(/window\.location\.replace\(returnTo \|\| '\/dashboard'\)/);
  });
});
