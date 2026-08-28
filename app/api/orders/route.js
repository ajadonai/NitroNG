import prisma from '@/lib/prisma';
import { getResellerTerms, getMarkupSettings, wholesaleOf } from '@/lib/reseller';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { placeOrder, checkOrder } from '@/lib/smm';
import { rateLimit, rateLimitUnavailable, tooManyRequests } from '@/lib/rate-limit';
import { getActivePromotion, applyPromotionDiscount } from '@/lib/promotions';
import { calculateIntradayDrip, calculateMultiDayDrip, getDripConfig, checkDripFeasibility, validateIntradayDuration } from '@/lib/drip-feed';
import { cancelQueuedMetaEvent, enqueueMetaEvent, parseFbCookies, scheduleQueuedMetaEventDelivery } from '@/lib/meta-capi';
import { tgNewOrder, tgOutreachAlert, tgRefundAlert } from '@/lib/telegram';
import { sendOutreach as ifySendOutreach } from '@/lib/ify/outreach';
import { voidCommissions } from '@/lib/commissions';
import { deductBalance, trackBonusConsumption, restoreBonusForRefund } from '@/lib/bonus-credit';
import { buildOrderDisplayGroups } from '@/lib/order-history';
import { getNitroStatus, getEligibleSpendKoboTx, computeNitroDiscount, awardOrderPoints, reverseOrderPoints, getPointsBalanceKoboTx, computeRefundSplit, MIN_REDEEM_POINTS } from '@/lib/nitro-rewards';
import { buildOrderOfferSnapshot, getOrderOfferDisplay } from '@/lib/order-offer-display';
import { findOpenSameLinkOrder, findSameLinkDispatchBlocker, isActiveOrderConflict, PROVIDER_ACTIVE_WAIT } from '@/lib/order-queue';
import { calculateCreateOrderPricing, parseCreateOrderInput, validateCreateOrderOfferInput } from '@/lib/order-create-input.server';
import { lockOrderSettlementAccount } from '@/lib/account-deletion';

export const maxDuration = 60;

function buildPurchaseEvent(req, { eventId, eventTime, email, phone, externalId, valueKobo }) {
  const { fbp, fbc } = parseFbCookies(req.headers.get('cookie'));
  return {
    eventId,
    eventTime,
    email,
    phone,
    externalId,
    clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
    fbp,
    fbc,
    sourceUrl: req.headers.get('referer'),
    customData: { value: valueKobo / 100, currency: 'NGN' },
  };
}

function triggerPurchaseDelivery(eventId) {
  scheduleQueuedMetaEventDelivery(eventId);
}

async function refundRejectedCreatedOrder({
  userId,
  orderDbId,
  orderId,
  charge,
  pointsDiscountKobo,
  message,
  drip = false,
}) {
  return prisma.$transaction(async (tx) => {
    if (!await lockOrderSettlementAccount(tx, userId)) return false;

    const claimed = await tx.order.updateMany({
      where: {
        id: orderDbId,
        userId,
        status: drip ? 'Pending' : 'Dispatching',
        apiOrderId: null,
        deletedAt: null,
      },
      data: {
        status: 'Cancelled',
        lastError: message.slice(0, 500),
        refundedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return false;

    await cancelQueuedMetaEvent(tx, `purchase_${orderId}`, 'provider_rejected_and_fully_refunded');

    if (drip) {
      await tx.dripDispatch.updateMany({
        where: { orderId: orderDbId, status: { notIn: ['completed', 'superseded'] } },
        data: { status: 'failed', lastError: message.slice(0, 500) },
      });
    }

    const walletRefund = charge - pointsDiscountKobo;
    if (walletRefund > 0) {
      await tx.$executeRaw`UPDATE users SET balance = balance + ${walletRefund} WHERE id = ${userId}`;
      await tx.transaction.create({
        data: {
          userId,
          type: 'refund',
          amount: walletRefund,
          method: 'wallet',
          status: 'Completed',
          reference: `REF-${orderId}`,
          note: `Auto-refund: ${message.slice(0, 100)}`,
        },
      });
    }
    await reverseOrderPoints(tx, { orderDbId, refundAmountKobo: charge });
    return true;
  });
}

async function checkFirstOrder(userId, serviceName) {
  if (new Date() < new Date('2026-08-01T00:00:00Z')) return;
  try {
    const count = await prisma.order.count({ where: { userId, deletedAt: null } });
    if (count === 1) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true, createdAt: true } });
      if (user) {
        tgOutreachAlert(user, 'firstOrder', { serviceName }).catch(() => {});
        ifySendOutreach({ user: { id: userId, ...user }, trigger: 'firstOrder', extra: { serviceName } }).catch(() => {});
      }
    }
  } catch {}
}

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
    const rawSearch = url.searchParams.get('search')?.trim();
    const search = rawSearch && rawSearch.length >= 2 ? rawSearch : null;
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const perPage = Math.min(100, Math.max(10, Number(url.searchParams.get('perPage')) || 25));
    const filter = url.searchParams.get('filter') || 'all';
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    const where = { userId: session.id, deletedAt: null };
    const and = [];
    if (search) {
      and.push({ OR: [
        { orderId: { contains: search, mode: 'insensitive' } },
        { batchId: { contains: search, mode: 'insensitive' } },
        { link: { contains: search, mode: 'insensitive' } },
      ] });
    }
    if (filter === 'active') where.status = { in: ['Pending', 'Processing', 'Dispatching'] };
    else if (filter === 'attention') {
      where.queuedBehind = null;
      and.push({ OR: [
        { status: 'Partial' },
        { status: 'Pending', lastError: { not: null }, apiOrderId: null },
      ] });
    } else if (filter !== 'all') where.status = filter;
    if (and.length) where.AND = and;

    if (start || end) {
      where.createdAt = {};
      if (start) {
        const d = new Date(start);
        if (!Number.isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (end) {
        const d = new Date(end);
        if (!Number.isNaN(d.getTime())) where.createdAt.lte = d;
      }
      if (!Object.keys(where.createdAt).length) delete where.createdAt;
    }

    // Paginate logical display rows so every bulk batch stays intact on one page.
    // The first query is deliberately narrow; full relations are loaded only for
    // the selected singles/batches.
    const matchingRefs = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, batchId: true, createdAt: true },
    });
    const displayGroups = buildOrderDisplayGroups(matchingRefs);
    const total = displayGroups.length;
    const pageGroups = displayGroups.slice((page - 1) * perPage, page * perPage);
    const batchIds = pageGroups.map(group => group.batchId).filter(Boolean);
    const singleIds = pageGroups.map(group => group.singleId).filter(Boolean);

    const orders = pageGroups.length === 0 ? [] : await prisma.order.findMany({
      where: {
        userId: session.id,
        deletedAt: null,
        OR: [
          ...(batchIds.length ? [{ batchId: { in: batchIds } }] : []),
          ...(singleIds.length ? [{ id: { in: singleIds } }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { service: { select: { name: true, category: true, enabled: true } }, tier: { select: { tier: true, speed: true, refill: true, refillDays: true, enabled: true, serviceId: true, group: { select: { name: true, platform: true, type: true, enabled: true } } } }, dripDispatches: { where: { status: { in: ['pending', 'dispatching', 'processing'] } }, select: { scheduledAt: true }, orderBy: { scheduledAt: 'desc' }, take: 1 } },
    });

    return Response.json({
      total,
      matchingOrdersTotal: matchingRefs.length,
      page,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      orders: orders.map(o => {
        const offer = getOrderOfferDisplay(o);
        return {
        id: o.orderId || o.id,
        internalId: o.id,
        service: offer.serviceName,
        tier: offer.tierLabel,
        offerDisabled: offer.offerDisabled,
        speed: o.tier?.speed || null,
        platform: offer.platform,
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
        refillRequestedAt: o.refillRequestedAt?.toISOString() || null,
        created: o.createdAt.toISOString(),
        serviceType: offer.serviceType,
        dripDays: o.dripDays || null,
        dripEndAt: o.dripDispatches?.[0]?.scheduledAt?.toISOString() || null,
        queuedBehind: o.queuedBehind || null,
        comments: o.comments || null,
        };
      }),
    });
  } catch (err) {
    log.error('Orders GET', err.message);
    return Response.json({ error: 'Failed to load orders' }, { status: 500 });
  }
}

export async function PATCH(req) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }
  return patchOrderForSession(session, body, req);
}

