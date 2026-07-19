import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveLandingAuthQuery } from '@/lib/landing-auth-query';

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
    const landing = readFileSync('components/landing-page.jsx', 'utf8');
    const modal = readFileSync('components/auth-modal.jsx', 'utf8');

    expect(page).toContain('resolveLandingAuthQuery(await searchParams)');
    expect(page).toContain('<HomeClient initialAuthQuery={initialAuthQuery} />');
    expect(home).toContain('<LandingPage initialAuthQuery={initialAuthQuery} />');
    expect(landing).toContain('<LandingInner initialAuthQuery={initialAuthQuery} />');
    expect(landing).not.toContain('typeof window!=="undefined"?new URLSearchParams');
    expect(landing).toContain('referralCode={heroRefCode}');
    expect(modal).not.toMatch(/window\.location\.search[\s\S]{0,100}get\(['"]ref['"]\)/);
  });
});

describe('public statistic labels', () => {
  it('describes the existing figures without claiming unsupported states', () => {
    const rootLayout = readFileSync('app/layout.jsx', 'utf8');
    const homePage = readFileSync('app/page.jsx', 'utf8');
    const signupPage = readFileSync('app/signup/page.jsx', 'utf8');
    const pricingPage = readFileSync('app/pricing/page.jsx', 'utf8');
    const faqPage = readFileSync('app/faq/page.jsx', 'utf8');
    const landing = readFileSync('components/landing-page.jsx', 'utf8');
    const belowFold = readFileSync('components/landing-below-fold.jsx', 'utf8');
    const about = readFileSync('components/about-page.jsx', 'utf8');
    const faq = readFileSync('components/faq.jsx', 'utf8');
    const footer = readFileSync('components/shared-nav.jsx', 'utf8');
    const support = readFileSync('components/support-page.jsx', 'utf8');
    const publicCopy = [
      rootLayout,
      homePage,
      signupPage,
      pricingPage,
      faqPage,
      landing,
      belowFold,
      about,
      faq,
      footer,
      support,
    ].join('\n');

    expect(landing).toContain('Orders\\nplaced');
    expect(landing).toContain('Accounts\\ncreated');
    expect(landing).toContain('Delivery\\nbenchmark');
    expect(landing).toContain('Live activity:');
    expect(about).toContain("'Service categories'");
    expect(publicCopy).not.toContain('Orders delivered');
    expect(publicCopy).not.toContain('Active creators');
    expect(publicCopy).not.toContain('orders processing right now');
    expect(publicCopy).not.toContain('Nigerian creators already growing with Nitro');
    expect(publicCopy).not.toMatch(/35\+ (?:social media )?platforms/i);
    expect(publicCopy).toContain('35+ service categories');
  });

  it('preserves the existing public statistic additions and minimums', () => {
    const route = readFileSync('app/api/site-info/route.js', 'utf8');

    expect(route).toContain('const ORDER_BASE = 20000;');
    expect(route).toContain('const PROCESSING_BASE = 20;');
    expect(route).toContain('const displayOrders = orderCount + ORDER_BASE;');
    expect(route).toContain('Math.max(90, Math.round');
    expect(route).toContain('processingCount = liveProcessing + PROCESSING_BASE;');
  });
});
