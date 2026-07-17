// Pure functions — no Prisma, no @/ aliases. Safe to import from plain Node scripts.

export const STATUS_TIERS = [
  { key: 'spark',  name: 'Spark',  min: 0,        discountPct: 0,   pointEarnPct: 0.5,  color: '#9ca3af' },
  { key: 'pulse',  name: 'Pulse',  min: 100000,   discountPct: 0.5, pointEarnPct: 1,    color: '#60a5fa' },
  { key: 'boost',  name: 'Boost',  min: 500000,   discountPct: 1,   pointEarnPct: 1.25, color: '#a78bfa' },
  { key: 'surge',  name: 'Surge',  min: 2000000,  discountPct: 2,   pointEarnPct: 1.5,  color: '#f472b6' },
  { key: 'apex',   name: 'Apex',   min: 7500000,  discountPct: 3,   pointEarnPct: 1.75, color: '#fb923c' },
  { key: 'legend', name: 'Legend', min: 15000000, discountPct: 4,   pointEarnPct: 2,    color: '#fbbf24' },
];

export const MIN_REDEEM_POINTS = 2000;

export function getStatusTiers() {
  return STATUS_TIERS;
}

export function getNitroStatus(eligibleSpendNaira) {
  let tier = STATUS_TIERS[0];
  for (const t of STATUS_TIERS) {
    if (eligibleSpendNaira >= t.min) tier = t;
    else break;
  }
  return tier;
}

export function computeNitroDiscount(chargeKobo, tier) {
  if (!tier || tier.discountPct <= 0) return 0;
  return Math.round(chargeKobo * (tier.discountPct / 100));
}

export function computePointsEarnedKobo(eligibleChargeKobo, tier) {
  if (!tier || tier.pointEarnPct <= 0 || eligibleChargeKobo <= 0) return 0;
  return Math.floor(eligibleChargeKobo * tier.pointEarnPct / 100);
}

export function pointsFromKobo(pointsKobo) {
  const whole = Math.trunc((Number(pointsKobo) || 0) / 100);
  return whole === 0 ? 0 : whole;
}

export function pointsFromKoboExact(pointsKobo) {
  return Number(((Number(pointsKobo) || 0) / 100).toFixed(2));
}
