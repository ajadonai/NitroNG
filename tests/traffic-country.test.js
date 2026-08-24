import { describe, expect, it } from 'vitest';
import { validateTrafficConfig, TRAFFIC_COUNTRIES, TRAFFIC_CONTINENTS } from '@/lib/order-create-input.server';

const base = { device: 'all', trafficType: 'keyword', keyword: 'news' };
const target = (country) => validateTrafficConfig({ ...base, country });

describe('traffic targeting', () => {
  it('accepts every code the provider publishes', () => {
    for (const code of [...Object.keys(TRAFFIC_COUNTRIES), ...Object.keys(TRAFFIC_CONTINENTS)]) {
      expect(target(code).ok, code).toBe(true);
    }
  });

  // WW is a first-class option in the provider's list, not a typo. An earlier
  // fix rejected it outright, which would have blocked a legitimate order.
  it('accepts WW for worldwide', () => {
    expect(target('WW').ok).toBe(true);
    expect(target('ww').value.country).toBe('WW');
  });

  it('accepts 3-letter continent codes', () => {
    expect(target('EUR').ok).toBe(true);
    expect(target('nam').value.country).toBe('NAM');
  });

  // The provider spells the United Kingdom UK; ISO says GB. Validating against
  // ISO would reject the code that actually works and accept one that does not.
  it('takes UK and refuses GB, matching the provider not ISO', () => {
    expect(target('UK').ok).toBe(true);
    expect(target('GB').ok).toBe(false);
  });

  it('refuses codes the provider does not carry, however plausible', () => {
    for (const bad of ['NG', 'XX', 'ALL', 'QQ']) {
      const r = target(bad);
      expect(r.ok, bad).toBe(false);
      expect(r.error).toContain('not a supported target');
    }
  });

  it('still rejects an empty or malformed country', () => {
    expect(target('').ok).toBe(false);
    expect(target('A').ok).toBe(false);
  });
});
