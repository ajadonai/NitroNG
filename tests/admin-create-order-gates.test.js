import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  tierFindUnique: vi.fn(),
  mapFindUnique: vi.fn(),
  serviceFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  settingFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    serviceTier: { findUnique: mocks.tierFindUnique, findMany: vi.fn(async () => []) },
    resellerServiceMap: { findUnique: mocks.mapFindUnique },
    service: { findUnique: mocks.serviceFindUnique },
    user: { findUnique: mocks.userFindUnique },
    setting: { findUnique: mocks.settingFindUnique },
    order: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/logger', () => ({ log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/admin', () => ({ requireAdmin: (...a) => mocks.requireAdmin(...a), logActivity: vi.fn() }));
vi.mock('@/lib/telegram', () => ({ tgNewOrder: vi.fn(), tgFreeOrder: vi.fn() }));
vi.mock('@/lib/first-order', () => ({ checkFirstOrder: vi.fn() }));
vi.mock('@/lib/nitro-rewards', () => ({ getNitroStatus: () => null, getEligibleSpendKoboTx: async () => 0 }));
vi.mock('@/lib/account-deletion', () => ({ lockOrderSettlementAccount: vi.fn(async () => ({ id: 'u1' })) }));

const { POST } = await import('@/app/api/admin/orders/create/route');

const post = (body) => POST({ json: async () => body, headers: new Headers(), url: 'https://nitro.ng/api/admin/orders/create' });
// `charge: true` is explicit: omitting it entirely is read as a free order and
// caught by the reason gate first, which is the safe way round.
const base = { mode: 'single', userId: 'u1', tierId: 'tier-1', quantity: 1500, link: 'https://x.com/a/status/1', charge: true };

beforeEach(() => vi.clearAllMocks());

function ready() {
  mocks.requireAdmin.mockResolvedValue({ admin: { name: 'Soludo' } });
  mocks.userFindUnique.mockResolvedValue({ id: 'u1', name: 'Grace', email: 'g@example.test', phone: null, balance: 1_000_000 });
  mocks.settingFindUnique.mockResolvedValue({ value: '1600' });
}

describe('a tier is required, and the price comes from it', () => {
  it('refuses an order whose tier does not exist or is switched off', async () => {
    ready();
    mocks.tierFindUnique.mockResolvedValue(null);
    const res = await post(base);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Tier not found or disabled/);
  });

  it('refuses a missing tierId before it even looks one up — there is no unpriced path through', async () => {
    ready();
    const res = await post({ ...base, tierId: undefined });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Tier is required');
    expect(mocks.tierFindUnique).not.toHaveBeenCalled();
  });

  it('the form cannot submit without one either', () => {
    const page = readFileSync(new URL('../components/admin-create-order-page.jsx', import.meta.url), 'utf8');
    // The Create button and the handler both hang off `ready`, which requires a
    // picked offer. Since 18 Sep 2026 that is a curated tier *or* a full-list
    // row — `picked` is the one gate, and neither branch can be empty.
    expect(page).toMatch(/mode === "single" \? \(picked && validQty/);
    expect(page).toMatch(/const picked = onFull \? !!fullRow : !!selectedTier;/);
    expect(page).toContain('if (!ready) return;');
    expect(page).toMatch(/disabled=\{!ready \|\| !typedOk\}/);
    // And the price it quotes comes off whichever was picked, so nothing picked
    // means no figure — not ₦0.
    expect(page).toContain('const quotePending = mode !== "bulk" && !picked;');
    expect(page).toMatch(/const sellPer1k = onFull \? \(fullRow\?\.price \|\| 0\)/);
  });

  it('sends the catalogue id for a full-list order, and a tier id otherwise', () => {
    const page = readFileSync(new URL('../components/admin-create-order-page.jsx', import.meta.url), 'utf8');
    // One or the other reaches the route, never both and never neither.
    expect(page).toMatch(/\.\.\.\(onFull \? \{ catalogueId: fullRow\.id \} : \{ tierId: selectedTier\.id \}\)/);
  });
});

