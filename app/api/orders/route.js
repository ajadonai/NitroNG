import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { placeOrder, checkOrder } from '@/lib/smm';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { getActivePromotion, applyPromotionDiscount } from '@/lib/promotions';
import { cleanLink } from '@/lib/clean-link';
import { calculateIntradayDrip, calculateMultiDayDrip, getDripConfig } from '@/lib/drip-feed';
import { sendEvent, generateEventId, parseFbCookies } from '@/lib/meta-capi';
import { headers as getHeaders } from 'next/headers';

async function nextOrderId(tx) {
  const rows = await (tx || prisma).order.findMany({
    where: { OR: [{ orderId: { startsWith: 'NTR-' } }, { orderId: { startsWith: 'ORD-' } }] },
    select: { orderId: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.orderId.replace(/^(NTR|ORD)-/, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `NTR-${max + 1}`;
}

export async function GET(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const search = url.searchParams.get('search')?.trim();

    const where = { userId: session.id, deletedAt: null };
    if (search) {
      where.OR = [
        { orderId: { contains: search, mode: 'insensitive' } },
        { batchId: { contains: search, mode: 'insensitive' } },
        { link: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { service: { select: { name: true, category: true } }, tier: { select: { tier: true, speed: true, refill: true, refillDays: true, group: { select: { name: true, type: true } } } } },
    });

    return Response.json({
      orders: orders.map(o => ({
        id: o.orderId || o.id,
        internalId: o.id,
        service: o.tier?.group?.name || o.service?.name || o.serviceId,
        tier: o.tier?.group?.name && o.tier?.tier ? o.tier.tier : null,
        speed: o.tier?.speed || null,
        platform: o.service?.category || 'unknown',
        link: o.link,
        quantity: o.quantity,
        charge: o.charge / 100,
        remains: o.remains,
        startCount: o.startCount,
        status: o.status,
        apiOrderId: o.apiOrderId,
        batchId: o.batchId || null,
        lastError: o.lastError || null,
        retryCount: o.retryCount || 0,
        refill: o.tier?.refill || false,
        refillDays: o.tier?.refillDays || 0,
        completedAt: o.completedAt?.toISOString() || null,
        created: o.createdAt.toISOString(),
        serviceType: o.tier?.group?.type || null,
        dripDays: o.dripDays || null,
      })),
    });
  } catch (err) {
    log.error('Orders GET', err.message);
    return Response.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { action, orderId } = await req.json();
    if (!orderId) return Response.json({ error: 'Order ID required' }, { status: 400 });

    const order = await prisma.order.findFirst({
      where: { OR: [{ orderId }, { id: orderId }], userId: session.id, deletedAt: null },
      include: { service: true, tier: { select: { sellPer1k: true, tier: true, group: { select: { name: true, tags: true, type: true } } } } },
    });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    if (action === 'check') {
      if (order.apiOrderId) {
        try {
          const provider = order.service?.provider || 'mtp';
          const status = await checkOrder(provider, order.apiOrderId);
          const statusMap = { 'Completed': 'Completed', 'In progress': 'Processing', 'Processing': 'Processing', 'Pending': 'Pending', 'Partial': 'Partial', 'Canceled': 'Cancelled', 'Refunded': 'Cancelled' };
          const providerStatus = statusMap[status.status] || order.status;
          const terminal = ['Partial', 'Cancelled'].includes(order.status);
          const newStatus = terminal ? order.status : providerStatus;
          const liveStartCount = status.start_count != null ? Number(status.start_count) : null;
          const updateData = {
            ...(newStatus !== order.status && { status: newStatus }),
            ...(!terminal && status.remains != null && { remains: Number(status.remains) }),
            ...(liveStartCount != null && !order.startCount && { startCount: liveStartCount }),
          };
          if (Object.keys(updateData).length > 0) {
            await prisma.order.update({ where: { id: order.id }, data: updateData });
          }
          return Response.json({ success: true, status: newStatus, remains: status.remains, startCount: status.start_count });
        } catch (e) {
          return Response.json({ success: true, status: order.status, message: e.message });
        }
      }
      // Drip order — sync each dispatch with provider, then rollup parent
      const dispatches = await prisma.dripDispatch.findMany({
        where: { orderId: order.id, apiOrderId: { not: null }, status: { notIn: ['completed', 'partial', 'cancelled'] } },
        select: { id: true, apiOrderId: true, quantity: true, status: true, startCount: true },
      });
      const provider = order.service?.provider || 'mtp';
      for (const d of dispatches) {
        try {
          const s = await checkOrder(provider, d.apiOrderId);
          const sMap = { 'Completed': 'completed', 'In progress': 'processing', 'Processing': 'processing', 'Pending': 'pending', 'Partial': 'partial', 'Canceled': 'cancelled', 'Refunded': 'cancelled' };
          const newSt = sMap[s.status] || d.status;
          const upd = {};
          if (newSt !== d.status) upd.status = newSt;
          if (s.remains != null) upd.remains = Number(s.remains);
          if (s.start_count != null && !d.startCount) upd.startCount = Number(s.start_count);
          if (['completed', 'partial', 'cancelled'].includes(newSt) && !d.completedAt) upd.completedAt = new Date();
          if (Object.keys(upd).length > 0) await prisma.dripDispatch.update({ where: { id: d.id }, data: upd });
        } catch {}
      }
      // Rollup parent
      const allDispatches = await prisma.dripDispatch.findMany({ where: { orderId: order.id }, select: { status: true, remains: true, quantity: true, startCount: true, day: true, batch: true }, orderBy: [{ day: 'asc' }, { batch: 'asc' }] });
      const allDone = allDispatches.length > 0 && allDispatches.every(d => ['completed', 'partial', 'cancelled'].includes(d.status));
      const totalRemains = allDispatches.reduce((s, d) => s + (d.remains ?? d.quantity), 0);
      const parentUpd = { remains: totalRemains };
      if (allDone) {
        parentUpd.status = totalRemains > 0 ? 'Partial' : 'Completed';
        parentUpd.completedAt = new Date();
      }
      const first = allDispatches[0];
      if (first?.startCount != null && order.startCount == null) parentUpd.startCount = first.startCount;
      await prisma.order.update({ where: { id: order.id }, data: parentUpd });
      return Response.json({
        success: true,
        status: parentUpd.status || order.status,
        remains: totalRemains,
        startCount: first?.startCount ?? order.startCount,
      });
    }

    if (action === 'cancel') {
      if (order.apiOrderId) {
        return Response.json({ error: 'This order has already been sent to our providers and cannot be cancelled. Please contact support if you need help.' }, { status: 400 });
      }
      if (order.dripDays) {
        return Response.json({ error: 'This order uses drip delivery and cannot be cancelled. Contact support if you need help.' }, { status: 400 });
      }
      if (order.status === 'Completed' || order.status === 'Cancelled' || order.status === 'Partial') {
        return Response.json({ error: `Cannot cancel ${order.status.toLowerCase()} order` }, { status: 400 });
      }
      const refunded = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['Pending', 'Processing'] }, apiOrderId: null },
          data: { status: 'Cancelled', lastError: 'user_cancelled', refundedAt: new Date() },
        });
        if (claimed.count === 0) return false;
        await tx.user.update({ where: { id: session.id }, data: { balance: { increment: order.charge } } });
        await tx.transaction.create({
          data: {
            userId: session.id, type: 'refund', amount: order.charge,
            method: 'wallet', status: 'Completed',
            reference: `REF-${order.orderId || order.id}`,
            note: `Refund for cancelled order ${order.orderId || order.id}`,
          },
        });
        return true;
      });
      if (!refunded) return Response.json({ error: 'Order already sent to provider' }, { status: 409 });
      return Response.json({ success: true, status: 'Cancelled', refunded: order.charge / 100 });
    }

    if (action === 'reorder') {
      // Re-place the same order with same service, link, quantity — but at CURRENT price
      if (!order.service || !order.service.enabled) {
        return Response.json({ error: 'Service no longer available' }, { status: 400 });
      }

      const reorderActiveForLink = await prisma.order.findFirst({
        where: { serviceId: order.serviceId, link: order.link, status: { in: ['Pending', 'Processing', 'In progress'] }, apiOrderId: { not: null }, deletedAt: null },
        select: { orderId: true },
      });

      const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
      const usdRate = Number(usdRateSetting?.value || 1600);

      // Recalculate charge from current tier/service price (not the old order's charge)
      const currentSellPer1k = order.tier?.sellPer1k || order.service.sellPer1k;
      let charge = Math.round((currentSellPer1k / 1000) * order.quantity / 100) * 100;
      const cost = Math.round((order.service.costPer1k * usdRate / 1000) * order.quantity / 100) * 100;

      if (!charge || charge <= 0) {
        return Response.json({ error: 'Service pricing not configured' }, { status: 400 });
      }

      // Apply loyalty discount to reorder
      let reorderLoyaltyDiscount = 0;
      let reorderLoyaltyTierName = null;
      try {
        const loyaltyEnabledRow = await prisma.setting.findUnique({ where: { key: 'loyalty_enabled' } });
        if (loyaltyEnabledRow?.value !== 'false') {
          const ltRow = await prisma.setting.findUnique({ where: { key: 'loyalty_tiers' } });
          if (ltRow) {
            const tiers = JSON.parse(ltRow.value);
            const spendAgg = await prisma.order.aggregate({ where: { userId: session.id, deletedAt: null, status: { not: 'Cancelled' } }, _sum: { charge: true } });
            const totalSpend = spendAgg._sum.charge || 0;
            let userTier = tiers[0];
            for (const t2 of tiers) { if (totalSpend >= t2.threshold) userTier = t2; }
            if (userTier.discount > 0) {
              reorderLoyaltyDiscount = Math.round(charge * (userTier.discount / 100));
              reorderLoyaltyTierName = userTier.name;
              charge = Math.max(1, charge - reorderLoyaltyDiscount); // floor at 1 kobo
            }
          }
        }
      } catch (err) { log.warn('Reorder loyalty discount', err.message); }

      // Apply promotion discount to reorder
      let reorderPromoDiscount = 0;
      let reorderPromoPercent = null;
      let reorderPromoId = null;
      let reorderPromoType = null;
      let reorderPromoLabel = null;
      try {
        const activePromo = await getActivePromotion();
        if (activePromo) {
          const { type, promotion: promo } = activePromo;
          reorderPromoDiscount = applyPromotionDiscount(charge, promo, promo.maxDiscountPerOrder);
          if (reorderPromoDiscount > 0) {
            reorderPromoPercent = promo.discountPercent;
            reorderPromoId = promo.id;
            reorderPromoType = type;
            reorderPromoLabel = promo.lineItemLabel;
            charge = Math.max(1, charge - reorderPromoDiscount);
          }
        }
      } catch (err) { log.warn('Reorder promotion discount', err.message); }

      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (user.balance < charge) {
        return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      const newOrderId = await nextOrderId();

      // Calculate drip for reorder (Layer 1 only — no multi-day on reorders)
      const reorderProviderMin = order.service.min || 50;
      const reorderGroupType = order.tier?.group?.type || '';
      const reorderDripCfg = getDripConfig(reorderGroupType);
      let reorderDripSchedule = null;
      if (process.env.NODE_ENV !== 'development' && order.tier?.group?.tags?.includes('drip') && reorderDripCfg && order.quantity >= reorderDripCfg.threshold) {
        const intraday = calculateIntradayDrip(order.quantity, reorderProviderMin, new Date(), reorderGroupType);
        if (intraday) {
          reorderDripSchedule = { dispatches: intraday.dispatches.map(d => ({ ...d, day: 1 })) };
        }
      }

      // Step 1: Deduct balance FIRST
      const newOrder = await prisma.$transaction(async (tx) => {
        const updated = await tx.$executeRaw`UPDATE users SET balance = balance - ${charge} WHERE id = ${session.id} AND balance >= ${charge}`;
        if (updated === 0) throw new Error('INSUFFICIENT_BALANCE');
        const created = await tx.order.create({
          data: {
            orderId: newOrderId, userId: session.id, serviceId: order.serviceId,
            tierId: order.tierId, link: order.link, quantity: order.quantity,
            charge, cost,
            comments: order.comments,
            loyaltyDiscount: reorderLoyaltyDiscount,
            campaignDiscount: reorderPromoDiscount,
            campaignPercent: reorderPromoPercent,
            platformCampaignId: reorderPromoType === 'platform' ? reorderPromoId : null,
            recurringCampaignId: reorderPromoType === 'recurring' ? reorderPromoId : null,
            status: 'Pending', apiOrderId: null,
            ...(reorderDripSchedule ? { dripDays: 1 } : {}),
          },
        });
        if (reorderDripSchedule) {
          await tx.dripDispatch.createMany({
            data: reorderDripSchedule.dispatches.map(d => ({
              orderId: created.id,
              day: 1,
              batch: d.batch,
              quantity: d.quantity,
              scheduledAt: d.scheduledAt,
            })),
          });
        }
        const reorderDiscountParts = [
          reorderLoyaltyDiscount > 0 ? `${reorderLoyaltyTierName} -₦${(reorderLoyaltyDiscount/100).toLocaleString()}` : null,
          reorderPromoDiscount > 0 ? `${reorderPromoLabel} -₦${(reorderPromoDiscount/100).toLocaleString()}` : null,
        ].filter(Boolean);
        await tx.transaction.create({
          data: {
            userId: session.id, type: 'order', amount: -charge,
            method: 'wallet', status: 'Completed', reference: newOrderId,
            note: `Reorder ${newOrderId} — ${order.tier?.group?.name ? `${order.tier.group.name} (${order.tier.tier})` : order.service.name} x${order.quantity.toLocaleString()}${reorderDiscountParts.length > 0 ? ` (${reorderDiscountParts.join(', ')})` : ''}`,
          },
        });
        return created;
      });

      // Step 2: Place on provider AFTER balance secured (skip in dev / skip if queued)
      let apiOrderId = null;
      const reorderQueued = !!reorderActiveForLink;
      const isDevReorder = process.env.NODE_ENV === 'development';
      if (isDevReorder) {
        apiOrderId = `DEV-${Date.now()}`;
        await prisma.order.update({ where: { id: newOrder.id }, data: { apiOrderId, status: 'Processing' } });
      } else if (order.service.apiId && !reorderQueued) {
        await prisma.order.update({ where: { id: newOrder.id }, data: { dispatchedAt: new Date() } });
        const provider = order.service.provider || 'mtp';
        const extra = {};
        if (order.comments) {
          const at = (order.service.apiType || '').toLowerCase();
          if (at.includes('mention')) extra.usernames = order.comments;
          else if (at === 'poll') extra.answer_number = order.comments;
          else extra.comments = order.comments;
        }

        if (reorderDripSchedule) {
          await prisma.order.update({ where: { id: newOrder.id }, data: { status: 'Processing' } });
          const first = await prisma.dripDispatch.findFirst({ where: { orderId: newOrder.id, day: 1, batch: 1 } });
          if (first) {
            try {
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'dispatching', dispatchedAt: new Date() } });
              const provResult = await placeOrder(provider, order.service.apiId, order.link, first.quantity, extra);
              const batchApiId = provResult.order ? String(provResult.order) : null;
              if (batchApiId) {
                await prisma.dripDispatch.update({ where: { id: first.id }, data: { apiOrderId: batchApiId, status: 'processing' } });
                await prisma.order.update({ where: { id: newOrder.id }, data: { dripDelivered: 1 } });
                apiOrderId = batchApiId;
              } else {
                await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'pending', dispatchedAt: null } });
              }
            } catch (err) {
              log.error('Reorder drip batch 1', err.message);
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'pending', lastError: err.message.slice(0, 500), dispatchedAt: null } }).catch(() => {});
            }
          }
        } else {
          try {
            const result = await placeOrder(provider, order.service.apiId, order.link, order.quantity, extra);
            apiOrderId = result.order ? String(result.order) : null;
            if (apiOrderId) {
              await prisma.order.update({ where: { id: newOrder.id }, data: { apiOrderId, status: 'Processing' } });
            }
          } catch (err) {
            log.error('Reorder', err.message);
            try { await prisma.order.update({ where: { id: newOrder.id }, data: { lastError: err.message.slice(0, 500) } }); } catch {}
          }
        }
      }

      return Response.json({
        success: true,
        ...(reorderQueued ? { queued: true, message: 'Order queued — will start when your current order for this link completes.' } : {}),
        order: { id: newOrderId, service: order.service.name, quantity: order.quantity, charge: charge / 100, status: (apiOrderId || reorderDripSchedule) ? 'Processing' : 'Pending' },
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }
    log.error('Orders PATCH', err.message);
    return Response.json({ error: 'Action failed' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (limited) return tooManyRequests('Too many orders. Slow down.');

    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { tierId, serviceId, link, quantity, comments, serviceType, dripDays: rawDripDays } = await req.json();

    // Get USD→NGN rate for cost calculation
    const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    const usdRate = Number(usdRateSetting?.value || 1600);

    if (!link || !quantity) {
      return Response.json({ error: 'Link and quantity required' }, { status: 400 });
    }
    if (!tierId && !serviceId) {
      return Response.json({ error: 'Service or tier required' }, { status: 400 });
    }

    // Validate link — strip tracking params from social media URLs
    const trimmedLink = cleanLink(link);
    if (trimmedLink.length < 5 || trimmedLink.length > 500) {
      return Response.json({ error: 'Invalid link' }, { status: 400 });
    }

    // Must be a URL (http/https) or a username handle (@user)
    const isUrl = /^https?:\/\/.+\..+/.test(trimmedLink);
    const isUsername = /^@?[a-zA-Z0-9._]{1,100}$/.test(trimmedLink);
    if (!isUrl && !isUsername) {
      return Response.json({ error: 'Please enter a valid URL (https://...) or username' }, { status: 400 });
    }

    let service, tier, charge, cost, tierName, qty;

    if (tierId) {
      // New flow: resolve service from tier
      tier = await prisma.serviceTier.findUnique({
        where: { id: tierId },
        include: { service: true, group: true },
      });
      if (!tier || !tier.enabled) {
        return Response.json({ error: 'Service tier not available' }, { status: 400 });
      }
      service = tier.service;
      if (!service || !service.enabled) {
        return Response.json({ error: 'Backing service not available' }, { status: 400 });
      }
      tierName = `${tier.group.name} (${tier.tier})`;
      // Nitro minimum order floors
      const NITRO_MINS = { followers: 100, likes: 50, views: 500, comments: 10, engagement: 50, plays: 500, reviews: 10 };
      const nitroMin = NITRO_MINS[tier.group.type?.toLowerCase()] || 50;
      const effectiveMin = Math.max(service.min, nitroMin);
      qty = Math.floor(Number(quantity));
      if (!qty || isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
        return Response.json({ error: 'Invalid quantity' }, { status: 400 });
      }
      if (qty < effectiveMin || qty > service.max) {
        return Response.json({ error: `Quantity must be between ${effectiveMin.toLocaleString()} and ${service.max.toLocaleString()}` }, { status: 400 });
      }
      charge = Math.round((tier.sellPer1k / 1000) * qty / 100) * 100;
      cost = Math.round((service.costPer1k * usdRate / 1000) * qty / 100) * 100;
    } else {
      // Legacy flow: direct serviceId
      service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service || !service.enabled) {
        return Response.json({ error: 'Service not available' }, { status: 400 });
      }
      qty = Math.floor(Number(quantity));
      if (!qty || isNaN(qty) || qty <= 0 || !Number.isFinite(qty)) {
        return Response.json({ error: 'Invalid quantity' }, { status: 400 });
      }
      if (qty < service.min || qty > service.max) {
        return Response.json({ error: `Quantity must be between ${service.min.toLocaleString()} and ${service.max.toLocaleString()}` }, { status: 400 });
      }
      charge = Math.round((service.sellPer1k / 1000) * qty / 100) * 100;
      cost = Math.round((service.costPer1k * usdRate / 1000) * qty / 100) * 100;
      tierName = service.name;
    }

    // Reject zero/negative charges (misconfigured service)
    if (!charge || charge <= 0) {
      return Response.json({ error: 'Service pricing not configured' }, { status: 400 });
    }

    // Validate link type matches service type (profile vs post)
    if (tier?.group?.type) {
      const groupType = tier.group.type.toLowerCase();
      const groupName = (tier.group.name || '').toLowerCase();
      const isMultiPost = /last\s+\d+\s*(tweet|post|video|reel|photo)/i.test(groupName);
      const needsProfile = groupType === 'followers' || isMultiPost;
      const needsPost = ['likes', 'views', 'comments', 'engagement', 'plays'].includes(groupType) && !isMultiPost;
      const platform = (service.category || '').toLowerCase();
      const guide = ' Learn more: https://nitro.ng/blog/how-to-find-the-right-link';

      if (!isUrl && needsPost) {
        return Response.json({ error: `This service needs a link to your post or video, not a username.${guide}` }, { status: 400 });
      }

      if (isUrl) {
        const postPatterns = {
          instagram: /\/(p|reel|reels|tv|stories)\//i,
          tiktok: /\/(video|photo|v)\//i,
          'twitter/x': /\/status\//i,
          youtube: /\/(watch|shorts|live)\b|youtu\.be\//i,
          facebook: /\/(posts|videos|watch|reel|photo|story)\b/i,
          threads: /\/post\//i,
          telegram: /\/\d+\s*$/,
        };

        // Shortened/redirect URLs are always post/content links
        const shortPostDomains = {
          tiktok: /^(vt|vm)\.tiktok\.com$/i,
          'twitter/x': /^t\.co$/i,
          facebook: /^(fb\.watch|fb\.me)$/i,
          instagram: /^ig\.me$/i,
        };
        let linkHost;
        try { linkHost = new URL(trimmedLink).hostname; } catch { linkHost = ''; }
        const isShortPostLink = Object.entries(shortPostDomains).some(
          ([p, re]) => platform.includes(p) && re.test(linkHost)
        );

        const isPostLink = isShortPostLink || Object.entries(postPatterns).some(
          ([p, re]) => platform.includes(p) && re.test(trimmedLink)
        );
        const isProfileLink = !isPostLink;

        if (needsProfile && isPostLink) {
          const example = platform.includes('instagram') ? 'https://instagram.com/yourpage'
            : platform.includes('tiktok') ? 'https://tiktok.com/@yourpage'
            : platform.includes('twitter') ? 'https://x.com/yourhandle'
            : platform.includes('youtube') ? 'https://youtube.com/@yourchannel'
            : 'your profile link';
          return Response.json({ error: `This service needs a profile link, not a post link. Example: ${example}.${guide}` }, { status: 400 });
        }

        if (needsPost && isProfileLink && Object.keys(postPatterns).some(p => platform.includes(p))) {
          const example = platform.includes('instagram') ? 'https://instagram.com/p/ABC123'
            : platform.includes('tiktok') ? 'https://tiktok.com/@user/video/123456'
            : platform.includes('twitter') ? 'https://x.com/user/status/123456'
            : platform.includes('youtube') ? 'https://youtube.com/watch?v=ABC123'
            : 'a link to your post or video';
          return Response.json({ error: `This service needs a post/content link, not a profile link. Example: ${example}.${guide}` }, { status: 400 });
        }
      }
    }

    // Validate extra params based on provider service type
    const apiType = (service.apiType || '').toLowerCase();
    const needsCommentText = apiType.includes('custom comment') || apiType.includes('comment replies');
    const needsUsernames = apiType.includes('mention');
    const needsAnswer = apiType === 'poll';
    if ((needsCommentText || needsUsernames || needsAnswer) && !comments?.trim()) {
      const label = needsUsernames ? 'Usernames are' : needsAnswer ? 'An answer selection is' : 'Comments are';
      return Response.json({ error: `${label} required for this service` }, { status: 400 });
    }
    if (needsCommentText && comments) {
      const lineCount = comments.split('\n').filter(l => l.trim()).length;
      const minLines = Math.max(service.min, 10);
      if (lineCount < minLines) {
        return Response.json({ error: `Please provide at least ${minLines} unique comments (one per line). You entered ${lineCount}.` }, { status: 400 });
      }
    }

    // Apply loyalty discount based on total lifetime spend
    let loyaltyDiscount = 0;
    let loyaltyTierName = null;
    try {
      const loyaltyEnabledRow = await prisma.setting.findUnique({ where: { key: 'loyalty_enabled' } });
      if (loyaltyEnabledRow?.value !== 'false') {
        const ltRow = await prisma.setting.findUnique({ where: { key: 'loyalty_tiers' } });
        if (ltRow) {
          const tiers = JSON.parse(ltRow.value);
          const spendAgg = await prisma.order.aggregate({ where: { userId: session.id, deletedAt: null, status: { not: 'Cancelled' } }, _sum: { charge: true } });
          const totalSpend = spendAgg._sum.charge || 0;
          let userTier = tiers[0];
          for (const t2 of tiers) { if (totalSpend >= t2.threshold) userTier = t2; }
          if (userTier.discount > 0) {
            loyaltyDiscount = Math.round(charge * (userTier.discount / 100));
            loyaltyTierName = userTier.name;
            charge = Math.max(100, Math.round((charge - loyaltyDiscount) / 100) * 100);
          }
        }
      }
    } catch (err) { log.warn('Loyalty discount', err.message); }

    // Apply promotion discount (stacks with loyalty)
    let promoDiscount = 0;
    let promoPercent = null;
    let activePromoId = null;
    let activePromoType = null;
    let promoLabel = null;
    try {
      const activePromo = await getActivePromotion();
      if (activePromo) {
        const { type, promotion: promo } = activePromo;
        promoDiscount = applyPromotionDiscount(charge, promo, promo.maxDiscountPerOrder);
        if (promoDiscount > 0) {
          promoPercent = promo.discountPercent;
          activePromoId = promo.id;
          activePromoType = type;
          promoLabel = promo.lineItemLabel;
          charge = Math.max(100, Math.round((charge - promoDiscount) / 100) * 100);
        }
      }
    } catch (err) { log.warn('Promotion discount', err.message); }

    qty = Math.floor(Number(quantity));

    // Check for active order on same service + link (MTP rejects duplicates)
    const activeForLink = await prisma.order.findFirst({
      where: { serviceId: service.id, link: trimmedLink, status: { in: ['Pending', 'Processing', 'In progress'] }, apiOrderId: { not: null }, deletedAt: null },
      select: { orderId: true },
    });

    // Generate order ID
    const orderId = await nextOrderId();

    // Calculate drip schedule if needed
    const DAILY_CAP = { followers: 5000, likes: 10000, views: 75000, plays: 75000, comments: 1000, reviews: 100, engagement: 15000 };
    const MIN_DAYS_FLOOR = { followers: 3, views: 1, plays: 1, likes: 2, comments: 3, reviews: 3, engagement: 2 };
    const groupType = (tier?.group?.type || "").toLowerCase();
    const dailyCap = DAILY_CAP[groupType] || 15000;
    const daysFloor = MIN_DAYS_FLOOR[groupType] || 3;
    const maxDripDays = qty <= 5000 ? 5 : qty <= 10000 ? 7 : qty <= 25000 ? 12 : qty <= 50000 ? 18 : qty <= 100000 ? 25 : 30;
    const minDripDays = Math.min(Math.max(daysFloor, Math.ceil(qty / dailyCap)), maxDripDays);
    const skipDrip = rawDripDays === 0 || process.env.NODE_ENV === 'development';
    const validDripDays = rawDripDays && rawDripDays > 0 ? Math.min(maxDripDays, Math.max(minDripDays, Math.floor(Number(rawDripDays)))) : null;
    const providerMin = service.min || 50;
    let dripSchedule = null;
    const dripEligible = tier?.group?.tags?.includes('drip');
    const dripCfg = getDripConfig(groupType);
    if (dripEligible && validDripDays) {
      dripSchedule = calculateMultiDayDrip(qty, validDripDays, providerMin, new Date(), groupType);
    } else if (dripEligible && !skipDrip && dripCfg && qty >= dripCfg.threshold) {
      const intraday = calculateIntradayDrip(qty, providerMin, new Date(), groupType);
      if (intraday) {
        dripSchedule = { dispatches: intraday.dispatches.map(d => ({ ...d, day: 1 })) };
      }
    }

    // Step 1: Atomic balance deduct FIRST — before sending to provider
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`UPDATE users SET balance = balance - ${charge} WHERE id = ${session.id} AND balance >= ${charge}`;
      if (updated === 0) {
        throw new Error('INSUFFICIENT_BALANCE');
      }
      const order = await tx.order.create({
        data: {
          orderId,
          userId: session.id,
          serviceId: service.id,
          tierId: tier ? tier.id : null,
          link: trimmedLink,
          quantity: qty,
          charge,
          cost,
          comments: comments?.trim().slice(0, 5000) || null,
          loyaltyDiscount,
          campaignDiscount: promoDiscount,
          campaignPercent: promoPercent,
          platformCampaignId: activePromoType === 'platform' ? activePromoId : null,
          recurringCampaignId: activePromoType === 'recurring' ? activePromoId : null,
          status: 'Pending',
          apiOrderId: null,
          ...(dripSchedule ? { dripDays: validDripDays || 1 } : {}),
        },
      });
      if (dripSchedule) {
        await tx.dripDispatch.createMany({
          data: dripSchedule.dispatches.map(d => ({
            orderId: order.id,
            day: d.day || 1,
            batch: d.batch,
            quantity: d.quantity,
            scheduledAt: d.scheduledAt,
          })),
        });
      }
      const discountParts = [
        loyaltyDiscount > 0 ? `${loyaltyTierName} -₦${(loyaltyDiscount/100).toLocaleString()}` : null,
        promoDiscount > 0 ? `${promoLabel} -₦${(promoDiscount/100).toLocaleString()}` : null,
      ].filter(Boolean);
      await tx.transaction.create({
        data: {
          userId: session.id,
          type: 'order',
          amount: -charge,
          method: 'wallet',
          status: 'Completed',
          reference: orderId,
          note: `Order ${orderId} — ${tierName} x${qty.toLocaleString()}${discountParts.length > 0 ? ` (${discountParts.join(', ')})` : ''}`,
        },
      });
      return order;
    });

    // Step 2: Place on provider AFTER balance is secured (skip in dev / skip if queued)
    let apiOrderId = null;
    const queued = !!activeForLink;
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      apiOrderId = `DEV-${Date.now()}`;
      await prisma.order.update({ where: { id: result.id }, data: { apiOrderId, status: 'Processing' } });
    } else if (service.apiId && !queued) {
      const provider = service.provider || 'mtp';
      const extra = {};
      if (comments) {
        const safeComments = comments.trim().slice(0, 5000);
        if (needsUsernames) extra.usernames = safeComments;
        else if (needsAnswer) extra.answer_number = safeComments;
        else extra.comments = safeComments;
      }

      if (dripSchedule) {
        // Drip: dispatch batch 1 immediately, cron handles the rest
        await prisma.order.update({ where: { id: result.id }, data: { status: 'Processing', dispatchedAt: new Date() } });
        const first = await prisma.dripDispatch.findFirst({ where: { orderId: result.id, day: 1, batch: 1 } });
        if (first) {
          try {
            await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'dispatching', dispatchedAt: new Date() } });
            const provResult = await placeOrder(provider, service.apiId, trimmedLink, first.quantity, extra);
            const batchApiId = provResult.order ? String(provResult.order) : null;
            if (batchApiId) {
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { apiOrderId: batchApiId, status: 'processing' } });
              await prisma.order.update({ where: { id: result.id }, data: { dripDelivered: 1 } });
              apiOrderId = batchApiId;
            } else {
              await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'pending', dispatchedAt: null } });
            }
          } catch (err) {
            log.error('Drip batch 1', err.message);
            const msg = err.message || '';
            if (/incorrect service|invalid service/i.test(msg)) {
              try {
                await prisma.$transaction(async (tx) => {
                  await tx.$executeRaw`UPDATE users SET balance = balance + ${charge} WHERE id = ${session.id}`;
                  await tx.order.update({ where: { id: result.id }, data: { status: 'Cancelled', lastError: msg.slice(0, 500) } });
                  await tx.dripDispatch.updateMany({ where: { orderId: result.id }, data: { status: 'failed', lastError: msg.slice(0, 500) } });
                  await tx.transaction.create({ data: { userId: session.id, type: 'refund', amount: charge, method: 'wallet', status: 'Completed', reference: `REF-${orderId}`, note: `Auto-refund: ${msg.slice(0, 100)}` } });
                });
                return Response.json({ error: 'This service is temporarily unavailable. You have been refunded.' }, { status: 409 });
              } catch (refundErr) { log.error('Drip auto-refund', refundErr.message); }
            }
            try { await prisma.dripDispatch.update({ where: { id: first.id }, data: { status: 'pending', lastError: msg.slice(0, 500), dispatchedAt: null } }); } catch {}
          }
        }
      } else {
        // Direct dispatch (no drip)
        try {
          await prisma.order.update({ where: { id: result.id }, data: { dispatchedAt: new Date() } });
          const provResult = await placeOrder(provider, service.apiId, trimmedLink, qty, extra);
          apiOrderId = provResult.order ? String(provResult.order) : null;
          if (apiOrderId) {
            await prisma.order.update({ where: { id: result.id }, data: { apiOrderId, status: 'Processing' } });
          }
        } catch (err) {
        log.error('Order Place', err.message);
        const msg = err.message || '';
        const permanent = /incorrect service|invalid service/i.test(msg);
        if (permanent) {
          try {
            await prisma.$transaction(async (tx) => {
              await tx.$executeRaw`UPDATE users SET balance = balance + ${charge} WHERE id = ${session.id}`;
              await tx.order.update({ where: { id: result.id }, data: { status: 'Cancelled', lastError: msg.slice(0, 500) } });
              await tx.transaction.create({ data: { userId: session.id, type: 'refund', amount: charge, method: 'wallet', status: 'Completed', reference: `REF-${orderId}`, note: `Auto-refund: ${msg.slice(0, 100)}` } });
            });
            const provider = service.provider || 'mtp';
            prisma.adminIssue.findFirst({
              where: { type: 'order_failure', status: 'open' },
            }).then(existing => {
              const entry = { serviceId: service.id, name: tierName, apiId: service.apiId, provider, orderId };
              if (existing) {
                let prev = [];
                try { const m = JSON.parse(existing.metadata); prev = m.services || []; } catch {}
                if (!prev.some(s => s.serviceId === service.id)) prev.push(entry);
                return prisma.adminIssue.update({
                  where: { id: existing.id },
                  data: {
                    title: `${prev.length} service${prev.length > 1 ? 's' : ''} rejected by provider`,
                    message: prev.map(s => `${s.name} (${(s.provider || 'mtp').toUpperCase()} #${s.apiId})`).join('\n'),
                    metadata: JSON.stringify({ count: prev.length, services: prev }),
                    createdAt: new Date(),
                  },
                });
              }
              return prisma.adminIssue.create({
                data: {
                  type: 'order_failure',
                  title: `1 service rejected by provider`,
                  message: `${tierName} (${provider.toUpperCase()} #${service.apiId})`,
                  metadata: JSON.stringify({ count: 1, services: [entry] }),
                },
              });
            }).catch(() => {});
            return Response.json({ error: 'This service is temporarily unavailable. You have been refunded.' }, { status: 409 });
          } catch (refundErr) { log.error('Order auto-refund', refundErr.message); }
        }
          try { await prisma.order.update({ where: { id: result.id }, data: { lastError: msg.slice(0, 500) } }); } catch {}
        }
      }
    }

    const eventId = generateEventId();
    const hdrs2 = await getHeaders();
    const { fbp, fbc } = parseFbCookies(hdrs2.get('cookie'));
    sendEvent('Purchase', {
      eventId,
      email: session.email,
      externalId: session.id,
      clientIp: hdrs2.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs2.get('x-real-ip'),
      userAgent: hdrs2.get('user-agent'),
      fbp, fbc,
      sourceUrl: hdrs2.get('referer'),
      customData: { value: charge / 100, currency: 'NGN' },
    });

    return Response.json({
      success: true,
      eventId,
      ...(queued ? { queued: true, message: `Order queued — will start automatically when your current order for this link completes.` } : {}),
      order: {
        id: orderId,
        service: tierName,
        quantity: qty,
        charge: charge / 100,
        status: (apiOrderId || dripSchedule) ? 'Processing' : 'Pending',
        ...(loyaltyDiscount > 0 ? { loyaltyDiscount: loyaltyDiscount / 100, loyaltyTier: loyaltyTierName } : {}),
        ...(promoDiscount > 0 ? { promoDiscount: promoDiscount / 100, promoPercent, promoLabel } : {}),
      },
    });
  } catch (err) {
    if (err.message === 'INSUFFICIENT_BALANCE') {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }
    log.error('Orders POST', err.message);
    return Response.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
