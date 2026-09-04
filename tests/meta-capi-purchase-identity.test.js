import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { buildMetaEvent } from '@/lib/meta-capi';
import { buildFbcValue } from '@/components/cookie-banner';

const hex = v => crypto.createHash('sha256').update(v).digest('hex');

describe('Purchase user_data completeness', () => {
  it('carries ph, fbc and fbp when the source data exists — ph hashed, fbc/fbp raw', () => {
    const event = buildMetaEvent('Purchase', {
      eventId: 'purchase_NTR-1',
      email: 'Grace@Example.com',
      phone: '0803 123-4567',
      externalId: 'user_1',
      fbp: 'fb.1.1725000000000.914742735',
      fbc: 'fb.1.1725000000000.IwAR2xyz',
      clientIp: '105.112.1.1',
      userAgent: 'Mozilla/5.0',
    });
    const u = event.user_data;
    // Nigerian local number: leading zero dropped, 234 prefixed, THEN hashed.
    expect(u.ph).toEqual([hex('2348031234567')]);
    expect(u.ph[0]).toMatch(/^[0-9a-f]{64}$/);
    // Click/browser ids are sent exactly as the cookies hold them — never hashed.
    expect(u.fbc).toBe('fb.1.1725000000000.IwAR2xyz');
    expect(u.fbp).toBe('fb.1.1725000000000.914742735');
    expect(u.client_ip_address).toBe('105.112.1.1');
    expect(u.client_user_agent).toBe('Mozilla/5.0');
    expect(u.em).toEqual([hex('grace@example.com')]);
    expect(u.external_id).toEqual([hex('user_1')]);
    // The event id is the caller's, untouched — dedupe against the browser event depends on it.
    expect(event.event_id).toBe('purchase_NTR-1');
  });

  it('normalises already-international and bare local numbers the same way', () => {
    const ph = phone => buildMetaEvent('Purchase', { eventId: 'e', phone }).user_data.ph[0];
    expect(ph('+234 803 123 4567')).toBe(hex('2348031234567'));
    expect(ph('8031234567')).toBe(hex('2348031234567'));
    expect(ph('08031234567')).toBe(hex('2348031234567'));
  });

  it('never forces 234 onto a number that already carries a foreign country code', () => {
    const ph = phone => buildMetaEvent('Purchase', { eventId: 'e', phone }).user_data.ph[0];
    expect(ph('+44 7911 123456')).toBe(hex('447911123456'));
    expect(ph('+1 415 555 2671')).toBe(hex('14155552671'));
  });

  it('builds _fbc from a landing fbclid in Meta format', () => {
    expect(buildFbcValue('IwAR2xyz', 1725000000000)).toBe('fb.1.1725000000000.IwAR2xyz');
  });
});
