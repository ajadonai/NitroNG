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
