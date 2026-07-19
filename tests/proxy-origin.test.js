import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { proxy } from '../proxy.js';

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
});

function mutation(origin) {
  return new NextRequest('https://nitro.example/api/orders', {
    method: 'POST',
    headers: { origin },
  });
}

describe('proxy canonical origin validation', () => {
  it('accepts the normalized canonical origin when configuration uses casing and a default port', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://Nitro.Example:443';

    const response = await proxy(mutation('https://nitro.example'));

    expect(response.status).toBe(200);
  });

  it('still rejects a foreign state-changing origin', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://Nitro.Example:443';

    const response = await proxy(mutation('https://evil.example'));

    expect(response.status).toBe(403);
  });
});
