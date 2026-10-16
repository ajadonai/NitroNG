import { describe, expect, it } from 'vitest';
import { suggestEmail } from '../lib/email-typos.js';

describe('suggestEmail', () => {
  it('points a slipped domain at the one that was meant, keeping the name as typed', () => {
    expect(suggestEmail('ada.obi@gmial.com')).toBe('ada.obi@gmail.com');
    expect(suggestEmail('Ada@YAHOO.CO')).toBe('Ada@yahoo.com');
  });

  it('says nothing about a real domain, or about something that is not an address yet', () => {
    expect(suggestEmail('ada@gmail.com')).toBeNull();
    expect(suggestEmail('ada@nitro.ng')).toBeNull();
    expect(suggestEmail('ada')).toBeNull();
    expect(suggestEmail('@gmial.com')).toBeNull();
    expect(suggestEmail(undefined)).toBeNull();
  });
});
