import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sentryBeforeSend, sentryDenyUrls, sentryIgnoreErrors } from '@/lib/sentry-filters';

describe('sentryBeforeSend', () => {
  it('drops Snapchat in-app bridge noise', () => {
    const event = {
      exception: {
        values: [{ type: 'ReferenceError', value: "Can't find variable: SCDynimacBridge" }],
      },
    };

    expect(sentryBeforeSend(event, {})).toBeNull();
  });

  it('keeps normal application errors', () => {
    const event = {
      exception: {
        values: [{ type: 'TypeError', value: 'Cannot read properties of undefined' }],
      },
    };

    expect(sentryBeforeSend(event, {})).toBe(event);
  });

  // MetaMask rejects a plain object, not an Error, so Sentry records it as
  // "Object captured as promise rejection" with no usable exception value —
  // the message survives only on the hint. This is the /pulse issue of 14 Sep.
  it('drops a wallet extension rejecting a plain object, where only the hint carries the message', () => {
    const event = {
      exception: { values: [{ type: 'UnhandledRejection', value: 'Object captured as promise rejection with keys: code, message, stack' }] },
    };
    const hint = {
      originalException: {
        code: -32603,
        message: 'Failed to connect to MetaMask',
        stack: 'i: Failed to connect to MetaMask\n    at Object.connect (chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/scripts/inpage.js:7:84292)',
      },
    };
    expect(sentryBeforeSend(event, hint)).toBeNull();
  });

  // Issue 7705466381, 22 Sep on /. A second wallet-style extension rejects a
  // bare { code, message } object with no stack at all, so there is nothing in
  // the exception or the hint to match against — the message text itself never
  // reaches Sentry. The only surviving evidence is the console trail its own
  // content script leaves on the page, none of which is ours (checked: zero
  // matches anywhere in Nitro's source for any of these four lines).
  it('drops a second extension that rejects with no message and no stack, by its console trail', () => {
    const event = {
      exception: { values: [{ type: 'UnhandledRejection', value: 'Object captured as promise rejection with keys: code, message' }] },
      breadcrumbs: [
        { category: 'console', level: 'info', message: 'test true' },
        { category: 'console', level: 'info', message: 'New version detected. Clearing LocalStorage. Old version: None, New version: 1.0.4' },
        { category: 'console', level: 'info', message: 'Resetting login state' },
        { category: 'console', level: 'info', message: 'Resetting claim state' },
      ],
    };
    const hint = { originalException: { code: -1, message: undefined } };
    expect(sentryBeforeSend(event, hint)).toBeNull();
  });

  // 28 Sep, /dashboard: same issue ID as the test above, but the first fix
  // missed it — this is the "versions already match" branch of the same
  // check, which shares none of the four lines the "clear and reset" branch
  // logs. Only "test false" is common to both reports, which is why that is
  // now the anchor rather than a detail of one branch.
  it('drops the other branch of the same version check, reported four days later', () => {
    const event = {
      exception: { values: [{ type: 'UnhandledRejection', value: 'Object captured as promise rejection with keys: code, message' }] },
      breadcrumbs: [
        { category: 'console', level: 'info', message: 'test false' },
        { category: 'console', level: 'info', message: 'Version numbers match. No need to clear. Current version: 1.0.4' },
      ],
    };
    expect(sentryBeforeSend(event, {})).toBeNull();
  });

  it('reads breadcrumbs in either shape Sentry has shipped: a bare array or { values }', () => {
    const event = {
      exception: { values: [{ type: 'UnhandledRejection', value: 'Object captured as promise rejection with keys: code, message' }] },
      breadcrumbs: { values: [{ category: 'console', message: 'Resetting claim state' }] },
    };
    expect(sentryBeforeSend(event, {})).toBeNull();
  });

  it('does not drop a real breadcrumb merely for containing the word test', () => {
    // `^test (true|false)$` matches the whole breadcrumb, not a substring —
    // this proves a legitimate log mentioning "test" in passing survives.
    const event = {
      exception: { values: [{ type: 'TypeError', value: 'Cannot read properties of undefined' }] },
      breadcrumbs: [{ category: 'console', message: 'Running test suite: 12 passed, 0 failed' }],
    };
    expect(sentryBeforeSend(event, {})).toBe(event);
  });

  it('keeps a real error that merely has breadcrumbs, unrelated ones', () => {
    const event = {
      exception: { values: [{ type: 'TypeError', value: 'Cannot read properties of undefined' }] },
      breadcrumbs: [{ category: 'navigation', message: 'User clicked checkout' }],
    };
    expect(sentryBeforeSend(event, {})).toBe(event);
  });

  it('drops anything whose stack is rooted in an extension, whichever browser', () => {
    for (const filename of [
      'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/scripts/inpage.js',
      'moz-extension://abc/inpage.js',
      'safari-web-extension://abc/content.js',
    ]) {
      const event = { exception: { values: [{ type: 'TypeError', value: 'x is not a function', stacktrace: { frames: [{ filename }] } }] } };
      expect(sentryBeforeSend(event, {}), filename).toBeNull();
    }
  });

  it('keeps an error that merely mentions an extension in passing', () => {
    const event = { exception: { values: [{ type: 'Error', value: 'Upload failed for chrome-extension screenshot', stacktrace: { frames: [{ filename: '/_next/static/chunk.js' }] } }] } };
    expect(sentryBeforeSend(event, {})).toBe(event);
  });

  it('is wired into the client Sentry init — filters, deny list and beforeSend', () => {
    const src = readFileSync(new URL('../instrumentation-client.js', import.meta.url), 'utf8');
    expect(src).toContain("from './lib/sentry-filters.js'");
    expect(src).toContain('...sentryIgnoreErrors');
    expect(src).toContain('...sentryDenyUrls');
    expect(src).toContain('if (isIgnoredBrowserNoise(event, hint)) return null;');
    expect(sentryIgnoreErrors.length).toBeGreaterThan(0);
    expect(sentryDenyUrls.length).toBeGreaterThan(0);
  });
});
