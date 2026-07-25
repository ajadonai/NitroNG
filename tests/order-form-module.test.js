import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { OrderForm as ExtractedOrderForm } from '@/components/order-form';
import { OrderForm } from '@/components/new-order';

const theme = {
  accent: '#c47d8e',
  cardBorder: '#ddd',
  text: '#222',
  textMuted: '#777',
  textSoft: '#555',
};

describe('order form module boundary', () => {
  it('keeps the compatibility export available from the customer order module', () => {
    expect(OrderForm).toBeTypeOf('function');
    expect(ExtractedOrderForm).toBeTypeOf('function');
  });

  it('renders the welcome-bonus shortfall branch after extraction', () => {
    const html = renderToStaticMarkup(React.createElement(ExtractedOrderForm, {
      selSvc: { name: 'Instagram Views', type: 'views' },
      selTier: {
        tier: 'Budget',
        min: 500,
        max: 100_000,
        price: 3_000,
        tags: [],
      },
      platform: 'instagram',
      qty: '1000',
      setQty: vi.fn(),
      link: 'instagram.com/p/ABC123',
      setLink: vi.fn(),
      comments: '',
      setComments: vi.fn(),
      dark: false,
      t: theme,
      onSubmit: vi.fn(),
      onTopUp: vi.fn(),
      orderLoading: false,
      balance: 0,
      welcomeBonusEligible: true,
    }));

    expect(html).toContain('Almost there');
    expect(html).toContain('Add funds &amp; claim bonus');
  });
});