/** check / cancel / reorder on one of the session's orders; shared with the reseller API. */
export async function patchOrderForSession(session, body, req) {
  try {
    const { action, orderId } = body || {};
    if (!orderId) return Response.json({ error: 'Order ID required' }, { status: 400 });

    const order = await prisma.order.findFirst({
      where: { OR: [{ orderId }, { id: orderId }], userId: session.id, deletedAt: null },
      include: { service: true, tier: { select: { sellPer1k: true, tier: true, enabled: true, serviceId: true, group: { select: { name: true, tags: true, type: true, platform: true, enabled: true } } } } },
    });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

    if (action === 'check') {
      if (order.status === 'Cancelling') {
        return Response.json({ success: true, status: 'Cancelling', message: 'Cancellation is being finalized' });
      }
      if (order.apiOrderId) {
        try {
          const provider = order.service?.provider || 'mtp';
          const status = await checkOrder(provider, order.apiOrderId);
          const statusMap = { 'Completed': 'Completed', 'In progress': 'Processing', 'Processing': 'Processing', 'Pending': 'Pending', 'Partial': 'Partial', 'Canceled': 'Cancelled', 'Refunded': 'Cancelled' };
          const providerStatus = statusMap[status.status] || order.status;
          const terminal = ['Completed', 'Partial', 'Cancelled', 'Cancelling'].includes(order.status);
          const newStatus = terminal ? order.status : providerStatus;
          let effectiveStatus = newStatus;
          const liveStartCount = status.start_count != null ? Number(status.start_count) : null;
          const updateData = {
            ...(newStatus !== order.status && { status: newStatus }),
            ...(!terminal && status.remains != null && { remains: Number(status.remains) }),
            ...(liveStartCount != null && !order.startCount && { startCount: liveStartCount }),
          };
          if (Object.keys(updateData).length > 0) {
            const transitioned = await prisma.$transaction(async (tx) => {
              if (!await lockOrderSettlementAccount(tx, session.id)) return false;
              const claimed = await tx.order.updateMany({
                where: {
                  id: order.id,
                  userId: session.id,
                  status: order.status,
                  apiOrderId: order.apiOrderId,
                  deletedAt: null,
                },
                data: updateData,
              });
              return claimed.count === 1;
            });
            if (!transitioned) {
              const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
              effectiveStatus = current?.status || order.status;
            }
          }
          return Response.json({ success: true, status: effectiveStatus, remains: status.remains, startCount: status.start_count });
        } catch (e) {
          return Response.json({ success: true, status: order.status, message: e.message });
        }
      }
      // Drip order — sync each dispatch with provider, then rollup parent
      const dispatches = await prisma.dripDispatch.findMany({
        where: { orderId: order.id, apiOrderId: { not: null }, status: { notIn: ['completed', 'partial', 'cancelled', 'superseded', 'verifying', 'cancelling'] } },
        select: { id: true, apiOrderId: true, quantity: true, status: true, startCount: true },
      });
      const provider = order.service?.provider || 'mtp';
      const { normalizeProviderStatus } = await import('@/lib/drip-completion');
      const { randomUUID } = await import('node:crypto');
      for (const d of dispatches) {
        let verifyToken = null;
        try {
          let casStatus = d.status;
          if (d.status === 'failed') {
            verifyToken = `[VERIFY] ${randomUUID()}`;
            const claimed = await prisma.$transaction(async (tx) => {
              const pRows = await tx.$queryRaw`SELECT "id", "status", "deletedAt" FROM "orders" WHERE "id" = ${order.id} FOR UPDATE`;
              const p = pRows[0];
              if (!p || !['Pending', 'Processing'].includes(p.status) || p.deletedAt) return false;
              const r = await tx.dripDispatch.updateMany({ where: { id: d.id, status: 'failed', apiOrderId: d.apiOrderId }, data: { status: 'verifying', lastError: verifyToken } });
              return r.count > 0;
            });
            if (!claimed) continue;
            casStatus = 'verifying';
          }

          const s = await checkOrder(provider, d.apiOrderId);
          const newSt = normalizeProviderStatus(s.status) || d.status;
          const upd = {};
          if (newSt !== casStatus) upd.status = newSt;
          if (s.remains != null) upd.remains = Number(s.remains);
          if (s.start_count != null && !d.startCount) upd.startCount = Number(s.start_count);
          if (['completed', 'partial', 'cancelled', 'failed'].includes(newSt) && newSt !== d.status) upd.completedAt = new Date();
          if (Object.keys(upd).length === 0) continue;
          if (upd.status === 'failed') upd.lastError = null;
          const qualifies = ['completed', 'partial'].includes(newSt) && !['completed', 'partial'].includes(d.status);
          const whereClause = verifyToken
            ? { id: d.id, status: 'verifying', lastError: verifyToken, apiOrderId: d.apiOrderId }
            : { id: d.id, status: casStatus, apiOrderId: d.apiOrderId };
          await prisma.$transaction(async (tx) => {
            const pRows = await tx.$queryRaw`SELECT "id", "status", "deletedAt" FROM "orders" WHERE "id" = ${order.id} FOR UPDATE`;
            const p = pRows[0];
            if (!p || !['Pending', 'Processing'].includes(p.status) || p.deletedAt) return;
            const r = await tx.dripDispatch.updateMany({ where: whereClause, data: upd });
            if (qualifies && r.count === 1) {
              const { rescheduleAfterDripCompletion } = await import('@/lib/drip-completion');
              await rescheduleAfterDripCompletion(tx, order.id, upd.completedAt);
            }
          });
        } catch {
          // Leave as verifying — cron stale handler will reconcile
        }
      }
      // Rollup parent — guard terminal states
      const { applyDripRollup } = await import('@/lib/drip-completion');
      const allDispatches = await prisma.dripDispatch.findMany({ where: { orderId: order.id }, select: { status: true, remains: true, quantity: true, startCount: true, day: true, batch: true, lastError: true }, orderBy: [{ day: 'asc' }, { batch: 'asc' }] });
      const rollupResult = await applyDripRollup(prisma, order.id, allDispatches, order.status);
      const effectiveStatus = rollupResult?.status || order.status;
      const first = allDispatches.find(d => d.day === 1 && d.batch === 1) || allDispatches[0];
      return Response.json({
        success: true,
        status: effectiveStatus,
        remains: rollupResult?.remains ?? order.remains,
        startCount: first?.startCount ?? order.startCount,
      });
    }

    if (action === 'cancel') {
      if (order.protected) {
        return Response.json({ error: 'This order is protected and can only be cancelled by an admin.' }, { status: 400 });
      }
      if (order.apiOrderId) {
        return Response.json({ error: 'This order is already processing and cannot be cancelled. Please contact support if you need help.' }, { status: 400 });
      }
      if (order.dripDays) {
        return Response.json({ error: 'This order uses drip delivery and cannot be cancelled. Contact support if you need help.' }, { status: 400 });
      }
      if (order.status === 'Completed' || order.status === 'Cancelled' || order.status === 'Partial') {
        return Response.json({ error: `Cannot cancel ${order.status.toLowerCase()} order` }, { status: 400 });
      }
      const { walletRefund: cancelWalletRefund, pointsRestore: cancelPointsRestore } = computeRefundSplit(order.charge, order.nitroPointsRedeemedKobo, order.charge);
      const refunded = await prisma.$transaction(async (tx) => {
        if (!await lockOrderSettlementAccount(tx, session.id)) return false;
        const claimed = await tx.order.updateMany({
          where: { id: order.id, userId: session.id, status: { in: ['Pending', 'Processing'] }, apiOrderId: null, deletedAt: null },
          data: { status: 'Cancelled', queuedBehind: null, lastError: 'user_cancelled', refundedAt: new Date() },
        });
        if (claimed.count === 0) return false;
        await restoreBonusForRefund(tx, order.id);
        if (cancelWalletRefund > 0) {
          await tx.user.update({ where: { id: session.id }, data: { balance: { increment: cancelWalletRefund } } });
          await tx.transaction.create({
            data: {
              userId: session.id, type: 'refund', amount: cancelWalletRefund,
              method: 'wallet', status: 'Completed',
              reference: `REF-${order.orderId || order.id}`,
              note: `Refund for cancelled order ${order.orderId || order.id}`,
            },
          });
        }
        await reverseOrderPoints(tx, { orderDbId: order.id, refundAmountKobo: order.charge });
        return true;
      });
      if (!refunded) return Response.json({ error: 'Order already sent to provider' }, { status: 409 });
      tgRefundAlert({ orderId: order.orderId, amount: order.charge, charge: order.charge, qty: order.quantity, status: 'Cancelled', reason: 'user_cancelled', service: getOrderOfferDisplay(order).serviceName, source: 'user' });
      voidCommissions(order.id, 'user_cancelled').catch(() => {});
      const cancelResponse = { success: true, status: 'Cancelled', refunded: cancelWalletRefund / 100 };
      if (cancelPointsRestore > 0) cancelResponse.pointsRestored = cancelPointsRestore / 100;
      return Response.json(cancelResponse);
    }

    if (action === 'reorder') {
      // Re-place the same order with same service, link, quantity — but at CURRENT price
      const reorderOffer = getOrderOfferDisplay(order);
      if (!order.service || !order.service.enabled || reorderOffer.offerDisabled) {
        return Response.json({ error: 'Service no longer available' }, { status: 400 });
      }
      const reorderSnapshot = buildOrderOfferSnapshot({ tier: order.tier, service: order.service });

      const reorderActiveForLink = await findOpenSameLinkOrder(prisma, {
        serviceId: order.serviceId,
        link: order.link,
        excludeOrderId: order.id,
      });

      const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
      const usdRate = Number(usdRateSetting?.value || 1600);

      // Recalculate charge from current tier/service price (not the old order's charge)
      const currentSellPer1k = Number(order.tier?.sellPer1k || order.service.sellPer1k);
      let charge = Math.ceil((currentSellPer1k / 1000) * order.quantity / 100) * 100;
      const cost = Math.ceil((Number(order.service.costPer1k) * usdRate / 1000) * order.quantity / 100) * 100;

      if (!charge || charge <= 0) {
        return Response.json({ error: 'Service pricing not configured' }, { status: 400 });
      }

      // Same rule as a fresh order: wholesale instead of the retail discounts,
      // never alongside them.
      const reorderTerms = await getResellerTerms(session.id);
      if (reorderTerms) {
        charge = wholesaleOf(charge, reorderTerms, await getMarkupSettings());
      }

      // Apply Nitro Status discount to reorder
      let reorderLoyaltyDiscount = 0;
      let reorderNitroTier = null;
      try {
        const spendKobo = await getEligibleSpendKoboTx(prisma, session.id);
        reorderNitroTier = getNitroStatus(Math.floor(spendKobo / 100));
        reorderLoyaltyDiscount = reorderTerms ? 0 : computeNitroDiscount(charge, reorderNitroTier);
        if (reorderLoyaltyDiscount > 0) {
          charge = Math.max(100, Math.ceil((charge - reorderLoyaltyDiscount) / 100) * 100);
        }
      } catch (err) { log.warn('Reorder Nitro Status discount', err.message); }

      // Apply promotion discount to reorder
      let reorderPromoDiscount = 0;
      let reorderPromoPercent = null;
      let reorderPromoId = null;
      let reorderPromoType = null;
      let reorderPromoLabel = null;
      try {
        const activePromo = reorderTerms ? null : await getActivePromotion();
        if (activePromo) {
          const { type, promotion: promo } = activePromo;
          reorderPromoDiscount = applyPromotionDiscount(charge, promo, promo.maxDiscountPerOrder);
          if (reorderPromoDiscount > 0) {
            reorderPromoPercent = promo.discountPercent;
            reorderPromoId = promo.id;
            reorderPromoType = type;
            reorderPromoLabel = promo.lineItemLabel;
            charge = Math.max(100, Math.ceil((charge - reorderPromoDiscount) / 100) * 100);
          }
        }
      } catch (err) { log.warn('Reorder promotion discount', err.message); }

      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (user.balance < charge) {
        return Response.json({ error: 'Insufficient balance' }, { status: 400 });
      }

      const newOrderId = await nextOrderId();
      const reorderEventId = `purchase_${newOrderId}`;

      // Calculate drip for reorder (Layer 1 only — no multi-day on reorders)
      const reorderProviderMin = order.service.min || 50;
      const reorderGroupType = order.tier?.group?.type || '';
      const reorderPlatform = (order.service?.category || '').toLowerCase();
      const reorderDripCfg = getDripConfig(reorderGroupType, reorderPlatform);
      let reorderDripSchedule = null;
      if (process.env.NODE_ENV !== 'development' && order.tier?.group?.tags?.includes('drip') && reorderDripCfg && order.quantity >= reorderDripCfg.threshold) {
        const intraday = calculateIntradayDrip(order.quantity, reorderProviderMin, new Date(), reorderGroupType, reorderPlatform);
        if (intraday) {
          const durationErr = validateIntradayDuration(intraday.dispatches);
          if (durationErr) return Response.json({ error: durationErr }, { status: 400 });
          reorderDripSchedule = { dispatches: intraday.dispatches.map(d => ({ ...d, day: 1 })) };
        }
      }

      // Step 1: Deduct balance FIRST
      const newOrder = await prisma.$transaction(async (tx) => {
        await deductBalance(tx, session.id, charge);
        const created = await tx.order.create({
          data: {
            orderId: newOrderId, userId: session.id, serviceId: order.serviceId,
            tierId: order.tierId, link: order.link, quantity: order.quantity,
            charge, cost,
            comments: order.comments,
            ...(order.trafficConfig ? { trafficConfig: order.trafficConfig } : {}),
            loyaltyDiscount: reorderLoyaltyDiscount,
            // Wholesale replaces retail incentives: a reseller order accrues no
            // loyalty points, which this null enforces at completion time.
            nitroStatusAtPurchase: reorderTerms ? null : (reorderNitroTier?.key || null),
            ...reorderSnapshot,
            campaignDiscount: reorderPromoDiscount,
            campaignPercent: reorderPromoPercent,
            platformCampaignId: reorderPromoType === 'platform' ? reorderPromoId : null,
            recurringCampaignId: reorderPromoType === 'recurring' ? reorderPromoId : null,
            status: 'Pending', apiOrderId: null,
            ...(reorderActiveForLink ? { queuedBehind: reorderActiveForLink.orderId } : {}),
            ...(reorderDripSchedule ? { dripDays: 1 } : {}),
          },
        });
        await trackBonusConsumption(tx, session.id, created.id, charge);
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
        const reorderNitroTierName = reorderNitroTier?.name || null;
        const reorderDiscountParts = [
          reorderLoyaltyDiscount > 0 ? `${reorderNitroTierName} -₦${(reorderLoyaltyDiscount/100).toLocaleString()}` : null,
          reorderPromoDiscount > 0 ? `${reorderPromoLabel} -₦${(reorderPromoDiscount/100).toLocaleString()}` : null,
        ].filter(Boolean);
        await tx.transaction.create({
          data: {
            userId: session.id, type: 'order', amount: -charge,
            method: 'wallet', status: 'Completed', reference: newOrderId,
            note: `Reorder ${newOrderId} — ${reorderOffer.serviceName}${reorderOffer.tierLabel ? ` (${reorderOffer.tierLabel})` : ''} x${order.quantity.toLocaleString()}${reorderDiscountParts.length > 0 ? ` (${reorderDiscountParts.join(', ')})` : ''}`,
          },
        });
        await enqueueMetaEvent(tx, 'Purchase', buildPurchaseEvent(req, {
          eventId: reorderEventId,
          eventTime: created.createdAt,
          email: user.email || session.email,
          phone: user.phone,
          externalId: session.id,
          valueKobo: charge,
        }));
        return created;
      });

      triggerPurchaseDelivery(reorderEventId);

      // Step 2: Place on provider AFTER balance secured (skip in dev / skip if queued)
      let apiOrderId = null;
      let reorderQueued = !!reorderActiveForLink;
      if (!reorderQueued) {
        // Re-check after creation. Two simultaneous requests can both observe no
        // blocker before either transaction inserts its order; FIFO chooses one
        // winner before any provider request is made.
        const blocker = await findSameLinkDispatchBlocker(prisma, newOrder);
        if (blocker) {
          const held = await prisma.order.updateMany({
            where: { id: newOrder.id, status: 'Pending', apiOrderId: null, deletedAt: null },
            data: { queuedBehind: blocker.orderId },
          });
          reorderQueued = held.count > 0;
        }
      }
      const isDevReorder = process.env.NODE_ENV === 'development';
      if (isDevReorder && !reorderQueued) {
        apiOrderId = `DEV-${Date.now()}`;
        const recorded = await prisma.order.updateMany({
          where: { id: newOrder.id, status: 'Pending', apiOrderId: null, queuedBehind: null, deletedAt: null },
          data: { apiOrderId, status: 'Processing' },
        });
        if (recorded.count === 0) {
          apiOrderId = null;
          reorderQueued = true;
        }
      } else if (order.service.apiId && !reorderQueued) {
        const provider = order.service.provider || 'mtp';
        const extra = {};
        if (order.comments) {
          const at = (order.service.apiType || '').toLowerCase();
          if (at === 'seo') extra.keywords = order.comments;
          else if (at.includes('mention')) extra.usernames = order.comments;
          else if (at === 'poll') extra.answer_number = order.comments;
          else extra.comments = order.comments;
        }

        if (order.trafficConfig) {
          const tc = order.trafficConfig;
          if (tc.country) extra.country = tc.country;
          if (tc.device) extra.device = tc.device;
          if (tc.trafficType === 'keyword' && tc.keyword) extra.keywords = tc.keyword;
          else if (tc.trafficType === 'referrer' && tc.referrer) extra.referrer = tc.referrer;
        }

        const reorderApiType = (order.service.apiType || '').toLowerCase();
        if (reorderApiType === 'subscriptions') {
          const match = order.link.match(/instagram\.com\/([^/?#]+)/);
          if (match) extra.username = match[1];
        }

        if (reorderDripSchedule) {
          const first = await prisma.dripDispatch.findFirst({ where: { orderId: newOrder.id, day: 1, batch: 1 } });
          if (first) {
            const batchClaim = await prisma.dripDispatch.updateMany({
              where: { id: first.id, status: 'pending', order: { status: 'Pending', queuedBehind: null, deletedAt: null } },
              data: { status: 'dispatching', dispatchedAt: new Date() },
            });
            if (batchClaim.count === 0) {
              reorderQueued = true;
            } else try {
              await prisma.order.updateMany({
                where: { id: newOrder.id, status: 'Pending', deletedAt: null },
                data: { dispatchedAt: new Date() },
              });
              const batchExtra = { ...extra };
              if (reorderApiType === 'subscriptions') { batchExtra.min = first.quantity; batchExtra.max = first.quantity; }
              if (batchExtra.comments && reorderDripSchedule?.dispatches?.length > 1) {
                const { sliceCommentsForBatch } = await import('@/lib/drip-feed');
                batchExtra.comments = sliceCommentsForBatch(batchExtra.comments, first.quantity, reorderDripSchedule.dispatches, { day: 1, batch: 1 });
              }
              const provResult = await placeOrder(provider, order.service.apiId, order.link, first.quantity, batchExtra);
              const batchApiId = provResult.order ? String(provResult.order) : null;
              if (batchApiId) {
                const recorded = await prisma.dripDispatch.updateMany({
                  where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } },
                  data: { apiOrderId: batchApiId, status: 'processing' },
                });
                if (recorded.count > 0) {
                  await prisma.order.updateMany({ where: { id: newOrder.id, status: 'Pending', deletedAt: null }, data: { status: 'Processing', dripDelivered: 1, queuedBehind: null } });
                  apiOrderId = batchApiId;
                } else {
                  prisma.adminIssue.create({
                    data: { type: 'ghost_dispatch', title: `${newOrderId} batch 1: provider accepted after local cancellation`, message: `Provider order ${batchApiId} was created after the local order became terminal. Verify provider state before taking action.`, metadata: JSON.stringify({ orderId: newOrderId, batch: 1, providerOrderId: batchApiId, link: order.link }) },
                  }).catch(() => {});
                }
              } else {
                await prisma.dripDispatch.updateMany({
                  where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } },
                  data: { status: 'pending', dispatchedAt: null, lastError: 'no_order_id' },
                });
              }
            } catch (err) {
              log.error('Reorder drip batch 1', err.message);
              const rmsg = err.message || '';
              if (isActiveOrderConflict(err)) {
                reorderQueued = true;
                const blocker = await findSameLinkDispatchBlocker(prisma, newOrder);
                await prisma.dripDispatch.updateMany({
                  where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } },
                  data: { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: new Date(Date.now() + 30 * 60 * 1000) },
                }).catch(() => {});
                await prisma.order.updateMany({
                  where: { id: newOrder.id, status: 'Pending', deletedAt: null },
                  data: { status: 'Pending', queuedBehind: blocker?.orderId || null },
                }).catch(() => {});
              } else {
                const rIsTimeout = /timed?\s?out|ETIMEDOUT|ECONNABORTED|ECONNRESET|socket hang up|retries failed/i.test(rmsg);
                await prisma.dripDispatch.updateMany({
                  where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } },
                  data: { status: rIsTimeout ? 'failed' : 'pending', lastError: (rIsTimeout ? '[TIMEOUT] ' : '') + rmsg.slice(0, 450), dispatchedAt: rIsTimeout ? undefined : null },
                }).catch(() => {});
              }
            }
          }
        } else {
          const directClaim = await prisma.order.updateMany({
            where: { id: newOrder.id, status: 'Pending', apiOrderId: null, queuedBehind: null, deletedAt: null },
            data: { status: 'Dispatching', dispatchedAt: new Date(), queuedBehind: null },
          });
          if (directClaim.count === 0) {
            reorderQueued = true;
          } else try {
            if (reorderApiType === 'subscriptions') { extra.min = order.quantity; extra.max = order.quantity; }
            const result = await placeOrder(provider, order.service.apiId, order.link, order.quantity, extra);
            apiOrderId = result.order ? String(result.order) : null;
            if (apiOrderId) {
              const recorded = await prisma.order.updateMany({ where: { id: newOrder.id, status: 'Dispatching', apiOrderId: null, deletedAt: null }, data: { apiOrderId, status: 'Processing', lastError: null } });
              if (recorded.count === 0) {
                apiOrderId = null;
                prisma.adminIssue.create({
                  data: { type: 'ghost_dispatch', title: `${newOrderId}: provider accepted after local cancellation`, message: `Provider order ${String(result.order)} was created after the local order became terminal. Verify provider state before taking action.`, metadata: JSON.stringify({ orderId: newOrderId, providerOrderId: String(result.order), link: order.link }) },
                }).catch(() => {});
              }
            } else {
              await prisma.order.updateMany({
                where: { id: newOrder.id, status: 'Dispatching', apiOrderId: null, deletedAt: null },
                data: { status: 'Pending', dispatchedAt: null, retryCount: { increment: 1 } },
              });
            }
          } catch (err) {
            log.error('Reorder', err.message);
            const rmsg2 = err.message || '';
            if (isActiveOrderConflict(err)) {
              reorderQueued = true;
              const blocker = await findSameLinkDispatchBlocker(prisma, newOrder);
              try { await prisma.order.updateMany({ where: { id: newOrder.id, status: 'Dispatching', apiOrderId: null }, data: { status: 'Pending', dispatchedAt: null, queuedBehind: blocker?.orderId || null, lastError: PROVIDER_ACTIVE_WAIT, retryCount: 0 } }); } catch {}
            } else {
              const rIsTimeout2 = /timed?\s?out|ETIMEDOUT|ECONNABORTED|ECONNRESET|socket hang up|retries failed/i.test(rmsg2);
              try {
                await prisma.order.updateMany({
                  where: { id: newOrder.id, status: 'Dispatching', apiOrderId: null },
                  data: {
                    status: rIsTimeout2 ? 'Dispatching' : 'Pending',
                    dispatchedAt: rIsTimeout2 ? undefined : null,
                    lastError: (rIsTimeout2 ? '[TIMEOUT] ' : '') + rmsg2.slice(0, 450),
                  },
                });
              } catch {}
            }
          }
        }
      }

      tgNewOrder(newOrderId, reorderOffer.serviceName, order.quantity, charge, session.email, order.link, reorderSnapshot.platformAtPurchase || reorderOffer.platform);
      checkFirstOrder(session.id, reorderOffer.serviceName);

      return Response.json({
        success: true,
        ...(reorderQueued ? { queued: true, message: 'Order queued — will start when your current order for this link completes.' } : {}),
        order: {
          id: newOrderId, service: reorderOffer.serviceName, tier: reorderOffer.tierLabel, quantity: order.quantity,
          charge: charge / 100, status: apiOrderId ? 'Processing' : 'Pending',
          ...(reorderLoyaltyDiscount > 0 ? { loyaltyDiscount: reorderLoyaltyDiscount / 100, loyaltyTier: reorderNitroTier?.name } : {}),
          ...(reorderPromoDiscount > 0 ? { promoDiscount: reorderPromoDiscount / 100, promoPercent: reorderPromoPercent, promoLabel: reorderPromoLabel } : {}),
        },
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
  const limit = await rateLimit(req, { maxAttempts: 10, windowMs: 60 * 1000 });
  if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
  if (limit.limited) return tooManyRequests('Too many orders. Slow down.', limit.retryAfter);
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
  return createOrderForSession(session, body, req, { source: 'web' });
}

/**
 * The one order path. The web route and the reseller API both come through
 * here: the same validation, pricing, wholesale, balance debit, creation and
 * provider placement. `source` is stamped on the order so admin can tell them apart.
 */
export async function createOrderForSession(session, body, req, { source = 'web', catalogue = false } = {}) {
  try {
    const parsedInput = parseCreateOrderInput(body);
    if (!parsedInput.ok) return Response.json({ error: parsedInput.error }, { status: 400 });
    const {
      tierId,
      serviceId,
      link: trimmedLink,
      quantity,
      comments,
      rawDripDays,
      confirmDuplicate,
      redeemPoints,
      isUrl,
      trafficConfig,
    } = parsedInput.value;

    // Get USD→NGN rate for cost calculation only after the request boundary
    // has accepted the payload.
    const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    const usdRate = Number(usdRateSetting?.value || 1600);

    // Duplicate order check — warn if same service tier + link in last 24h
    if (!confirmDuplicate) {
      const recentDupe = await prisma.order.findFirst({
        where: {
          userId: session.id,
          link: trimmedLink,
          ...(tierId ? { tierId } : { serviceId }),
          status: { in: ['Pending', 'Processing'] },
          deletedAt: null,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { orderId: true, quantity: true, createdAt: true },
      });
      if (recentDupe) {
        return Response.json({
          duplicate: true,
          existing: { id: recentDupe.orderId, quantity: recentDupe.quantity, created: recentDupe.createdAt.toISOString() },
          message: `You already placed an order for this link recently (${recentDupe.orderId}). Are you sure you want to place another?`,
        }, { status: 409 });
      }
    }

    let service, tier;

    if (tierId) {
      // New flow: resolve service from tier
      tier = await prisma.serviceTier.findUnique({
        where: { id: tierId },
        include: { service: true, group: true },
      });
      if (!tier || !tier.enabled || !tier.group?.enabled) {
        return Response.json({ error: 'Service tier not available' }, { status: 400 });
      }
      service = tier.service;
      if (!service || !service.enabled) {
        return Response.json({ error: 'Backing service not available' }, { status: 400 });
      }
    } else {
      // Legacy flow: direct serviceId. A full-catalogue reseller may order any
      // listed, priced provider service whether or not it is on the retail menu.
      service = await prisma.service.findUnique({ where: { id: serviceId } });
      const inCatalogue = catalogue && service && ['mtp', 'dao'].includes(service.provider) && service.providerListedAt && Number(service.costPer1k) > 0;
      if (!service || (!service.enabled && !inCatalogue)) {
        return Response.json({ error: 'Service not available' }, { status: 400 });
      }
    }

    const pricing = calculateCreateOrderPricing({ tier, service, quantity, usdRate });
    if (!pricing.ok) return Response.json({ error: pricing.error }, { status: 400 });
    let {
      qty,
      chargeKobo: charge,
      costKobo: cost,
      offerSnapshot,
      tierName,
    } = pricing.value;

    const offerInput = validateCreateOrderOfferInput({ tier, service, link: trimmedLink, isUrl, comments });
    if (!offerInput.ok) return Response.json({ error: offerInput.error }, { status: 400 });
    const { apiType, needsUsernames, needsAnswer, needsKeywords } = offerInput.value;

    // Wholesale, computed server-side from the tier price. Never trusted from the
    // client, and it replaces the retail discounts below rather than stacking:
    // a wholesale rate compounded with loyalty and a promotion is the one path
    // that reaches below cost.
    const resellerTerms = await getResellerTerms(session.id);
    if (resellerTerms) {
      charge = wholesaleOf(charge, resellerTerms, await getMarkupSettings());
    }

    // Apply Nitro Status discount based on eligible lifetime spend
    let loyaltyDiscount = 0;
    let nitroTier = null;
    try {
      const spendKobo = await getEligibleSpendKoboTx(prisma, session.id);
      nitroTier = getNitroStatus(Math.floor(spendKobo / 100));
      loyaltyDiscount = resellerTerms ? 0 : computeNitroDiscount(charge, nitroTier);
      if (loyaltyDiscount > 0) {
        charge = Math.max(100, Math.ceil((charge - loyaltyDiscount) / 100) * 100);
      }
    } catch (err) { log.warn('Nitro Status discount', err.message); }

    // Apply promotion discount (stacks with loyalty, but never with wholesale)
    let promoDiscount = 0;
    let promoPercent = null;
    let activePromoId = null;
    let activePromoType = null;
    let promoLabel = null;
    try {
      const activePromo = resellerTerms ? null : await getActivePromotion();
      if (activePromo) {
        const { type, promotion: promo } = activePromo;
        promoDiscount = applyPromotionDiscount(charge, promo, promo.maxDiscountPerOrder);
        if (promoDiscount > 0) {
          promoPercent = promo.discountPercent;
          activePromoId = promo.id;
          activePromoType = type;
          promoLabel = promo.lineItemLabel;
          charge = Math.max(100, Math.ceil((charge - promoDiscount) / 100) * 100);
        }
      }
    } catch (err) { log.warn('Promotion discount', err.message); }

    // Check for active order on same service + link (providers reject duplicates)
    const activeForLink = await findOpenSameLinkOrder(prisma, {
      serviceId: service.id,
      link: trimmedLink,
    });

    // Generate order ID
    const orderId = await nextOrderId();
    const eventId = `purchase_${orderId}`;

    // Calculate drip schedule if needed
    const DAILY_CAP = { followers: 5000, likes: 10000, views: 75000, plays: 75000, comments: 1000, reviews: 100, engagement: 15000 };
    const MIN_DAYS_FLOOR = { followers: 3, views: 1, plays: 1, likes: 2, comments: 3, reviews: 3, engagement: 2 };
    const groupType = (tier?.group?.type || "").toLowerCase();
    const platform = (service.category || '').toLowerCase();
    const dailyCap = DAILY_CAP[groupType] || 15000;
    const daysFloor = MIN_DAYS_FLOOR[groupType] || 3;
    const maxDripDays = qty <= 5000 ? 5 : qty <= 10000 ? 7 : qty <= 25000 ? 12 : qty <= 50000 ? 18 : qty <= 100000 ? 25 : 30;
    const minDripDays = Math.min(Math.max(daysFloor, Math.ceil(qty / dailyCap)), maxDripDays);
    const skipDrip = rawDripDays === 0 || process.env.NODE_ENV === 'development';
    const validDripDays = rawDripDays && rawDripDays > 0 ? Math.min(maxDripDays, Math.max(minDripDays, Math.floor(Number(rawDripDays)))) : null;
    const providerMin = service.min || 50;
    let dripSchedule = null;
    const dripEligible = tier?.group?.tags?.includes('drip');
    const dripCfg = getDripConfig(groupType, platform);
    if (dripEligible && validDripDays && validDripDays >= 2) {
      const safeConfig = { version: 1 };
      const feasibility = checkDripFeasibility(qty, validDripDays, safeConfig, groupType, platform, providerMin);
      if (!feasibility.feasible) {
        return Response.json({ error: feasibility.error }, { status: 400 });
      }
      dripSchedule = calculateMultiDayDrip(qty, validDripDays, providerMin, new Date(), groupType, platform, safeConfig);
      if (dripSchedule?.dispatches) {
        const invalid = dripSchedule.dispatches.find(d => d.quantity < providerMin || d.quantity <= 0);
        if (invalid) {
          return Response.json({ error: `Cannot split ${qty.toLocaleString()} across ${validDripDays} days — some batches would be below the service minimum (${providerMin}). Try fewer days or a larger quantity.` }, { status: 400 });
        }
      }
    } else if (dripEligible && !skipDrip && dripCfg && qty >= dripCfg.threshold) {
      const intraday = calculateIntradayDrip(qty, providerMin, new Date(), groupType, platform);
      if (intraday) {
        const durationErr = validateIntradayDuration(intraday.dispatches);
        if (durationErr) {
          return Response.json({ error: `${qty.toLocaleString()} ${groupType} requires more than one day of delivery. Please select at least 2 days.` }, { status: 400 });
        }
        dripSchedule = { dispatches: intraday.dispatches.map(d => ({ ...d, day: 1 })) };
      }
    }

    // Step 1: Atomic balance deduct FIRST — before sending to provider
    let pointsDiscountKobo = 0;
    let result;
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < (redeemPoints ? MAX_RETRIES : 1); attempt++) {
      try {
        pointsDiscountKobo = 0;
        result = await prisma.$transaction(async (tx) => {
          if (redeemPoints) {
            const balanceKobo = await getPointsBalanceKoboTx(tx, session.id);
            if (balanceKobo >= MIN_REDEEM_POINTS * 100) {
              pointsDiscountKobo = Math.min(balanceKobo, charge);
            }
          }
          const walletCharge = charge - pointsDiscountKobo;
          // A zero wallet charge still acquires the active-user row fence. This
          // prevents a points-only order racing past an account-deletion claim.
          await deductBalance(tx, session.id, walletCharge);
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
              comments: comments ? comments.split('\n').map(l => l.trim().replace(/^[“”””]+|[“”””]+$/g, '').trim()).filter(Boolean).join('\n').slice(0, 5000) : null,
              ...(trafficConfig ? { trafficConfig } : {}),
              loyaltyDiscount,
              // Null for resellers: wholesale orders accrue no loyalty points.
              nitroStatusAtPurchase: resellerTerms ? null : (nitroTier?.key || null),
              ...offerSnapshot,
              nitroPointsRedeemedKobo: pointsDiscountKobo,
              campaignDiscount: promoDiscount,
              campaignPercent: promoPercent,
              platformCampaignId: activePromoType === 'platform' ? activePromoId : null,
              recurringCampaignId: activePromoType === 'recurring' ? activePromoId : null,
              status: 'Pending',
              source,
              apiOrderId: null,
              ...(activeForLink ? { queuedBehind: activeForLink.orderId } : {}),
              ...(dripSchedule ? { dripDays: validDripDays || 1 } : {}),
            },
          });
          if (pointsDiscountKobo > 0) {
            await tx.nitroPointLedger.create({
              data: {
                userId: session.id,
                type: 'redeemed_order',
                pointsKobo: -pointsDiscountKobo,
                dedupeKey: `redeemed_order:${order.id}`,
                orderId: order.id,
              },
            });
          }
          await trackBonusConsumption(tx, session.id, order.id, walletCharge);
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
          const nitroTierName = nitroTier?.name || null;
          const discountParts = [
            loyaltyDiscount > 0 ? `${nitroTierName} -₦${(loyaltyDiscount/100).toLocaleString()}` : null,
            promoDiscount > 0 ? `${promoLabel} -₦${(promoDiscount/100).toLocaleString()}` : null,
            pointsDiscountKobo > 0 ? `Points -₦${(pointsDiscountKobo/100).toLocaleString()}` : null,
          ].filter(Boolean);
          await tx.transaction.create({
            data: {
              userId: session.id,
              type: 'order',
              amount: -walletCharge,
              method: 'wallet',
              status: 'Completed',
              reference: orderId,
              note: `Order ${orderId} — ${tierName} x${qty.toLocaleString()}${discountParts.length > 0 ? ` (${discountParts.join(', ')})` : ''}`,
            },
          });
          await enqueueMetaEvent(tx, 'Purchase', {
            ...buildPurchaseEvent(req, {
              eventId,
              eventTime: order.createdAt,
              email: session.email,
              phone: session.phone,
              externalId: session.id,
              valueKobo: charge,
            }),
            // Provider rejection can still unwind this checkout. Keep the
            // durable row out of cron's lease window until that short path ends.
            notBefore: new Date(Date.now() + 5 * 60 * 1000),
          });
          return order;
        }, redeemPoints ? { isolationLevel: 'Serializable' } : undefined);
        break;
      } catch (e) {
        if (redeemPoints && e.code === 'P2034' && attempt < MAX_RETRIES - 1) continue;
        throw e;
      }
    }

    // Step 2: Place on provider AFTER balance is secured (skip in dev / skip if queued)
    let apiOrderId = null;
    let queued = !!activeForLink;
    if (!queued) {
      // Close the pre-insert race between simultaneous same-link orders. The
      // deterministic FIFO blocker makes only the oldest row eligible to claim.
      const blocker = await findSameLinkDispatchBlocker(prisma, result);
      if (blocker) {
        const held = await prisma.order.updateMany({
          where: { id: result.id, status: 'Pending', apiOrderId: null, deletedAt: null },
          data: { queuedBehind: blocker.orderId },
        });
        queued = held.count > 0;
      }
    }
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && !queued) {
      apiOrderId = `DEV-${Date.now()}`;
      const recorded = await prisma.order.updateMany({
        where: { id: result.id, status: 'Pending', apiOrderId: null, queuedBehind: null, deletedAt: null },
        data: { apiOrderId, status: 'Processing' },
      });
      if (recorded.count === 0) {
        apiOrderId = null;
        queued = true;
      }
    } else if (service.apiId && !queued) {
      const provider = service.provider || 'mtp';
      const extra = {};
      if (comments) {
        const safeComments = comments.split('\n').map(l => l.trim().replace(/^[""""]+|[""""]+$/g, '').trim()).filter(Boolean).join('\n').slice(0, 5000);
        if (needsKeywords) extra.keywords = safeComments;
        else if (needsUsernames) extra.usernames = safeComments;
        else if (needsAnswer) extra.answer_number = safeComments;
        else extra.comments = safeComments;
      }

      if (apiType === 'subscriptions') {
        const match = trimmedLink.match(/instagram\.com\/([^/?#]+)/);
        if (match) extra.username = match[1];
      }
      if (trafficConfig) {
        if (trafficConfig.country) extra.country = trafficConfig.country;
        if (trafficConfig.device) extra.device = trafficConfig.device;
        if (trafficConfig.trafficType === 'keyword' && trafficConfig.keyword) extra.keywords = trafficConfig.keyword;
        else if (trafficConfig.trafficType === 'referrer' && trafficConfig.referrer) extra.referrer = trafficConfig.referrer;
      }

      if (dripSchedule) {
        // Drip: dispatch batch 1 immediately, cron handles the rest
        await prisma.order.updateMany({ where: { id: result.id, status: 'Pending', queuedBehind: null, deletedAt: null }, data: { dispatchedAt: new Date() } });
        const first = await prisma.dripDispatch.findFirst({ where: { orderId: result.id, day: 1, batch: 1 } });
        if (first) {
          const firstClaim = await prisma.dripDispatch.updateMany({
            where: { id: first.id, status: 'pending', order: { status: 'Pending', queuedBehind: null, deletedAt: null } },
            data: { status: 'dispatching', dispatchedAt: new Date() },
          });
          if (firstClaim.count === 0) {
            queued = true;
          } else try {
            const batchExtra = { ...extra };
            if (apiType === 'subscriptions') { batchExtra.min = first.quantity; batchExtra.max = first.quantity; }
            if (batchExtra.comments && dripSchedule.dispatches?.length > 1) {
              const { sliceCommentsForBatch } = await import('@/lib/drip-feed');
              batchExtra.comments = sliceCommentsForBatch(batchExtra.comments, first.quantity, dripSchedule.dispatches, { day: 1, batch: 1 });
            }
            const provResult = await placeOrder(provider, service.apiId, trimmedLink, first.quantity, batchExtra);
            const batchApiId = provResult.order ? String(provResult.order) : null;
            if (batchApiId) {
              const recorded = await prisma.dripDispatch.updateMany({
                where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } },
                data: { apiOrderId: batchApiId, status: 'processing' },
              });
              if (recorded.count > 0) {
                await prisma.order.updateMany({ where: { id: result.id, status: 'Pending', deletedAt: null }, data: { status: 'Processing', dripDelivered: 1, queuedBehind: null } });
                apiOrderId = batchApiId;
              } else {
                prisma.adminIssue.create({
                  data: { type: 'ghost_dispatch', title: `${orderId} batch 1: provider accepted after local cancellation`, message: `Provider order ${batchApiId} was created after the local order became terminal. Verify provider state before taking action.`, metadata: JSON.stringify({ orderId, batch: 1, providerOrderId: batchApiId, link: trimmedLink }) },
                }).catch(() => {});
              }
            } else {
              await prisma.dripDispatch.updateMany({ where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } }, data: { status: 'failed', lastError: 'no_order_id' } });
            }
          } catch (err) {
            log.error('Drip batch 1', err.message);
            const msg = err.message || '';
            if (/incorrect service|invalid service/i.test(msg)) {
              try {
                const refunded = await refundRejectedCreatedOrder({
                  userId: session.id,
                  orderDbId: result.id,
                  orderId,
                  charge,
                  pointsDiscountKobo,
                  message: msg,
                  drip: true,
                });
                if (!refunded) {
                  return Response.json({ error: 'Order state changed before the refund could be issued.' }, { status: 409 });
                }
                return Response.json({ error: 'This service is temporarily unavailable. You have been refunded.' }, { status: 409 });
              } catch (refundErr) { log.error('Drip auto-refund', refundErr.message); }
            }
            if (isActiveOrderConflict(err)) {
              queued = true;
              const blocker = await findSameLinkDispatchBlocker(prisma, result);
              try {
                await prisma.dripDispatch.updateMany({
                  where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } },
                  data: { status: 'pending', lastError: null, dispatchedAt: null, scheduledAt: new Date(Date.now() + 30 * 60 * 1000) },
                });
                await prisma.order.updateMany({
                  where: { id: result.id, status: 'Pending', deletedAt: null },
                  data: { status: 'Pending', dispatchedAt: null, queuedBehind: blocker?.orderId || null },
                });
              } catch {}
            } else {
              try { await prisma.dripDispatch.updateMany({ where: { id: first.id, status: 'dispatching', order: { status: 'Pending', deletedAt: null } }, data: { status: 'failed', lastError: msg.slice(0, 450) } }); } catch {}
            }
          }
        }
      } else {
        // Direct dispatch (no drip)
        const directClaim = await prisma.order.updateMany({
          where: { id: result.id, status: 'Pending', apiOrderId: null, queuedBehind: null, deletedAt: null },
          data: { status: 'Dispatching', dispatchedAt: new Date(), queuedBehind: null },
        });
        if (directClaim.count === 0) {
          queued = true;
        } else try {
          if (apiType === 'subscriptions') { extra.min = qty; extra.max = qty; }
          const provResult = await placeOrder(provider, service.apiId, trimmedLink, qty, extra);
          apiOrderId = provResult.order ? String(provResult.order) : null;
          if (apiOrderId) {
            const recorded = await prisma.order.updateMany({
              where: { id: result.id, status: 'Dispatching', apiOrderId: null, deletedAt: null },
              data: { apiOrderId, status: 'Processing', lastError: null },
            });
            if (recorded.count === 0) {
              apiOrderId = null;
              prisma.adminIssue.create({
                data: { type: 'ghost_dispatch', title: `${orderId}: provider accepted after local cancellation`, message: `Provider order ${String(provResult.order)} was created after the local order became terminal. Verify provider state before taking action.`, metadata: JSON.stringify({ orderId, providerOrderId: String(provResult.order), link: trimmedLink }) },
              }).catch(() => {});
            }
          } else {
            await prisma.order.updateMany({ where: { id: result.id, status: 'Dispatching', apiOrderId: null }, data: { status: 'Pending', dispatchedAt: null } });
          }
        } catch (err) {
        log.error('Order Place', err.message);
        const msg = err.message || '';
        const permanent = /incorrect service|invalid service/i.test(msg);
        if (permanent) {
          try {
            const refunded = await refundRejectedCreatedOrder({
              userId: session.id,
              orderDbId: result.id,
              orderId,
              charge,
              pointsDiscountKobo,
              message: msg,
            });
            if (!refunded) {
              return Response.json({ error: 'Order state changed before the refund could be issued.' }, { status: 409 });
            }
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
          if (isActiveOrderConflict(err)) {
            queued = true;
            const blocker = await findSameLinkDispatchBlocker(prisma, result);
            try { await prisma.order.updateMany({ where: { id: result.id, status: 'Dispatching', apiOrderId: null }, data: { status: 'Pending', dispatchedAt: null, queuedBehind: blocker?.orderId || null, lastError: PROVIDER_ACTIVE_WAIT, retryCount: 0 } }); } catch {}
          } else {
            try { await prisma.order.updateMany({ where: { id: result.id, status: 'Dispatching', apiOrderId: null }, data: { lastError: msg.slice(0, 450) } }); } catch {}
          }
        }
      }
    }

    triggerPurchaseDelivery(eventId);
    tgNewOrder(orderId, tierName, qty, charge, session.email, trimmedLink, offerSnapshot.platformAtPurchase || '');
    checkFirstOrder(session.id, tierName);

    return Response.json({
      success: true,
      eventId,
      ...(queued ? { queued: true, message: `Order queued — will start automatically when your current order for this link completes.` } : {}),
      order: {
        id: orderId,
        service: tierName,
        quantity: qty,
        charge: charge / 100,
        status: apiOrderId ? 'Processing' : 'Pending',
        ...(loyaltyDiscount > 0 ? { loyaltyDiscount: loyaltyDiscount / 100, loyaltyTier: nitroTier?.name } : {}),
        ...(promoDiscount > 0 ? { promoDiscount: promoDiscount / 100, promoPercent, promoLabel } : {}),
        ...(pointsDiscountKobo > 0 ? { pointsRedeemed: pointsDiscountKobo / 100 } : {}),
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
