import { resolveDepositRate } from '@/lib/fx-deposit';
import { log } from '@/lib/logger';

/**
 * What the currency switcher needs, and nothing else: the resolved deposit
 * rate and the dollar cross rates. The premium percentage, the market rate and
 * the cushion stay private — they describe margin, and this endpoint is public.
 *
 * On any failure it answers with a null rate rather than an error, because the
 * client's contract is "no rate means show naira", and a broken FX lookup must
 * never take a price off the screen.
 */
export const revalidate = 300;

export async function GET() {
  try {
    const { depositRate, usdRates } = await resolveDepositRate();
    return Response.json(
      { depositRate, usdRates, asOf: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    log.warn('FX', `public rate lookup failed: ${err?.message}`);
    return Response.json({ depositRate: null, usdRates: {}, asOf: null });
  }
}
