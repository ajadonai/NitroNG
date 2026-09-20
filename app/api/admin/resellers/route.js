import prisma from '@/lib/prisma';
import { getMarkupSettings } from '@/lib/reseller';
import { tiersFrom, resolveRate, ladderLive, bandCapsFrom, seatLifetimeFrom } from '@/lib/reseller-tiers';
import { spendFor } from '@/lib/reseller-spend';
import { log } from '@/lib/logger';
import { requireAdmin, canPerformAction, logActivity } from '@/lib/admin';
import { randomBytes } from 'crypto';
import { DEAD_ORDER_STATES } from '@/lib/ledger';
import { koboToNaira as naira } from '@/lib/money';

// How far back the activity figures on each reseller look. Only ever computed
// for people who already have a profile, so it stays a handful of rows.
const WINDOW_DAYS = 90;
const SEARCH_LIMIT = 15;

// Recent behaviour per reseller. A collapsed order count is how you notice
// someone who stopped reselling and is still taking the discount.
async function activityFor(userIds) {
  if (!userIds.length) return {};
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
  const rows = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, createdAt: { gte: since }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } },
    _count: true,
    _sum: { charge: true },
  });
  const api = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds }, createdAt: { gte: since }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES }, source: 'api' },
    _count: true,
  }).catch(() => []);
  const apiBy = Object.fromEntries(api.map(r => [r.userId, r._count]));
  return Object.fromEntries(rows.map(r => [r.userId, { orders: r._count, spend: naira(r._sum.charge), apiOrders: apiBy[r.userId] || 0 }]));
}

