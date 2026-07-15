import prisma from '@/lib/prisma';

export const AFFILIATE_KEYS = {
  affiliate_enabled:          { default: 'true' },
  affiliate_starter_rate:     { default: 30,   min: 0, max: 100 },
  affiliate_growth_rate:      { default: 40,   min: 0, max: 100 },
  affiliate_pro_rate:         { default: 50,   min: 0, max: 100 },
  affiliate_lead_split:       { default: 40,   min: 0, max: 100 },
  affiliate_growth_threshold: { default: 30,   min: 1, max: 10000 },
  affiliate_pro_threshold:    { default: 100,  min: 1, max: 10000 },
  affiliate_hold_days:        { default: 7,    min: 0, max: 365 },
  affiliate_min_payout:       { default: 5000, min: 0, max: 1000000 },
  affiliate_min_order:        { default: 1000, min: 0, max: 1000000 },
  affiliate_max_links:        { default: 5,    min: 1, max: 100 },
  crew_telegram_group_link:   { default: '' },
};

export const ALL_AFFILIATE_KEY_NAMES = Object.keys(AFFILIATE_KEYS);

export const TIER_RATE_KEYS = {
  starter: 'affiliate_starter_rate',
  growth:  'affiliate_growth_rate',
  pro:     'affiliate_pro_rate',
};

function intOrDefault(val, key) {
  const parsed = parseInt(val);
  return Number.isFinite(parsed) ? parsed : AFFILIATE_KEYS[key].default;
}

export async function getAffiliateSettings(keys = ALL_AFFILIATE_KEY_NAMES, db = prisma) {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const sv = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const result = {};
  for (const key of keys) {
    const raw = sv[key];
    const def = AFFILIATE_KEYS[key]?.default;
    if (typeof def === 'number') {
      result[key] = raw != null ? intOrDefault(raw, key) : def;
    } else {
      result[key] = raw ?? def ?? '';
    }
  }
  return result;
}

export async function getTierRates(db = prisma) {
  const keys = ['affiliate_starter_rate', 'affiliate_growth_rate', 'affiliate_pro_rate'];
  const s = await getAffiliateSettings(keys, db);
  return {
    starter: s.affiliate_starter_rate,
    growth:  s.affiliate_growth_rate,
    pro:     s.affiliate_pro_rate,
  };
}

export async function getTierConfig(db = prisma) {
  const keys = [
    'affiliate_starter_rate', 'affiliate_growth_rate', 'affiliate_pro_rate',
    'affiliate_growth_threshold', 'affiliate_pro_threshold', 'affiliate_lead_split',
  ];
  const s = await getAffiliateSettings(keys, db);
  return {
    starter:   { rate: s.affiliate_starter_rate, min: 0 },
    growth:    { rate: s.affiliate_growth_rate,  min: s.affiliate_growth_threshold },
    pro:       { rate: s.affiliate_pro_rate,     min: s.affiliate_pro_threshold },
    leadSplit: s.affiliate_lead_split,
  };
}

export function rateForRole(tierRates, role) {
  return role === 'chief' ? tierRates.pro : tierRates.starter;
}

export function validateAffiliateSettings(entries) {
  const errors = [];
  const parsed = {};
  for (const [key, raw] of entries) {
    const spec = AFFILIATE_KEYS[key];
    if (!spec || spec.min == null) continue;
    const n = parseInt(raw);
    if (!Number.isFinite(n)) {
      errors.push(`${key}: must be a number`);
      continue;
    }
    if (n < spec.min || n > spec.max) {
      errors.push(`${key}: must be between ${spec.min} and ${spec.max}`);
      continue;
    }
    parsed[key] = n;
  }
  if (parsed.affiliate_growth_threshold != null && parsed.affiliate_pro_threshold != null) {
    if (parsed.affiliate_growth_threshold >= parsed.affiliate_pro_threshold) {
      errors.push('affiliate_growth_threshold must be less than affiliate_pro_threshold');
    }
  }
  return errors;
}
