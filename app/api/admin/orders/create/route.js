import prisma from '@/lib/prisma';
import { log } from '@/lib/logger';
import { requireAdmin, logActivity } from '@/lib/admin';
import { cleanLink } from '@/lib/clean-link';
import { validateDripConfig, calculateIntradayDrip, calculateMultiDayDrip, getDripConfig, checkDripFeasibility } from '@/lib/drip-feed';
import { buildOrderOfferSnapshot } from '@/lib/order-offer-display';
import { findOpenSameLinkOrder } from '@/lib/order-queue';
import { tgNewOrder } from '@/lib/telegram';

async function nextOrderIds(tx, count) {
  const rows = await tx.order.findMany({
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
  return Array.from({ length: count }, (_, i) => `NTR-${max + 1 + i}`);
}

async function nextBatchId() {
  const rows = await prisma.order.findMany({
    where: { batchId: { startsWith: 'BULK-' } },
    select: { batchId: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  let max = 0;
  for (const r of rows) {
    const n = parseInt(r.batchId.replace(/^BULK-/, ''), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `BULK-${max + 1}`;
}

export const maxDuration = 60;

export async function POST(req) {
  const { admin, error } = await requireAdmin('orders', true);
  if (error) return error;

  try {
    const body = await req.json();
    const { mode, userId, charge: shouldCharge } = body;

    if (!userId) return Response.json({ error: 'User is required' }, { status: 400 });
    if (!['single', 'bulk', 'drip'].includes(mode)) return Response.json({ error: 'Invalid mode' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, balance: true } });
    if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

    const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
    const usdRate = Number(usdRateSetting?.value || 1600);

    if (mode === 'bulk') {
      const { items } = body;
      if (!Array.isArray(items) || items.length === 0) return Response.json({ error: 'No items' }, { status: 400 });
      if (items.length > 100) return Response.json({ error: 'Max 100 items per batch' }, { status: 400 });

      const tierIds = [...new Set(items.map(it => it.tierId))];
      const tiers = await prisma.serviceTier.findMany({
        where: { id: { in: tierIds }, enabled: true },
        include: { service: true, group: { select: { name: true, platform: true, type: true, enabled: true } } },
      });
      const tierMap = Object.fromEntries(tiers.map(t => [t.id, t]));

      const orders = [];
      let totalCharge = 0;

      for (const it of items) {
        const tier = tierMap[it.tierId];
        if (!tier) return Response.json({ error: `Tier ${it.tierId} not found or disabled` }, { status: 400 });
        if (!tier.group?.enabled) return Response.json({ error: `Service group for tier ${it.tierId} is disabled` }, { status: 400 });
        if (!tier.service?.enabled) return Response.json({ error: `Service for tier ${it.tierId} is disabled` }, { status: 400 });

        const qty = Number(it.quantity) || 0;
        const min = tier.min || tier.service.min || 100;
        const max = tier.max || tier.service.max || 50000;
        if (qty < min || qty > max) return Response.json({ error: `Quantity ${qty} out of range (${min}–${max}) for ${tier.group.name} ${tier.tier}` }, { status: 400 });

        const links = Array.isArray(it.links) ? it.links : [];
        if (links.length === 0) return Response.json({ error: 'Each item needs at least one link' }, { status: 400 });

        for (const rawLink of links) {
          const link = cleanLink(rawLink.trim());
          if (!link) return Response.json({ error: `Invalid link: ${rawLink}` }, { status: 400 });

          const sellPer1k = Number(tier.sellPer1k);
          const chargeKobo = shouldCharge ? Math.ceil(sellPer1k * qty / 1000 / 100) * 100 : 0;
          const costKobo = Math.ceil((Number(tier.service.costPer1k) * usdRate / 1000) * qty / 100) * 100;

          const snapshot = buildOrderOfferSnapshot({ tier, service: tier.service });

          orders.push({ tier, link, quantity: qty, charge: chargeKobo, cost: costKobo, snapshot });
          totalCharge += chargeKobo;
        }
      }

      if (shouldCharge && totalCharge > 0 && user.balance < totalCharge) {
        return Response.json({ error: `Insufficient balance: has ₦${(user.balance / 100).toLocaleString()}, needs ₦${(totalCharge / 100).toLocaleString()}` }, { status: 400 });
      }

      const batchId = await nextBatchId();

      const createdIds = await prisma.$transaction(async (tx) => {
        if (shouldCharge && totalCharge > 0) {
          const debited = await tx.$executeRaw`UPDATE users SET balance = balance - ${totalCharge} WHERE id = ${user.id} AND balance >= ${totalCharge}`;
          if (Number(debited) !== 1) throw new Error('Insufficient balance');
        }

        const ids = await nextOrderIds(tx, orders.length);
        const orderIds = [];

        for (let i = 0; i < orders.length; i++) {
          const o = orders[i];
          const blocker = await findOpenSameLinkOrder(tx, { serviceId: o.tier.serviceId, link: o.link });

          const created = await tx.order.create({
            data: {
              orderId: ids[i], userId: user.id, serviceId: o.tier.serviceId, tierId: o.tier.id,
              link: o.link, quantity: o.quantity, charge: o.charge, cost: o.cost,
              batchId, status: 'Pending',
              ...o.snapshot,
              ...(blocker ? { queuedBehind: blocker.orderId } : {}),
            },
          });

          if (o.charge > 0) {
            await tx.transaction.create({
              data: {
                userId: user.id, type: 'order', amount: -o.charge,
                method: 'wallet', status: 'Completed', reference: ids[i],
                note: `Admin order ${ids[i]} — ${o.snapshot.serviceNameAtPurchase || 'Service'}${o.snapshot.tierNameAtPurchase ? ` (${o.snapshot.tierNameAtPurchase})` : ''} x${o.quantity.toLocaleString()}`,
              },
            });
          }

          orderIds.push(ids[i]);
        }

        return orderIds;
      });

      tgNewOrder(batchId, `Batch (${createdIds.length} orders) by ${admin.name}`, createdIds.length, totalCharge, user.name, null, null).catch(() => {});
      await logActivity(admin.name, `Created batch ${batchId} (${createdIds.length} orders, ${shouldCharge ? `₦${(totalCharge / 100).toLocaleString()} charged` : 'free'}) for ${user.name}`, 'order');

      return Response.json({ success: true, batchId, count: createdIds.length, orderIds: createdIds });
    }

    // single or drip
    const { tierId, quantity, link: rawLink, dripDays, dripConfig: rawDripConfig } = body;
    if (!tierId) return Response.json({ error: 'Tier is required' }, { status: 400 });
    if (!rawLink) return Response.json({ error: 'Link is required' }, { status: 400 });

    const link = cleanLink(rawLink.trim());
    if (!link) return Response.json({ error: 'Invalid link' }, { status: 400 });

    const tier = await prisma.serviceTier.findUnique({
      where: { id: tierId },
      include: { service: true, group: { select: { name: true, platform: true, type: true, enabled: true, tags: true } } },
    });
    if (!tier || !tier.enabled) return Response.json({ error: 'Tier not found or disabled' }, { status: 400 });
    if (!tier.group?.enabled) return Response.json({ error: 'Service group disabled' }, { status: 400 });
    if (!tier.service?.enabled) return Response.json({ error: 'Service disabled' }, { status: 400 });

    const qty = Number(quantity) || 0;
    const min = tier.min || tier.service.min || 100;
    const max = tier.max || tier.service.max || 50000;
    if (qty < min || qty > max) return Response.json({ error: `Quantity ${qty} out of range (${min}–${max})` }, { status: 400 });

    const sellPer1k = Number(tier.sellPer1k);
    const chargeKobo = shouldCharge ? Math.ceil(sellPer1k * qty / 1000 / 100) * 100 : 0;
    const costKobo = Math.ceil((Number(tier.service.costPer1k) * usdRate / 1000) * qty / 100) * 100;

    if (shouldCharge && chargeKobo > 0 && user.balance < chargeKobo) {
      return Response.json({ error: `Insufficient balance: has ₦${(user.balance / 100).toLocaleString()}, needs ₦${(chargeKobo / 100).toLocaleString()}` }, { status: 400 });
    }

    const dripNum = mode === 'drip' ? (Number(dripDays) || 0) : 0;
    if (mode === 'drip' && (!Number.isInteger(dripNum) || dripNum < 2 || dripNum > 60)) {
      return Response.json({ error: 'Drip days must be a whole number between 2 and 60' }, { status: 400 });
    }

    const providerMin = tier.service.min || 50;
    const groupType = tier.group?.type || '';
    const platform = (tier.group?.platform || '').toLowerCase();
    const dripEligible = tier.group?.tags?.includes('drip');
    const dripCfg = getDripConfig(groupType, platform);

    let dripConfigObj = null;
    if (dripNum >= 2) {
      if (rawDripConfig != null) {
        const v = validateDripConfig(rawDripConfig, dripNum);
        if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
        dripConfigObj = v.config;
      }
      if (!dripConfigObj) dripConfigObj = { version: 1 };
    }

    let dripSchedule = null;
    if (dripNum >= 2) {
      const feas = checkDripFeasibility(qty, dripNum, dripConfigObj, groupType, platform, providerMin);
      if (!feas.feasible) return Response.json({ error: feas.error }, { status: 400 });
      dripSchedule = calculateMultiDayDrip(qty, dripNum, providerMin, new Date(), groupType, platform, dripConfigObj);
    } else if (mode === 'single' && dripEligible && dripCfg && qty >= dripCfg.threshold) {
      const intraday = calculateIntradayDrip(qty, providerMin, new Date(), groupType, platform);
      if (intraday) dripSchedule = { dispatches: intraday.dispatches.map(d => ({ ...d, day: 1 })) };
    }

    if (dripSchedule) {
      const totalDispatched = dripSchedule.dispatches.reduce((s, d) => s + d.quantity, 0);
      if (totalDispatched !== qty) {
        return Response.json({ error: `Drip schedule quantity mismatch: dispatches total ${totalDispatched}, order is ${qty}` }, { status: 500 });
      }
      const invalidRow = dripSchedule.dispatches.find(d => d.quantity <= 0 || (providerMin > 0 && d.quantity < providerMin));
      if (invalidRow) {
        return Response.json({ error: `Schedule produces an invalid batch of ${invalidRow.quantity} units (minimum is ${providerMin})` }, { status: 400 });
      }
    }

    const snapshot = buildOrderOfferSnapshot({ tier, service: tier.service });
    const blocker = await findOpenSameLinkOrder(prisma, { serviceId: tier.serviceId, link });

    const orderId = await prisma.$transaction(async (tx) => {
      if (shouldCharge && chargeKobo > 0) {
        const debited = await tx.$executeRaw`UPDATE users SET balance = balance - ${chargeKobo} WHERE id = ${user.id} AND balance >= ${chargeKobo}`;
        if (Number(debited) !== 1) throw new Error('Insufficient balance');
      }

      const [id] = await nextOrderIds(tx, 1);

      const created = await tx.order.create({
        data: {
          orderId: id, userId: user.id, serviceId: tier.serviceId, tierId: tier.id,
          link, quantity: qty, charge: chargeKobo, cost: costKobo,
          status: 'Pending',
          ...snapshot,
          ...(blocker ? { queuedBehind: blocker.orderId } : {}),
          ...(dripSchedule ? { dripDays: dripNum || 1, ...(dripConfigObj ? { dripConfig: dripConfigObj } : {}) } : {}),
        },
      });

      if (dripSchedule) {
        await tx.dripDispatch.createMany({
          data: dripSchedule.dispatches.map(d => ({
            orderId: created.id, day: d.day, batch: d.batch, quantity: d.quantity, scheduledAt: d.scheduledAt,
          })),
        });
      }

      if (chargeKobo > 0) {
        await tx.transaction.create({
          data: {
            userId: user.id, type: 'order', amount: -chargeKobo,
            method: 'wallet', status: 'Completed', reference: id,
            note: `Admin order ${id} — ${snapshot.serviceNameAtPurchase || 'Service'}${snapshot.tierNameAtPurchase ? ` (${snapshot.tierNameAtPurchase})` : ''} x${qty.toLocaleString()}${dripNum ? ` (${dripNum}-day drip)` : ''}`,
          },
        });
      }

      return id;
    });

    tgNewOrder(orderId, `${snapshot.serviceNameAtPurchase || 'Service'} (${snapshot.tierNameAtPurchase || ''}) by ${admin.name}`, qty, chargeKobo, user.name, link, snapshot.platformAtPurchase).catch(() => {});
    await logActivity(admin.name, `Created order ${orderId} (${snapshot.serviceNameAtPurchase} ${snapshot.tierNameAtPurchase}, ${qty.toLocaleString()} qty${dripNum ? `, ${dripNum}-day drip` : ''}, ${shouldCharge ? `₦${(chargeKobo / 100).toLocaleString()}` : 'free'}) for ${user.name}`, 'order');

    return Response.json({ success: true, orderIds: [orderId] });
  } catch (err) {
    log.error('Admin Create Order', err.message);
    return Response.json({ error: err.message || 'Failed to create order' }, { status: 500 });
  }
}
