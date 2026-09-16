import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PROVIDER_IDS } from '@/lib/smm';

/**
 * Two providers, and one list that says which.
 *
 * jap was disconnected on 16 Sep 2026 — 22 orders in its whole life against
 * MTP's 6,050. Removing it touched eleven files, because several of them wrote
 * `['mtp', 'jap', 'dao']` out by hand instead of reading the register. These
 * pin the register as the single source so the next change is one edit.
 */
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const FILES = [
  'lib/smm.js', 'lib/env.js', 'lib/markup.js',
  'app/api/cron/prices/route.js', 'app/api/cron/balance/route.js', 'app/api/cron/daily/route.js',
  'app/api/admin/sync/route.js', 'app/api/admin/provider-topups/route.js', 'app/api/admin/issues/route.js',
  'components/admin-extra-pages.jsx', 'components/admin-pages.jsx', 'components/admin-pricing.jsx',
  'scripts/pull-providers.mjs',
];

describe('the provider register', () => {
  it('lists exactly the providers we can still reach', () => {
    expect(PROVIDER_IDS).toEqual(['mtp', 'dao']);
  });

  it('has no jap left anywhere that could reach the panel', () => {
    for (const f of FILES) {
      expect(read(f), `${f} still references jap`).not.toMatch(/\bjap\b|JAP_API/i);
    }
  });

  it('is read rather than rewritten by hand', () => {
    // The hardcoded triples are what made a one-provider removal an eleven-file
    // change. Anything enumerating providers reads PROVIDER_IDS now.
    for (const f of FILES) {
      expect(read(f), `${f} hardcodes the provider list`).not.toMatch(/\['mtp',\s*'dao'\]|\["mtp",\s*"dao"\]/);
    }
  });

  it('keeps the jap rows documented as receipts, not as debt', () => {
    // 22 orders point at 6,023 service rows. Deleting them would be refused by
    // the foreign key or would erase what those customers bought.
    const md = read('CLAUDE.md');
    expect(md).toMatch(/deliberately still in the table/);
    expect(md).toMatch(/providerListedAt: null` and `enabled: false/);
    expect(md).not.toMatch(/14 curated tiers still point at it/);
  });
});
