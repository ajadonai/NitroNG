import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OffsetIcon } from '@/components/offset-icons';

/**
 * The offset-print icons on the user rail, the More sheet and the admin rail
 * (chosen 17 Oct 2026). OffsetIcon renders nothing for a name it does not
 * know, so a typo would leave a blank gap in a menu rather than an error.
 * This reads every name the two dashboards ask for and draws each one.
 */
const used = (file) => [...readFileSync(file, 'utf8').matchAll(/<OffsetIcon name="([^"]+)"/g)].map(m => m[1]);

describe('OffsetIcon', () => {
  const names = [...new Set([...used('components/dashboard.jsx'), ...used('components/admin-dashboard.jsx')])];

  it('is used by both rails', () => {
    expect(used('components/dashboard.jsx').length).toBeGreaterThanOrEqual(15);
    expect(used('components/admin-dashboard.jsx').length).toBe(30);
  });

  it('draws every icon a dashboard asks for, with the printed shape under it', () => {
    for (const name of names) {
      const html = renderToStaticMarkup(createElement(OffsetIcon, { name }));
      expect(html, name).toContain('class="ic-off"');
      expect(html, name).toContain('stroke="currentColor"');
    }
  });

  it('renders nothing for an unknown name', () => {
    expect(renderToStaticMarkup(createElement(OffsetIcon, { name: 'nope' }))).toBe('');
  });
});
