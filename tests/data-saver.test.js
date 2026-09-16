import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pollEvery, SAVER_FACTOR } from '@/components/use-data-saver';

/**
 * The connection decides, not a settings toggle.
 *
 * The audit asked for a Data-Saver switch. That is wrong twice: the things it
 * would turn off — aurora, grain, shimmer — cost CPU and battery rather than
 * data, so the name lies; and a setting nobody finds helps nobody. The real
 * data eater is the polling nobody can see, and the browser already knows the
 * answer, so we ask it.
 */
const hook = readFileSync(new URL('../components/use-data-saver.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');
const nav = readFileSync(new URL('../components/shared-nav.jsx', import.meta.url), 'utf8');
const addFunds = readFileSync(new URL('../components/addfunds-page.jsx', import.meta.url), 'utf8');

describe('what counts as a constrained connection', () => {
  it('trusts the OS Data Saver the visitor already turned on', () => {
    // Somebody who set it has answered this for every site they visit. Asking
    // again in our settings is asking them to say it twice.
    expect(hook).toMatch(/conn\.saveData === true/);
  });

  it('reads measured speed, not the radio badge', () => {
    // effectiveType is round-trip time and throughput, so a phone showing 4G on
    // a congested cell reports 3g here — which is the honest answer.
    for (const t of ['2g', 'slow-2g', '3g']) expect(hook, t).toContain(`'${t}'`);
    expect(hook, '4g is not constrained').not.toMatch(/=== '4g'/);
  });

  it('gives browsers that report nothing the full experience', () => {
    // Safari and Firefox expose no connection. No evidence, no narrowing.
    expect(hook).toMatch(/if \(!conn\) return undefined;/);
  });

  it('re-reads when the connection changes', () => {
    // Somebody walks out of the office onto mobile data mid-order.
    expect(hook).toMatch(/conn\.addEventListener\?\.\('change', read\)/);
    expect(hook).toMatch(/conn\.removeEventListener\?\.\('change', read\)/);
  });

  it('renders the same on the server and the first client paint', () => {
    expect(hook).toMatch(/useState\(false\)/);
  });
});

describe('the polling it stretches', () => {
  it('multiplies rather than stops, so a live page stays live', () => {
    expect(pollEvery(60000, true)).toBe(180000);
    expect(pollEvery(60000, false)).toBe(60000);
    expect(SAVER_FACTOR).toBe(3);
  });

  it('reaches both dashboard pollers, and re-runs when the connection flips', () => {
    // An interval already running does not change length on its own; without
    // `saving` in the dependency array this would only ever apply to somebody
    // who arrived on a slow connection.
    expect(dash).toMatch(/setInterval\(refreshDashboard, pollEvery\(45000, saving\)\)/);
    expect(dash).toMatch(/setInterval\(poll, pollEvery\(60000, saving\)\)/);
    expect(dash).toMatch(/\}, \[active, saving\]\)/);
    expect(dash).toMatch(/\}, \[saving\]\);/);
  });

  it('leaves the crypto deposit poll alone', () => {
    // It runs for a few minutes while somebody watches for a payment to
    // confirm. The kilobytes saved are not worth a person believing their money
    // has vanished.
    expect(addFunds).toMatch(/setInterval\(poll, 15000\)/);
    expect(addFunds, 'crypto poll must not be stretched').not.toMatch(/pollEvery\(15000/);
  });
});

describe('the ambient layer it stands down', () => {
  it('drops the aurora and the grain', () => {
    expect(css).toMatch(/:root\[data-saver\] \.nitro-atmo \{ background-image: none; \}/);
    expect(css).toMatch(/:root\[data-saver\] \.nitro-atmo::before \{ content: none; \}/);
  });

  it('keeps every status indicator moving', () => {
    // Each animate-pulse in the app means something is happening now: a deposit
    // pending, a payment confirming, a batch running, a promotion live. A live
    // state drawn as a dead one is a worse bug than a warm phone.
    expect(css, 'must not blanket-kill animate-pulse').not.toMatch(/data-saver\][^\n]*animate-pulse/);
    expect(css, 'skeletons say the page is loading').not.toMatch(/data-saver\][^\n]*skel-bone/);
  });

  it('is stamped from the provider that wraps every page', () => {
    // Somebody on 3g meets the landing page long before a dashboard.
    expect(nav).toMatch(/useDataSaver\(\);/);
    expect(hook).toMatch(/document\.documentElement\.toggleAttribute\('data-saver', constrained\)/);
  });

  it('ships no settings UI at all', () => {
    const settings = readFileSync(new URL('../components/settings-page.jsx', import.meta.url), 'utf8');
    expect(settings.toLowerCase()).not.toMatch(/data.saver/);
  });
});
