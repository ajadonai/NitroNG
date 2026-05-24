import { describe, expect, it } from 'vitest';
import { injectLiveValues } from '@/lib/blog-values';

describe('injectLiveValues', () => {
  it('replaces known blog placeholders', () => {
    const rendered = injectLiveValues(
      'We support {{platform_count}} platforms and {{service_count}} services.',
      {
        '{{platform_count}}': '29',
        '{{service_count}}': '190',
      }
    );

    expect(rendered).toBe('We support 29 platforms and 190 services.');
  });

  it('removes unresolved placeholders instead of leaking template tokens', () => {
    expect(injectLiveValues('Services: {{service_list}} {{missing_value}}', {
      '{{service_list}}': 'Instagram, TikTok',
    })).toBe('Services: Instagram, TikTok ');
  });
});
