import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';

const siteInfoMocks = vi.hoisted(() => ({
  userCount: vi.fn(),
  orderCount: vi.fn(),
  orderGroupBy: vi.fn(),
  serviceGroupCount: vi.fn(),
  serviceGroupFindMany: vi.fn(),
  serviceTierCount: vi.fn(),
  settingFindMany: vi.fn(),
  alertFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: { count: (...args) => siteInfoMocks.userCount(...args) },
    order: {
      count: (...args) => siteInfoMocks.orderCount(...args),
      groupBy: (...args) => siteInfoMocks.orderGroupBy(...args),
    },
    serviceGroup: {
      count: (...args) => siteInfoMocks.serviceGroupCount(...args),
      findMany: (...args) => siteInfoMocks.serviceGroupFindMany(...args),
    },
    serviceTier: { count: (...args) => siteInfoMocks.serviceTierCount(...args) },
    setting: { findMany: (...args) => siteInfoMocks.settingFindMany(...args) },
    alert: { findMany: (...args) => siteInfoMocks.alertFindMany(...args) },
  },
}));

const { GET: getSiteInfo } = await import('@/app/api/site-info/route.js');

beforeEach(() => {
  vi.clearAllMocks();
  siteInfoMocks.userCount.mockResolvedValue(0);
  siteInfoMocks.orderCount.mockResolvedValue(0);
  siteInfoMocks.orderGroupBy.mockResolvedValue([]);
  siteInfoMocks.serviceGroupCount.mockResolvedValue(0);
  siteInfoMocks.serviceGroupFindMany.mockResolvedValue([]);
  siteInfoMocks.serviceTierCount.mockResolvedValue(0);
  siteInfoMocks.settingFindMany.mockResolvedValue([]);
  siteInfoMocks.alertFindMany.mockResolvedValue([]);
});

