import { describe, expect, it } from 'vitest';

describe('the guest receipt email', () => {
  it('carries the guest code, the order and the amount, and links to the order page', async () => {
    const { guestReceiptEmail } = await import('@/lib/email');
    const html = guestReceiptEmail({ code: 'G7K2-9XQM', orderId: 'NTR-15978', service: 'Instagram Followers', tier: 'Standard', quantity: 500, link: 'https://instagram.com/adaeze.styles', paidKobo: 1000000 });
    expect(html).toContain('G7K2-9XQM');
    expect(html).toContain('NTR-15978');
    expect(html).toContain('₦10,000');
    expect(html).toContain('/order/G7K2-9XQM');
    expect(html).toContain('Your guest code');
  });

  it('prints the link the guest typed as text, never as markup', async () => {
    const { guestReceiptEmail } = await import('@/lib/email');
    const html = guestReceiptEmail({ code: 'G7K2-9XQM', orderId: 'NTR-1', service: 'X Likes', quantity: 100, link: 'x.com/<img src=x onerror=alert(1)>', paidKobo: 100000 });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});
