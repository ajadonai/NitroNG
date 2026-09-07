import prisma from './prisma.js';
import { depositRateForPremium, FALLBACK_DEPOSIT_RATE } from './currency.js';

/**
 * The one deposit rate, resolved server-side.
 *
 * Both the crypto invoice and the currency display call this, so the naira a
 * dollar credits and the dollars a naira price shows are always the same
 * number read in opposite directions. That is the whole point: what you see
 * is what you pay, on every day, not only after a switch is thrown.
 *
 * Two modes, chosen by the `fx_premium_live` setting:
 *
 *   off  → the legacy rate the crypto rail has always credited at
 *          (`markup_usd_rate`, market plus the pricing cushion). Byte-identical
 *          to the behaviour before this module existed.
 *   on   → market ÷ (1 + premium%), the foreign-payer premium Nitro chose.
 *
 * The switch exists because moving USDT payers from the legacy rate to the
 * premium is a visible price jump for people mostly in Nigeria, so it has to
 * be a deliberate act in Admin rather than a side effect of shipping a nav
 * button.
 *
 * No caching here: the crypto route must see an Admin change on the very next
 * invoice. The public display endpoint caches at the route layer instead.
 */

export const DEFAULT_PREMIUM_PERCENT = 15;

const KEYS = ['markup_usd_market', 'markup_usd_rate', 'fx_premium_percent', 'fx_premium_live', 'fx_usd_rates'];

const num = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Rates round to 2dp so the invoice maths stays in sane BigInt scale. */
const round2 = (n) => Math.round(n * 100) / 100;

export function resolveFromSettings(s = {}) {
  const market = num(s.markup_usd_market);
  const legacy = num(s.markup_usd_rate);
  const premium = s.fx_premium_percent === undefined || s.fx_premium_percent === null || s.fx_premium_percent === ''
    ? DEFAULT_PREMIUM_PERCENT
    : num(s.fx_premium_percent);
  const live = String(s.fx_premium_live ?? '0') === '1';

  let depositRate, source;
  const viaPremium = live && market > 0 && premium !== null ? depositRateForPremium(market, premium) : null;
  if (viaPremium && viaPremium > 0) { depositRate = round2(viaPremium); source = 'premium'; }
  else if (legacy > 0) { depositRate = round2(legacy); source = 'legacy'; }
  else { depositRate = FALLBACK_DEPOSIT_RATE; source = 'fallback'; }

  let usdRates = {};
  try {
    const parsed = JSON.parse(s.fx_usd_rates || '{}');
    for (const [k, v] of Object.entries(parsed)) { const n = num(v); if (n > 0) usdRates[k] = n; }
  } catch { usdRates = {}; }

  return { depositRate, source, live, market, premium, usdRates };
}

export async function resolveDepositRate() {
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  const s = {};
  for (const r of rows) s[r.key] = r.value;
  return resolveFromSettings(s);
}