describe('landing attribution query state', () => {
  it('resolves affiliate and referral state before the first render', () => {
    expect(resolveLandingAuthQuery({ via: 'pit-crew' })).toEqual({
      via: 'pit-crew',
      ref: '',
      resetToken: '',
      initialModal: null,
      initialHeroAuth: 'signup',
    });

    expect(resolveLandingAuthQuery({ ref: 'NITRO123' })).toEqual({
      via: '',
      ref: 'NITRO123',
      resetToken: '',
      initialModal: 'signup',
      initialHeroAuth: 'login',
    });
  });

  it('normalises framework array values and bounds attribution input', () => {
    const result = resolveLandingAuthQuery({
      via: ['  first-affiliate  ', 'ignored-affiliate'],
      ref: 'R'.repeat(200),
    });

    expect(result.via).toBe('first-affiliate');
    expect(result.ref).toBe('R'.repeat(120));
    expect(result.initialModal).toBe('signup');
    expect(result.initialHeroAuth).toBe('signup');
  });

  it('also resolves direct auth and callback screens before hydration', () => {
    expect(resolveLandingAuthQuery({ login: '1' }).initialModal).toBe('login');
    expect(resolveLandingAuthQuery({ signup: '1' }).initialModal).toBe('signup');
    expect(resolveLandingAuthQuery({ error: 'disposable_email' }).initialModal).toBe('signup');
    expect(resolveLandingAuthQuery({ error: 'google_failed' }).initialModal).toBe('login');

    const reset = resolveLandingAuthQuery({ reset: 'secure-reset-token' });
    expect(reset.initialModal).toBe('reset');
    expect(reset.resetToken).toBe('secure-reset-token');
  });

  it('passes server-resolved state through every landing entrypoint', () => {
    const page = readFileSync('app/page.jsx', 'utf8');
    const home = readFileSync('components/home-client.jsx', 'utf8');
    const landing = readFileSync('components/landing-v3.jsx', 'utf8');
    const modal = readFileSync('components/auth-modal.jsx', 'utf8');

    expect(page).toContain('resolveLandingAuthQuery(await searchParams)');
    // Matched as "this element carries this prop" rather than as the whole tag,
    // so threading a second piece of server state through does not read as the
    // first one going missing. initialStats joined it in v2.5.140.
    expect(page).toMatch(/<HomeClient[^>]*initialAuthQuery=\{initialAuthQuery\}/);
    expect(home).toMatch(/<LandingPage[^>]*initialAuthQuery=\{initialAuthQuery\}/);
    expect(landing).toMatch(/<LandingInner[^>]*initialAuthQuery=\{initialAuthQuery\}/);
    // The stats the hero strip renders are resolved on the server too, so the
    // first frame cannot paint "0 Orders" while it waits for a fetch.
    expect(page).toMatch(/<HomeClient[^>]*initialStats=\{stats\.display\}/);
    expect(home).toMatch(/<LandingPage[^>]*initialStats=\{initialStats\}/);
    expect(landing).toMatch(/<LandingInner[^>]*initialStats=\{initialStats\}/);
    expect(landing).toContain('useState(initialStats||');
    expect(landing).not.toContain('typeof window!=="undefined"?new URLSearchParams');
    expect(landing).toContain('referralCode={heroRefCode}');
    expect(modal).not.toMatch(/window\.location\.search[\s\S]{0,100}get\(['"]ref['"]\)/);
  });

  it('keeps the auth modal out of server HTML while resolving its initial mode on the server', () => {
    const page = readFileSync('app/page.jsx', 'utf8');
    const landing = readFileSync('components/landing-v3.jsx', 'utf8');

    expect(page).toContain('resolveLandingAuthQuery(await searchParams)');
    // Matched as "this element carries this prop" rather than as the whole tag,
    // so threading a second piece of server state through does not read as the
    // first one going missing. initialStats joined it in v2.5.140.
    expect(page).toMatch(/<HomeClient[^>]*initialAuthQuery=\{initialAuthQuery\}/);
    expect(landing).toContain('useState(initialAuthQuery?.initialModal||null)');
    expect(landing).not.toContain('resolveLandingAuthQuery');
    expect(landing).toMatch(
      /const\s+AuthModal\s*=\s*dynamic\(\s*\(\)\s*=>\s*import\(["']\.\/auth-modal["']\)\s*,\s*\{\s*ssr:\s*false\s*\}\s*\);/,
    );
    expect(landing).not.toMatch(/import\s+AuthModal\s+from\s+["']\.\/auth-modal["']/);
  });
});

describe('public statistic labels', () => {
  it('describes the existing figures without claiming unsupported states', () => {
    const rootLayout = readFileSync('app/layout.jsx', 'utf8');
    const homePage = readFileSync('app/page.jsx', 'utf8');
    const signupPage = readFileSync('app/signup/page.jsx', 'utf8');
    const pricingPage = readFileSync('app/pricing/page.jsx', 'utf8');
    const faqPage = readFileSync('app/faq/page.jsx', 'utf8');
    const landing = readFileSync('components/landing-v3.jsx', 'utf8');
    const about = readFileSync('components/about-page.jsx', 'utf8');
    const faq = readFileSync('components/faq.jsx', 'utf8');
    const footer = readFileSync('components/shared-nav.jsx', 'utf8');
    const publicCopy = [
      rootLayout,
      homePage,
      signupPage,
      pricingPage,
      faqPage,
      landing,
      about,
      faq,
      footer,
    ].join('\n');

    // Each figure is labelled with what it actually counts. These read
    // components/landing-page.jsx until 14 Sep 2026 — a file with no importer —
    // so the honesty guard on the live landing's statistics was vacuous for as
    // long as v3 had been live. v3 wraps them in tr() and spaces them rather
    // than splitting on a newline; the guarantee is the label, not the
    // whitespace. The Live-activity strip was removed in v3 by design, so no
    // assertion replaces it.
    expect(landing).toContain('tr("Orders placed")');
    expect(landing).toContain('tr("Accounts created")');
    expect(landing).toContain('tr("Delivery benchmark")');
    expect(publicCopy).not.toContain('Orders delivered');
    expect(publicCopy).not.toContain('Active creators');
    expect(publicCopy).not.toContain('orders processing right now');
    expect(publicCopy).not.toContain('Nigerian creators already growing with Nitro');
    expect(publicCopy).not.toMatch(/35\+ (?:social media )?platforms/i);
    expect(publicCopy).not.toContain('35+ service categories');
  });

  it('publishes the live enabled tier count as services', async () => {
    siteInfoMocks.serviceTierCount.mockResolvedValue(137);

    const response = await getSiteInfo();
    const data = await response.json();

    expect(siteInfoMocks.serviceTierCount).toHaveBeenCalledWith({
      where: { enabled: true, group: { enabled: true } },
    });
    expect(data.stats.services).toBe(137);
  });

  it('preserves calculated public statistics without pinning mutable display values', () => {
    // The arithmetic moved out of the route into lib/site-stats in v2.5.140, so
    // that the homepage, /about, /services and /signup quote one set of numbers
    // instead of four. The invariants are unchanged; only their address is.
    const route = readFileSync('app/api/site-info/route.js', 'utf8');
    const stats = readFileSync('lib/site-stats.js', 'utf8');

    expect(route).toContain("import { getSiteStats } from '@/lib/site-stats';");
    // The route delegates rather than counting again — a second copy of these
    // fences is the drift this module exists to end.
    expect(route).not.toMatch(/prisma\.(user|order|serviceTier|serviceGroup)\./);

    expect(stats).toContain('const PROCESSING_BASE = 20;');
    // The head start lives in one shared constant, so nothing here carries its
    // own number: it imports the helper and applies it to the count.
    expect(stats).toContain("import { publicOrderCount } from '@/lib/public-counts';");
    expect(stats).toContain('publicOrderCount(realOrders)');
    expect(stats).not.toMatch(/ORDER_BASE\s*=\s*\d+/);
    const counts = readFileSync('lib/public-counts.js', 'utf8');
    expect(counts).toMatch(/export const ORDER_BASE = \d+;/);
    expect(stats).toContain('Math.max(90, Math.round');
    expect(stats).toContain('processing = live + PROCESSING_BASE;');
  });
});
