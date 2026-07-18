import { describe, expect, it } from 'vitest';
import { sentryBeforeSend } from '@/lib/sentry-filters';

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
});
