import { describe, it, expect, vi } from 'vitest';

const mockPrisma = {
  setting: { findMany: vi.fn() },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

const {
  AFFILIATE_KEYS, ALL_AFFILIATE_KEY_NAMES, TIER_RATE_KEYS,
  getAffiliateSettings, getTierRates, getTierConfig, rateForRole,
} = await import('@/lib/affiliate-settings');

describe('AFFILIATE_KEYS', () => {
  it('contains all 12 canonical keys', () => {
    expect(ALL_AFFILIATE_KEY_NAMES).toHaveLength(12);
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_enabled');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_starter_rate');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_growth_rate');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_pro_rate');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_lead_split');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_growth_threshold');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_pro_threshold');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_hold_days');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_min_payout');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_min_order');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('affiliate_max_links');
    expect(ALL_AFFILIATE_KEY_NAMES).toContain('crew_telegram_group_link');
  });

  it('has defaults matching pre-refactor hardcoded values', () => {
    expect(AFFILIATE_KEYS.affiliate_starter_rate.default).toBe(30);
    expect(AFFILIATE_KEYS.affiliate_growth_rate.default).toBe(40);
    expect(AFFILIATE_KEYS.affiliate_pro_rate.default).toBe(50);
    expect(AFFILIATE_KEYS.affiliate_lead_split.default).toBe(40);
    expect(AFFILIATE_KEYS.affiliate_growth_threshold.default).toBe(30);
    expect(AFFILIATE_KEYS.affiliate_pro_threshold.default).toBe(100);
    expect(AFFILIATE_KEYS.affiliate_hold_days.default).toBe(7);
    expect(AFFILIATE_KEYS.affiliate_min_payout.default).toBe(5000);
    expect(AFFILIATE_KEYS.affiliate_min_order.default).toBe(1000);
    expect(AFFILIATE_KEYS.affiliate_max_links.default).toBe(5);
  });
});

describe('TIER_RATE_KEYS', () => {
  it('maps tiers to setting keys', () => {
    expect(TIER_RATE_KEYS).toEqual({
      starter: 'affiliate_starter_rate',
      growth: 'affiliate_growth_rate',
      pro: 'affiliate_pro_rate',
    });
  });
});

describe('getAffiliateSettings', () => {
  it('returns DB values when present', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: 'affiliate_starter_rate', value: '25' },
      { key: 'affiliate_hold_days', value: '14' },
    ]);
    const s = await getAffiliateSettings(['affiliate_starter_rate', 'affiliate_hold_days']);
    expect(s.affiliate_starter_rate).toBe(25);
    expect(s.affiliate_hold_days).toBe(14);
  });

  it('returns defaults when DB rows are missing', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([]);
    const s = await getAffiliateSettings(['affiliate_starter_rate', 'affiliate_max_links']);
    expect(s.affiliate_starter_rate).toBe(30);
    expect(s.affiliate_max_links).toBe(5);
  });

  it('returns default for non-numeric DB value', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: 'affiliate_starter_rate', value: 'banana' },
    ]);
    const s = await getAffiliateSettings(['affiliate_starter_rate']);
    expect(s.affiliate_starter_rate).toBe(30);
  });

  it('returns string values for non-numeric keys', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: 'affiliate_enabled', value: 'false' },
      { key: 'crew_telegram_group_link', value: 'https://t.me/test' },
    ]);
    const s = await getAffiliateSettings(['affiliate_enabled', 'crew_telegram_group_link']);
    expect(s.affiliate_enabled).toBe('false');
    expect(s.crew_telegram_group_link).toBe('https://t.me/test');
  });

  it('accepts custom db parameter for transaction context', async () => {
    const mockTx = { setting: { findMany: vi.fn().mockResolvedValue([{ key: 'affiliate_pro_rate', value: '60' }]) } };
    const s = await getAffiliateSettings(['affiliate_pro_rate'], mockTx);
    expect(s.affiliate_pro_rate).toBe(60);
    expect(mockTx.setting.findMany).toHaveBeenCalled();
  });
});

describe('getTierRates', () => {
  it('returns starter/growth/pro rates', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([
      { key: 'affiliate_starter_rate', value: '25' },
      { key: 'affiliate_growth_rate', value: '35' },
      { key: 'affiliate_pro_rate', value: '45' },
    ]);
    const rates = await getTierRates();
    expect(rates).toEqual({ starter: 25, growth: 35, pro: 45 });
  });

  it('falls back to defaults', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([]);
    const rates = await getTierRates();
    expect(rates).toEqual({ starter: 30, growth: 40, pro: 50 });
  });
});

describe('getTierConfig', () => {
  it('returns full tier config with thresholds and lead split', async () => {
    mockPrisma.setting.findMany.mockResolvedValue([]);
    const config = await getTierConfig();
    expect(config).toEqual({
      starter: { rate: 30, min: 0 },
      growth: { rate: 40, min: 30 },
      pro: { rate: 50, min: 100 },
      leadSplit: 40,
    });
  });
});

describe('rateForRole', () => {
  it('returns pro rate for chief', () => {
    expect(rateForRole({ starter: 30, pro: 50 }, 'chief')).toBe(50);
  });

  it('returns starter rate for crew', () => {
    expect(rateForRole({ starter: 30, pro: 50 }, 'crew')).toBe(30);
  });
});
