import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A pinned handle follows the person, not the phone.
 *
 * New Order offers the last five links somebody ordered for on a platform, and
 * one can be pinned so it fills the box next time. That pin lived in
 * localStorage, so a creator who pinned their main account on a laptop opened
 * the same page on their phone and found nothing pinned — the opposite of what
 * pinning is for.
 */
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), groupBy: vi.fn(), me: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: {
    user: { findUnique: mocks.findUnique, update: mocks.update },
    order: { groupBy: mocks.groupBy },
  },
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.me }));

const { GET, POST, readPins } = await import('@/app/api/orders/recent-links/route');
const form = readFileSync(new URL('../components/order-form.jsx', import.meta.url), 'utf8');

const post = async (body) => {
  const r = await POST(new Request('http://x/api/orders/recent-links', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: r.status, body: await r.json() };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.me.mockResolvedValue({ id: 'u1' });
  mocks.groupBy.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue({ pinnedLinks: null });
  mocks.update.mockResolvedValue({});
});

describe('the pin lives on the account', () => {
  it('rides along with the links, so one request serves the page', async () => {
    mocks.findUnique.mockResolvedValue({ pinnedLinks: JSON.stringify({ instagram: 'https://instagram.com/me' }) });
    const r = await GET(new Request('http://x/api/orders/recent-links?platform=instagram'));
    expect((await r.json()).pinned).toBe('https://instagram.com/me');
  });

  it('answers null for a platform with nothing pinned', async () => {
    mocks.findUnique.mockResolvedValue({ pinnedLinks: JSON.stringify({ tiktok: 'https://tiktok.com/@me' }) });
    const r = await GET(new Request('http://x/api/orders/recent-links?platform=instagram'));
    expect((await r.json()).pinned).toBeNull();
  });

  it('keeps one pin per platform, because one box gets filled', async () => {
    mocks.findUnique.mockResolvedValue({ pinnedLinks: JSON.stringify({ instagram: 'https://instagram.com/old' }) });
    await post({ platform: 'instagram', link: 'https://instagram.com/new' });
    expect(JSON.parse(mocks.update.mock.calls[0][0].data.pinnedLinks)).toEqual({ instagram: 'https://instagram.com/new' });
  });

  it('leaves other platforms alone when one changes', async () => {
    mocks.findUnique.mockResolvedValue({ pinnedLinks: JSON.stringify({ tiktok: 'https://tiktok.com/@me' }) });
    await post({ platform: 'instagram', link: 'https://instagram.com/me' });
    expect(JSON.parse(mocks.update.mock.calls[0][0].data.pinnedLinks)).toEqual({
      tiktok: 'https://tiktok.com/@me', instagram: 'https://instagram.com/me',
    });
  });

  it('clears a pin with a null link rather than a separate action', async () => {
    mocks.findUnique.mockResolvedValue({ pinnedLinks: JSON.stringify({ instagram: 'https://instagram.com/me' }) });
    const r = await post({ platform: 'instagram', link: null });
    expect(r.body.pinned).toBeNull();
    expect(JSON.parse(mocks.update.mock.calls[0][0].data.pinnedLinks)).toEqual({});
  });

  it('refuses anything that is not a URL, since it fills a URL box', async () => {
    for (const bad of ['javascript:alert(1)', 'not a link', 'x'.repeat(501)]) {
      expect((await post({ platform: 'instagram', link: bad })).status, bad.slice(0, 20)).toBe(400);
    }
    expect((await post({ link: 'https://x.com/a' })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('turns away anyone not signed in', async () => {
    mocks.me.mockResolvedValue(null);
    expect((await post({ platform: 'instagram', link: 'https://x.com/a' })).status).toBe(401);
  });

  it('survives a column holding something that is not a pin map', () => {
    // It is a text column, so it may hold anything at all.
    for (const junk of [null, '', 'not json', '[]', '"a string"', '5']) {
      expect(readPins(junk)).toEqual({});
    }
  });
});

describe('the order form', () => {
  it('reads the pin from the response, not from the browser', () => {
    expect(form).toMatch(/setPinned\(d\.pinned \|\| null\)/);
    expect(form, 'no localStorage pin left').not.toMatch(/nitro-pin:/);
  });

  it('writes the pin back when the star is tapped', () => {
    const fn = form.slice(form.indexOf('const togglePin = (url) => {'), form.indexOf('const shortLink ='));
    expect(fn).toMatch(/body: JSON\.stringify\(\{ platform, link: next \}\)/);
    // Optimistic — the star flips first. A star that hesitates on every tap is
    // worse than one that is briefly wrong and corrects on the next visit.
    expect(fn.indexOf('setPinned(next)')).toBeLessThan(fn.indexOf('fetch('));
  });
});
