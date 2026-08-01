import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.MTP_API_KEY = 'test-key';
process.env.MTP_API_URL = 'https://mtp.test/api/v2';

const { checkOrders } = await import('@/lib/smm');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('batched SMM status checks', () => {
  it('sends multiple IDs through the provider batch contract', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      '101': { status: 'Processing', remains: '75' },
      '102': { status: 'Completed', remains: '0' },
    }));

    const result = await checkOrders('mtp', ['101', '102']);

    expect(fetch).toHaveBeenCalledTimes(1);
    const body = new URLSearchParams(fetch.mock.calls[0][1].body);
    expect(body.get('action')).toBe('status');
    expect(body.get('orders')).toBe('101,102');
    expect(body.get('order')).toBeNull();
    expect(result['102']).toEqual({ status: 'Completed', remains: '0' });
  });

  it('keeps per-order provider errors without treating them as a status', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      '201': { status: 'Processing', remains: '20' },
      '202': { error: 'Incorrect order ID' },
    }));

    const result = await checkOrders('mtp', ['201', '202']);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result['202']).toEqual({ error: 'Incorrect order ID' });
  });

  it('leaves an omitted entry retryable without expanding into single requests', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      '301': { status: 'Completed', remains: '0' },
    }));

    const result = await checkOrders('mtp', ['301', '302']);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result['302']).toEqual({ error: 'Provider batch response omitted order' });
  });

  it('chunks at the providers maximum of 100 IDs', async () => {
    const ids = Array.from({ length: 101 }, (_, index) => String(index + 1));
    const firstBatch = Object.fromEntries(
      ids.slice(0, 100).map(id => [id, { status: 'Processing', remains: '1' }]),
    );
    fetch
      .mockResolvedValueOnce(jsonResponse(firstBatch))
      .mockResolvedValueOnce(jsonResponse({ status: 'Completed', remains: '0' }));

    const result = await checkOrders('mtp', ids);

    expect(fetch).toHaveBeenCalledTimes(2);
    const firstBody = new URLSearchParams(fetch.mock.calls[0][1].body);
    const secondBody = new URLSearchParams(fetch.mock.calls[1][1].body);
    expect(firstBody.get('orders').split(',')).toHaveLength(100);
    expect(secondBody.get('order')).toBe('101');
    expect(result['101'].status).toBe('Completed');
  });

  it('does not fan a rejected batch back out into N single checks', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ error: 'Batch unavailable' }));

    const result = await checkOrders('mtp', ['401', '402']);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result['401']).toEqual({ error: 'Batch unavailable' });
    expect(result['402']).toEqual({ error: 'Batch unavailable' });
  });
});
