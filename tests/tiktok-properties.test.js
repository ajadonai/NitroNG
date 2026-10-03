import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contentIdFromEventId, tiktokProperties } from '@/lib/tiktok-properties';

/**
 * TikTok accepts an event and *then* flags bad properties as a diagnostic in
 * Events Manager, so a wrong content_type never throws and never shows up in
 * logs — it just quietly degrades match quality. These pin the two rules it
 * enforces, against the real rejection we got on 3 Oct.
 */
const ALLOWED = ['product', 'product_group'];

describe('the event TikTok actually rejected', () => {
  // Reported verbatim: content_type "landing" invalid, content_id missing,
  // from the homepage ViewContent.
  it('fixes the homepage ViewContent that was flagged', () => {
    const props = tiktokProperties({ content_name: 'homepage', content_type: 'landing' });
    expect(props.content_type).toBe('product_group');
    expect(props.content_id).toBe('homepage');
    expect(props.content_name).toBe('homepage');
  });
});

describe('content_type is always one TikTok allows', () => {
  // Every content_type the app actually sends, from the five trackViewContent
  // call sites. A new surface with an unmapped type must still come out valid.
  it.each([
    ['landing', 'product_group'],
    ['service_page', 'product_group'],
    ['service_type_page', 'product_group'],
    ['pricing', 'product_group'],
    ['product', 'product'],
  ])('maps %s to %s', (input, expected) => {
    expect(tiktokProperties({ content_name: 'x', content_type: input }).content_type).toBe(expected);
  });

  it('falls back to product_group for a type nobody has mapped yet', () => {
    const props = tiktokProperties({ content_name: 'blog-post', content_type: 'article' });
    // Claiming "product" would assert one buyable item; a group is the safe half.
    expect(props.content_type).toBe('product_group');
    expect(ALLOWED).toContain(props.content_type);
  });

  it('never emits a content_id without a content_type', () => {
    const props = tiktokProperties({ content_name: 'order_form' });
    expect(props.content_id).toBe('order_form');
    expect(ALLOWED).toContain(props.content_type);
  });
});

describe('content_id is always present and non-empty', () => {
  it('uses content_name, which is already a stable slug', () => {
    expect(tiktokProperties({ content_name: 'services-instagram' }).content_id).toBe('services-instagram');
  });

  it('prefers an explicit content_id over the name', () => {
    expect(tiktokProperties({ content_id: 'NTR-1', content_name: 'order_form' }).content_id).toBe('NTR-1');
  });

  it('recovers the business key from the event id when there is no name', () => {
    const props = tiktokProperties({ value: 8500, currency: 'NGN' }, { fallbackId: 'NTR-10955' });
    expect(props.content_id).toBe('NTR-10955');
    expect(props.value).toBe(8500);
    expect(props.currency).toBe('NGN');
  });

  // "must include at least one character other than whitespace"
  it('does not emit a blank or whitespace-only content_id', () => {
    expect(tiktokProperties({ content_name: '   ' }).content_id).toBeUndefined();
    expect(tiktokProperties({ content_name: '' })).toBeUndefined();
  });

  it('is undefined rather than an empty object when there is nothing to say', () => {
    expect(tiktokProperties(undefined)).toBeUndefined();
    expect(tiktokProperties({})).toBeUndefined();
    expect(tiktokProperties(null)).toBeUndefined();
  });
});

describe('contentIdFromEventId', () => {
  it('recovers the business key each deterministic id is built from', () => {
    expect(contentIdFromEventId('purchase_NTR-10955')).toBe('NTR-10955');
    expect(contentIdFromEventId('apinfo_TXN99')).toBe('TXN99');
    expect(contentIdFromEventId('reg_user42')).toBe('user42');
  });

  it('returns nothing for a random client-side id, rather than a useless one', () => {
    expect(contentIdFromEventId('392bf25d-6a7b-447c-9c3c-416b0ebff737')).toBeUndefined();
    expect(contentIdFromEventId(undefined)).toBeUndefined();
    expect(contentIdFromEventId('purchase_')).toBeUndefined();
  });
});

describe('both halves of the pixel translate identically', () => {
  // The browser and the server report the same event under the same event_id.
  // If only one of them translated, the pair would describe one conversion two
  // different ways — which is how deduplication quietly stops working.
  const tracker = readFileSync(new URL('../components/capi-tracker.jsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../app/api/capi/track/route.js', import.meta.url), 'utf8');

  it('the browser pixel sends translated properties', () => {
    expect(tracker).toMatch(/ttq\.track\([^;]*tiktokProperties\(customData\)/);
  });

  it('the server route sends translated properties', () => {
    expect(route).toMatch(/properties:\s*tiktokProperties\(custom_data\)/);
  });

  it('Meta still gets its own vocabulary, untranslated', () => {
    // Meta's history and optimisation are built on these values; translating
    // for TikTok must not change what Meta is sent.
    expect(tracker).toMatch(/window\.fbq\('track',\s*eventName,\s*customData\s*\|\|\s*\{\}/);
    expect(route).toMatch(/customData:\s*custom_data/);
  });
});