export async function GET(req) {
  const { error } = await requireAdmin('resellers');
  if (error) return error;

  try {
    const q = req.nextUrl.searchParams.get('q')?.trim() || '';

    const profiles = await prisma.resellerProfile.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
        // Only so Remove can say how much history it is about to delete. A
        // dialog that says "this cannot be undone" and leaves you to guess
        // what goes with it is not a warning, it is a shrug.
        _count: { select: { tierEvents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const activity = await activityFor(profiles.map(p => p.userId));

    // Retail-equivalent spend, which is the money the ladder is measured in and
    // is not the same as `recentSpend` above — that one is what they actually
    // paid, over a 90-day window, and is what the page has always shown.
    const settings = await getMarkupSettings();
    const tiers = tiersFrom(settings);
    const spend = await spendFor(profiles.map(p => p.userId));
    const seatAt = seatLifetimeFrom(settings);

    // Search is only offered when asked for, so opening the tab costs one query.
    let results = [];
    if (q) {
      const existing = new Set(profiles.map(p => p.userId));
      const found = await prisma.user.findMany({
        where: {
          status: 'Active',
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: SEARCH_LIMIT,
      });
      const act = await activityFor(found.map(u => u.id));
      results = found.map(u => ({
        userId: u.id,
        name: u.name || '',
        email: u.email || '',
        joined: u.createdAt,
        alreadyReseller: existing.has(u.id),
        orders: act[u.id]?.orders || 0,
        spend: act[u.id]?.spend || 0,
      }));
    }

    // What the programme adds up to. Only measurable against the same window the
    // per-reseller figures use, so the totals and the rows always agree.
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000);
    const activeIds = profiles.filter(p => p.enabled).map(p => p.userId);
    const [everyone, resellerSide] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: since }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } },
        _count: true, _sum: { charge: true },
      }),
      activeIds.length
        ? prisma.order.aggregate({
          where: { userId: { in: activeIds }, createdAt: { gte: since }, deletedAt: null, status: { notIn: DEAD_ORDER_STATES } },
          _count: true, _sum: { charge: true },
        })
        : { _count: 0, _sum: { charge: 0 } },
    ]);
    const allRevenue = naira(everyone._sum.charge);
    const resellerRevenue = naira(resellerSide._sum.charge);

    const rateSetting = await prisma.setting.findUnique({ where: { key: 'markup_reseller_discount' } });

    return Response.json({
      windowDays: WINDOW_DAYS,
      query: q,
      globalDiscount: Number(rateSetting?.value) || 20,
      summary: {
        active: activeIds.length,
        revoked: profiles.length - activeIds.length,
        orders: resellerSide._count,
        revenue: resellerRevenue,
        // Their share of the business, which is the number that says whether the
        // programme is worth the margin it gives up.
        revenueShare: allRevenue ? Math.round((resellerRevenue / allRevenue) * 100) : 0,
        avgOrder: resellerSide._count ? Math.round(resellerRevenue / resellerSide._count) : 0,
        avgOrderEveryone: everyone._count ? Math.round(allRevenue / everyone._count) : 0,
      },
      results,
      resellers: profiles.map(p => ({
        id: p.id,
        userId: p.userId,
        name: p.user?.name || '',
        email: p.user?.email || '',
        userStatus: p.user?.status || '',
        enabled: p.enabled,
        discountPct: p.discountPct,
        approvedBy: p.approvedBy,
        approvedAt: p.approvedAt,
        notes: p.notes,
        createdAt: p.createdAt,
        recentOrders: activity[p.userId]?.orders || 0,
        recentSpend: activity[p.userId]?.spend || 0,
        apiOrders: activity[p.userId]?.apiOrders || 0,

        // ── the ladder ──
        tierMode: p.tierMode,
        tier: p.tier,
        pinnedTier: p.pinnedTier,
        tierSince: p.tierSince,
        firstMonthEndsAt: p.firstMonthEndsAt,
        seatForLife: p.seatForLife,
        seatEarnedAt: p.seatEarnedAt,
        // What they pay today, resolved the same way the price path resolves it,
        // so the drawer can never print a rate the checkout disagrees with.
        rate: resolveRate(p, settings),
        rollingSpend: Math.round(spend.get(p.userId)?.rolling || 0),
        lifetimeSpend: Math.round(spend.get(p.userId)?.lifetime || 0),
        tierEvents: p._count.tierEvents,
      })),
      ladder: { live: ladderLive(settings), tiers, bandCaps: bandCapsFrom(settings), seatLifetime: seatAt },
    });
  } catch (err) {
    log.error('AdminResellers', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// The `catalog` column is still on ResellerProfile and is deliberately no
// longer read or written. There is one catalogue now — the API serves the full
// list to every key — so a per-account setting could only ever disagree with
// what the API actually does. Dropping the column is a migration and a separate
// decision; leaving it unread costs nothing and keeps the history.

export async function POST(req) {
  const { admin, error } = await requireAdmin('resellers', true);
  if (error) return error;
  if (!canPerformAction(admin, 'reseller.approve')) {
    return Response.json({ error: 'Not allowed' }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { action, userId, notes, discountPct } = body || {};
  if (!userId || typeof userId !== 'string') {
    return Response.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, status: true } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
    if (action === 'approve' && user.status !== 'Active') {
      return Response.json({ error: `Account is ${user.status} — reactivate it first` }, { status: 400 });
    }
    const who = user.name || user.email || userId;

    if (action === 'approve') {
      // Where they start. Granting used to always land on `auto` with no rung,
      // which reads as "Normal pricing" the moment you approve somebody — right
      // by the ladder's rules and surprising if you meant to hand them a rate.
      //
      //   auto  the ladder decides from their spend, as before
      //   seed  begin on a rung and let the ladder take over from there
      //   pin   hold that rung whatever they spend, until it is unpinned
      //
      // `seed` is not `pin`: it sets the starting position and steps back. It
      // survives a while on its own because demotion only fires at a month end
      // and never inside the first full calendar month, so a seeded rung is
      // theirs for at least that long.
      const start = ['auto', 'seed', 'pin'].includes(body.start) ? body.start : 'auto';
      const ladderData = {};
      let startedOn = '';
      if (start !== 'auto') {
        const settings = await getMarkupSettings();
        const t = tiersFrom(settings).find(x => x.id === String(body.startTier || ''));
        if (!t) return Response.json({ error: 'Unknown tier' }, { status: 400 });
        if (start === 'pin') {
          ladderData.tierMode = 'pinned';
          ladderData.pinnedTier = t.id;
        } else {
          ladderData.tierMode = 'auto';
        }
        ladderData.tier = t.id;
        ladderData.tierSince = new Date();
        startedOn = `${start === 'pin' ? 'pinned to' : 'starting on'} ${t.name} (${t.pct}%)`;
      }

      const profile = await prisma.resellerProfile.upsert({
        where: { userId },
        create: {
          userId,
          apiKey: randomBytes(24).toString('hex'),
          enabled: true,
          approvedBy: admin.name,
          approvedAt: new Date(),
          notes: notes || null,
          ...ladderData,
        },
        // Re-approving someone previously revoked keeps their key, so an
        // integration that was already built does not have to be rewired.
        update: {
          enabled: true,
          approvedBy: admin.name,
          approvedAt: new Date(),
          ...(notes !== undefined ? { notes: notes || null } : {}),
          ...ladderData,
        },
      });
      // A rung an admin chose needs the same trail as one the cron awarded —
      // "why did this account open on Trade" is the question this table exists
      // to answer, and nobody is going to remember the grant modal in March.
      if (start !== 'auto') {
        await prisma.resellerTierEvent.create({
          data: {
            userId,
            fromTier: null,
            toTier: ladderData.tier,
            reason: start === 'pin' ? 'pinned' : 'granted',
            actor: admin.name,
          },
        });
      }
      await logActivity(admin.name, `Approved reseller ${who}${startedOn ? `, ${startedOn}` : ''}`);
      return Response.json({ success: true, profile: { enabled: profile.enabled } });
    }

    if (action === 'revoke') {
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      // Disabled, never deleted: the audit trail and their key both survive, and
      // pricing reverts to retail on their next order.
      await prisma.resellerProfile.update({ where: { userId }, data: { enabled: false } });
      await logActivity(admin.name, `Revoked reseller ${who}`);
      return Response.json({ success: true });
    }

    if (action === 'remove') {
      // The other half of revoke, and the reason both exist.
      //
      // Revoking keeps the row, so the key still works the day they come back
      // and the ladder history is still there to explain a rate. Removing
      // deletes the profile: the key is gone for good — a rebuild, not the
      // rewire a restore gives them — and `ResellerTierEvent` cascades on the
      // profile, so every promotion, demotion and pin goes with it. That is
      // the record the schema keeps so "why was this account on 30%" has an
      // answer in three months, which is why this is a separate, louder verb
      // rather than a tidier revoke.
      //
      // Orders are untouched. They carry their own charge and retailCharge and
      // do not reference the profile, so what anybody actually paid survives.
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      const events = await prisma.resellerTierEvent.count({ where: { userId } });
      await prisma.resellerProfile.delete({ where: { userId } });
      await logActivity(admin.name, `Removed reseller ${who} — profile, API key and ${events} ladder event(s) deleted`);
      return Response.json({ success: true, removed: true });
    }

    if (action === 'rate') {
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      // Blank clears the override and returns them to the global rate. A rate can
      // legitimately be worse than global — a probationary reseller on 10% is as
      // useful as a high performer on 35%.
      const blank = discountPct === null || discountPct === undefined || String(discountPct).trim() === '';
      const n = blank ? null : Number(discountPct);
      if (!blank && (!Number.isFinite(n) || n < 0 || n >= 100)) {
        return Response.json({ error: 'Rate must be between 0 and 99' }, { status: 400 });
      }
      await prisma.resellerProfile.update({ where: { userId }, data: { discountPct: blank ? null : Math.round(n) } });
      await logActivity(admin.name, blank
        ? `Reset reseller ${who} to the global wholesale rate`
        : `Set reseller ${who} wholesale rate to ${Math.round(n)}%`);
      return Response.json({ success: true });
    }

    /**
     * Auto, pinned or custom — the control that replaced the free-text rate box.
     *
     * The old box took any number under 100 and had no idea what a tier was, so
     * "why is this account on 35%" had no answer beyond somebody's memory. Every
     * change here writes a tier event with the admin's name on it.
     */
    if (action === 'mode') {
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });

      const settings = await getMarkupSettings();
      const tiers = tiersFrom(settings);
      const mode = String(body.mode || '').trim();
      if (!['auto', 'pinned', 'custom'].includes(mode)) {
        return Response.json({ error: 'Mode must be auto, pinned or custom' }, { status: 400 });
      }

      const data = { tierMode: mode };
      let what = '';

      if (mode === 'pinned') {
        const t = tiers.find(x => x.id === String(body.pinnedTier || ''));
        if (!t) return Response.json({ error: 'Unknown tier' }, { status: 400 });
        data.pinnedTier = t.id;
        // The pinned rung is also where the ladder resumes from when unpinned,
        // so a reseller does not fall off the moment the pin comes off.
        data.tier = t.id;
        data.tierSince = new Date();
        what = `pinned to ${t.name} (${t.pct}%)`;
      } else if (mode === 'custom') {
        const n = Number(body.discountPct);
        if (!Number.isFinite(n) || n < 0 || n >= 100) {
          return Response.json({ error: 'Rate must be between 0 and 99' }, { status: 400 });
        }
        data.discountPct = Math.round(n);
        data.pinnedTier = null;
        what = `on a custom ${Math.round(n)}%`;
      } else {
        data.pinnedTier = null;
        what = 'back on the ladder';
      }

      await prisma.resellerProfile.update({ where: { userId }, data });
      await prisma.resellerTierEvent.create({
        data: {
          userId,
          fromTier: profile.tier,
          toTier: data.tier ?? profile.tier,
          reason: mode === 'pinned' ? 'pinned' : mode === 'custom' ? 'custom' : 'unpinned',
          actor: admin.name,
        },
      });
      await logActivity(admin.name, `Reseller ${who} ${what}`);
      return Response.json({ success: true });
    }

    if (action === 'notes') {
      const profile = await prisma.resellerProfile.findUnique({ where: { userId } });
      if (!profile) return Response.json({ error: 'Not a reseller' }, { status: 404 });
      await prisma.resellerProfile.update({ where: { userId }, data: { notes: notes || null } });
      await logActivity(admin.name, `Updated note on reseller ${who}`);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    log.error('AdminResellers', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
