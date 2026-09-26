// Whether a provider still lists a service, and the one honest way to ask.
//
// The sync cron stamps `providerListedAt` on every service a provider still
// carries, and says nothing at all about the ones it dropped — no null, no
// flag. So "the provider stopped listing this" is only ever expressed as a
// timestamp that stopped moving, and every fence in the codebase tested
// `providerListedAt IS NOT NULL`, which a dropped row satisfies forever. A
// service could therefore be dropped upstream and stay orderable here
// indefinitely. Measured 26 Sep 2026: 896 of 10,038 orderable full-list rows
// had not been confirmed in 48h, and orders placed against that set over the
// previous 30 days were 17 for 17 cancelled — nothing completed, ever.
//
// ── Why the cutoff is relative to the provider, not to now ──
// The obvious version of this — `providerListedAt > now - 48h` — has a failure
// mode that is far worse than the bug it fixes. The cron returns early when it
// exhausts its write budget (`partial: true`), and that return happens BEFORE
// the stamping loop runs, so a couple of budget-starved days stamp nothing at
// all. Against a fixed `now - 48h`, every one of that provider's thousands of
// rows would cross the line at once and the catalogue would empty itself over
// a cron hiccup.
//
// Measuring against the provider's own newest stamp removes that entirely. If
// a sync ran today, rows missing from the last two days of runs are stale. If
// syncing has been broken for a week, the newest stamp is a week old too, so
// nothing is stale and nothing disappears — the comparison carries its own
// guard rather than needing a second one bolted on.
import prisma from '@/lib/prisma';

export const PROVIDER_LISTING_GRACE_MS = 48 * 60 * 60 * 1000;

// A minute is plenty: the cutoff only moves when a sync runs, once a day per
// provider. Short enough that it cannot stack meaningfully on top of any
// route's own revalidate window the way lib/site-stats' five-minute memo once
// did. Off under test, because one process-wide cache would otherwise hand the
// second test whatever the first test's mocks returned.
const TTL_MS = 60 * 1000;
const CACHEABLE = process.env.NODE_ENV !== 'test';
let cache = null;

/**
 * `{ mtp: Date|null, dao: Date|null }` — the instant before which a row of
 * that provider's counts as dropped. Null means we have no successful sync to
 * measure against, so nothing of that provider's should be treated as stale.
 */
export async function staleCutoffs() {
  if (CACHEABLE && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = {};
  try {
    const rows = await prisma.service.groupBy({
      by: ['provider'],
      where: { provider: { in: ['mtp', 'dao'] }, providerListedAt: { not: null } },
      _max: { providerListedAt: true },
    });
    for (const r of rows) {
      const newest = r._max.providerListedAt;
      value[r.provider] = newest ? new Date(newest.getTime() - PROVIDER_LISTING_GRACE_MS) : null;
    }
  } catch {
    // A failed lookup must not hide the catalogue. No cutoffs means no filtering.
    return {};
  }
  if (CACHEABLE) cache = { at: Date.now(), value };
  return value;
}

/**
 * A Prisma `AND` clause keeping only rows their provider still lists. Providers
 * with no usable cutoff are passed through unfiltered rather than excluded.
 */
export async function listedRecentlyWhere() {
  const cutoffs = await staleCutoffs();
  const clauses = ['mtp', 'dao'].map(p => (
    cutoffs[p]
      ? { provider: p, providerListedAt: { gte: cutoffs[p] } }
      : { provider: p }
  ));
  return { OR: clauses };
}

/** The same test for a single already-loaded service row. */
export function isListedRecently(service, cutoffs = {}) {
  if (!service?.providerListedAt) return false;
  const cutoff = cutoffs[service.provider];
  if (!cutoff) return true;
  return new Date(service.providerListedAt).getTime() >= cutoff.getTime();
}
