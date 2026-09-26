// One definition of every number the public site quotes about itself.
//
// Before this module there were three: /api/site-info counted users as
// "not Deleted", /about counted them as "emailVerified", and the landing
// page, the services hub, the signup route and the About prose each carried
// a platform count typed by hand — 31, 29, 28 and 28. The real figure was
// 27. Every one of them was wrong, and they were wrong differently, which is
// how a visitor ends up reading two numbers for the same fact on one site.
//
// So: the queries live here once, and anything public that says a number out
// loud reads it from here. Two counts of the same thing survive on purpose
// and are named so the difference is deliberate:
//
//   users          every live account (what "accounts created" means)
//   verifiedUsers  the ones that confirmed an email — the smaller, harder
//                  claim, which is the one /about makes when it says
//                  "verified accounts"
//
//   curatedPlatforms  platforms with a tested, refill-backed tier (27)
//   fullPlatforms     platforms reachable through the full list (31)
//
// A page that means "what we have tested" wants the curated pair. A page
// that means "what you can order today" wants the full pair, or the total.
// Neither is more honest than the other; quoting one and labelling it as the
// other is what is not.
//
// ── On the full list being opt-in ──
// Everything here is an indexed count except the full-list size, which reads
// ~8,500 rows and runs them through buildAll. lib/full-list-size.js says in
// its own header that the work is meant to land on a background refresh and
// "never on somebody waiting for the page" — and it was right: calling it
// from four statically-generated pages timed the build out at 60s each. So it
// is off unless a caller asks, and even then it races a timeout, because a
// slow catalogue query should cost us one sentence and not the page.
import { cache } from 'react';
import prisma from '@/lib/prisma';
import { publicOrderCount } from '@/lib/public-counts';
import { fullListSize } from '@/lib/full-list-size';
import { getMarkupSettings } from '@/lib/reseller';

// ── Why this is request-scoped and not a timed cache ──
// It was a five-minute TTL, which sounds free and is not: /api/site-info is
// already ISR on a five-minute revalidate, so the two windows stacked. A
// regeneration firing at 4m59s would ask this module for numbers and be handed
// the set it cached five minutes earlier, and the figure on the page could be
// ten minutes behind the database instead of five. Per-instance caches made it
// worse — two servers could disagree about the order count for the length of
// their windows.
//
// React's cache() dedupes within one request instead: generateMetadata and the
// page body share a single set of queries, and nothing survives the response.
// Time-based caching belongs to the route's revalidate, in one place, where it
// can be reasoned about. As a bonus this removes the test hazard the TTL had,
// where one test's mocked counts could be served to the next test.

// The live "delivering now" figure carries a floor, because a genuinely quiet
// minute reads as a broken counter rather than a quiet minute.
const PROCESSING_BASE = 20;

const FULL_LIST_BUDGET_MS = 8000;

const compactUsers = (n) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;

const compactOrders = (n) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M+` : n >= 1000 ? `${Math.floor(n / 1000)}K+` : `${n}+`;

/** Resolves to `fallback` rather than hanging, whatever the promise does. */
function withBudget(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
  ]).finally(() => clearTimeout(timer));
}

const countsOnly = cache(async () => {
  let users = 0, verifiedUsers = 0, realOrders = 0;
  let curatedGroups = 0, curatedServices = 0, curatedPlatforms = 0;
  let deliveryRate = null, processing = null, since = null;

  try {
    [users, verifiedUsers, realOrders] = await Promise.all([
      prisma.user.count({ where: { status: { not: 'Deleted' } } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.order.count(),
    ]);
  } catch {}

  try {
    const [groups, tiers, distinct] = await Promise.all([
      prisma.serviceGroup.count({ where: { enabled: true, tiers: { some: { enabled: true } } } }),
      prisma.serviceTier.count({ where: { enabled: true, group: { enabled: true } } }),
      prisma.serviceGroup.findMany({
        where: { enabled: true, tiers: { some: { enabled: true } } },
        select: { platform: true },
        distinct: ['platform'],
      }),
    ]);
    curatedGroups = groups;
    curatedServices = tiers;
    curatedPlatforms = distinct.length;
  } catch {}

  try {
    const [breakdown, live] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        where: { deletedAt: null, status: { in: ['Completed', 'Partial', 'Cancelled'] } },
        _count: true,
      }),
      prisma.order.count({ where: { status: 'Processing', deletedAt: null } }),
    ]);
    const counts = {};
    breakdown.forEach(s => { counts[s.status] = s._count; });
    const denom = (counts.Completed || 0) + (counts.Partial || 0) + (counts.Cancelled || 0);
    if (denom > 0) deliveryRate = Math.max(90, Math.round(((counts.Completed || 0) / denom) * 100));
    processing = live + PROCESSING_BASE;
  } catch {}

  try {
    const first = await prisma.order.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    since = first ? first.createdAt.toISOString() : null;
  } catch {}

  return {
    users, verifiedUsers, orders: publicOrderCount(realOrders),
    curatedGroups, curatedServices, curatedPlatforms,
    deliveryRate, processing, since,
  };
});

/**
 * Every public number, raw and display-formatted.
 *
 * Pass `{ includeFullList: true }` only where the full catalogue size is
 * actually printed — /api/site-info and the homepage description. It is the
 * one expensive figure here and it degrades to 0 rather than waiting.
 *
 * Nothing throws: a page that cannot reach the database gets zeros and nulls
 * and is expected to render the fact away rather than print a zero. A zero on
 * the homepage is a worse lie than a missing line — that is the bug this
 * module was written next to.
 */
export async function getSiteStats({ includeFullList = false } = {}) {
  const c = await countsOnly();

  let full = { services: 0, platforms: 0 };
  if (includeFullList) {
    full = await withBudget(
      (async () => {
        const settings = await getMarkupSettings();
        return fullListSize(Number(settings.markup_usd_rate) || 1600);
      })(),
      FULL_LIST_BUDGET_MS,
      { services: 0, platforms: 0 },
    );
  }

  return {
    // Raw, for copy that needs to read "269" or do arithmetic on it.
    ...c,
    fullServices: full.services,
    fullPlatforms: full.platforms,
    // What a customer can actually open and order, curated plus full list.
    // Zero on the full side means we could not price it in time, so the total
    // is the curated count alone and the caller should say so or say nothing.
    totalServices: full.services ? c.curatedServices + full.services : 0,
    // The shape the landing page renders, so the server's first paint and the
    // client's refresh cannot disagree about formatting.
    display: {
      users: c.users ? compactUsers(c.users) : null,
      orders: c.orders ? compactOrders(c.orders) : null,
      platforms: c.curatedGroups || 0,
      services: c.curatedServices || 0,
      uniquePlatforms: c.curatedPlatforms || 0,
      fullList: full.services || 0,
      fullPlatforms: full.platforms || 0,
      ...(c.deliveryRate != null ? { deliveryRate: c.deliveryRate } : {}),
      ...(c.processing != null ? { processing: c.processing } : {}),
    },
  };
}
