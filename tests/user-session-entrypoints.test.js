import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('customer session issuance entrypoints', () => {
  it.each([
    'app/api/auth/login/route.js',
    'app/api/auth/signup/route.js',
    'app/api/auth/google/callback/route.js',
  ])('%s creates one durable row with the final token hash before setting the cookie', (path) => {
    const source = read(path);
    const id = source.indexOf('const sid = createSessionId()');
    const sign = source.indexOf('signUserToken(', id);
    const create = source.indexOf('prisma.session.create(', sign);
    const cookie = source.indexOf('setUserCookie(', create);

    expect(id).toBeGreaterThan(-1);
    expect(sign).toBeGreaterThan(id);
    expect(create).toBeGreaterThan(sign);
    expect(cookie).toBeGreaterThan(create);
    expect(source).toContain('id: sid');
    expect(source).toContain('tokenHash: hashToken(token)');
    expect(source).not.toContain("tokenHash: 'pending'");
    expect(source).not.toContain('prisma.session.update(');
  });
});

describe('customer logout clients', () => {
  it.each([
    ['components/dashboard.jsx', 'window.location.replace("/?logout=1")'],
    ['components/settings-page.jsx', 'window.location.replace("/")'],
    ['components/shared-nav.jsx', 'window.location.href = "/"'],
  ])('%s redirects only after a successful logout response', (path, redirect) => {
    const source = read(path);
    const request = source.indexOf('fetch("/api/auth/logout"');
    const statusCheck = source.indexOf('if (!res.ok)', request);
    const navigation = source.indexOf(redirect, statusCheck);

    expect(request).toBeGreaterThan(-1);
    expect(statusCheck).toBeGreaterThan(request);
    expect(navigation).toBeGreaterThan(statusCheck);
  });
});