describe('a free order has to say why', () => {
  it('refuses one with no reason, before it touches the customer or the tier', async () => {
    ready();
    const res = await post({ ...base, charge: false });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/needs a reason/);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.tierFindUnique).not.toHaveBeenCalled();
  });

  it('refuses a blank or one-character reason', async () => {
    ready();
    for (const freeReason of ['', '   ', 'x', null, 42]) {
      const res = await post({ ...base, charge: false, freeReason });
      expect(res.status, String(freeReason)).toBe(400);
    }
  });

  it('asks nothing of a charged order', async () => {
    ready();
    mocks.tierFindUnique.mockResolvedValue(null);   // stop it at the tier, after the reason gate
    const res = await post({ ...base, charge: true });
    expect((await res.json()).error).toMatch(/Tier not found/);
  });

  it('treats a request that forgets to say `charge` as free, and refuses it', async () => {
    ready();
    const { charge, ...noCharge } = base;
    const res = await post(noCharge);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/needs a reason/);
  });

  it('is wired to the alert and the activity log, and the form collects it', () => {
    const route = readFileSync(new URL('../app/api/admin/orders/create/route.js', import.meta.url), 'utf8');
    expect(route).toContain('tgFreeOrder({');
    expect(route).toMatch(/free — \$\{freeReason\}/);
    // The giveaway is priced even though the charge is zero.
    expect(route).toContain('const chargeKobo = shouldCharge ? valueKobo : 0;');
    const page = readFileSync(new URL('../components/admin-create-order-page.jsx', import.meta.url), 'utf8');
    expect(page).toContain('freeReasonOk');
    expect(page).toContain('{ freeReason: freeReason.trim() }');
    expect(page).toMatch(/Gives away .* of service · costs us/);
  });
});

/**
 * The full list, from the admin desk (18 Sep 2026).
 *
 * Admins could only place orders off the 325 curated tiers, so a customer who
 * bought from the wider list could not be helped with the thing they bought.
 */
describe('the full list is orderable from the desk too', () => {
  const fullBase = { mode: 'single', userId: 'u1', catalogueId: 4821, quantity: 1000, link: 'https://instagram.com/p/abc', charge: true };

  function listed(over = {}) {
    mocks.mapFindUnique.mockResolvedValue({ serviceId: 'svc-1', retiredAt: null });
    mocks.serviceFindUnique.mockResolvedValue({
      id: 'svc-1', name: 'Instagram Followers [Refill: 30D]', category: 'Instagram', platform: 'instagram',
      provider: 'mtp', providerListedAt: new Date(), costPer1k: 1.2, sellPer1k: 300_000,
      min: 100, max: 100_000, apiType: 'Default', enabled: false, ...over,
    });
  }

  it('never looks up a tier when a catalogue id is what was sent', async () => {
    ready(); listed();
    await post(fullBase);
    expect(mocks.tierFindUnique).not.toHaveBeenCalled();
    expect(mocks.mapFindUnique).toHaveBeenCalledWith({
      where: { apiId: 4821 },
      select: { serviceId: true, retiredAt: true },
    });
  });

  it('refuses a service the provider has stopped listing', async () => {
    ready(); listed({ providerListedAt: null });
    const res = await post(fullBase);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Service not available');
  });

  it('refuses a mapping that has been retired', async () => {
    ready();
    mocks.mapFindUnique.mockResolvedValue({ serviceId: 'svc-1', retiredAt: new Date() });
    const res = await post(fullBase);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Service not available');
  });

  it('sells a row that is listed but not curated, since enabled means curated here', async () => {
    ready(); listed({ enabled: false });
    const res = await post(fullBase);
    // Past every gate — it fails later only because $transaction is not wired
    // in this harness, which is exactly where the tier path ends up too.
    expect(await res.json()).not.toMatchObject({ error: 'Service not available' });
  });

  it('still refuses when neither a tier nor a catalogue id is sent', async () => {
    ready();
    const res = await post({ ...fullBase, catalogueId: undefined });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Tier is required');
    expect(mocks.tierFindUnique).not.toHaveBeenCalled();
    expect(mocks.mapFindUnique).not.toHaveBeenCalled();
  });
});
