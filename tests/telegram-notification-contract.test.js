import { afterEach, describe, expect, it, vi } from 'vitest';

const originalToken = process.env.TG_BOT_TOKEN;
const originalChat = process.env.TG_CHAT_ID;

afterEach(() => {
  if (originalToken === undefined) delete process.env.TG_BOT_TOKEN;
  else process.env.TG_BOT_TOKEN = originalToken;
  if (originalChat === undefined) delete process.env.TG_CHAT_ID;
  else process.env.TG_CHAT_ID = originalChat;
  vi.resetModules();
});

describe('Telegram notification promise contract', () => {
  it('returns a thenable for a new-order notification when Telegram is not configured', async () => {
    delete process.env.TG_BOT_TOKEN;
    delete process.env.TG_CHAT_ID;
    vi.resetModules();

    const { tgNewOrder } = await import('@/lib/telegram');
    const notification = tgNewOrder(
      'NTR-1',
      'Instagram Followers',
      1_000,
      100_000,
      'Test Customer',
      'https://instagram.com/test',
      'instagram',
    );

    expect(notification).toBeDefined();
    expect(typeof notification.then).toBe('function');
    await expect(notification).resolves.toBeUndefined();
  });
});
