import prisma from './prisma.js';
import { log } from './logger.js';
import { newGuestCode, normalizeGuestCode } from './guest-code.js';
import { guestAccountId, isGuestAccountEmail } from './guest-account.js';
import { calculateCreateOrderPricing, parseCreateOrderInput, validateCreateOrderOfferInput } from './order-create-input.server.js';
import { applyPromotionDiscount, getActivePromotion } from './promotions.js';
import { autoTargetError, autoTargetFrom, isAutoService } from './auto-services.js';
import { canChargeIn, foreignChargeAmount } from './currency.js';
import { resolveDepositRate } from './fx-deposit.js';
import { getFlutterwaveSecretKey } from './flutterwave-payment.js';
import { getApplicationUrl } from './env.js';
import { fetchWithRetry } from './fetch.js';

/**
 * Guest checkout: one order, no account (docs/v2/guest_checkout_brief.md).
 *
 * The visitor's payment is an ordinary Flutterwave deposit and their order an
 * ordinary order, on the account that owns the checkout: the shared guest
 * account, or the existing account their email belongs to. Nothing here moves
 * money by itself; finalizeDeposit credits the payment and
 * createOrderForSession spends it, exactly as for any customer.
 */

export const GUEST_MIN_ORDER_KOBO = 1000_00;
export const GUEST_HOLD_MS = 30 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Decided 16 Oct 2026: guests pay by bank transfer, USSD or Opay, and by mobile
// money outside Nigeria. No cards while the dispute rate is unknown; signed-in
// customers keep them.
const GUEST_PAYMENT_OPTIONS = Object.freeze({ NGN: 'banktransfer,ussd,opay', GHS: 'mobilemoneyghana', KES: 'mpesa' });

function fail(error, status = 400) {
  return { ok: false, error, status };
}

/**
 * Price an order the way createOrderForSession prices a retail one: the tier's
 * sell price, any live site-wide promotion, and nothing else. No Nitro Status,
 * points, coupons or bonuses for a guest (decided 16 Oct 2026). Every check the
 * order route runs before taking money runs here first, so a link that cannot
 * be ordered is refused before anybody pays.
 */
export async function priceGuestOrder({ tierId, link, quantity, comments }) {
  if (typeof tierId !== 'string' || !tierId) return fail('Pick a service');
  const parsed = parseCreateOrderInput({ tierId, link, quantity, comments });
  if (!parsed.ok) return fail(parsed.error);

  const tier = await prisma.serviceTier.findUnique({ where: { id: tierId }, include: { service: true, group: true } });
  if (!tier || !tier.enabled || !tier.group?.enabled || !tier.service?.enabled) return fail('That service is not available right now');
  // Option groups (poll votes) stay in the full app: the composer has no picker for them.
  if (tier.group.tags?.includes('options')) return fail('That service is only available in the app');
  const service = tier.service;
  if (isAutoService(service) && !autoTargetFrom(parsed.value.link, service.platform)) return fail(autoTargetError(service.platform));

  const usdRateSetting = await prisma.setting.findUnique({ where: { key: 'markup_usd_rate' } });
  const usdRate = Number(usdRateSetting?.value || 1600);
  const pricing = calculateCreateOrderPricing({ tier, service, quantity, usdRate });
  if (!pricing.ok) return fail(pricing.error);
  const offer = validateCreateOrderOfferInput({ tier, service, link: parsed.value.link, isUrl: parsed.value.isUrl, comments });
  if (!offer.ok) return fail(offer.error);

  // The same promotion arithmetic as the order route, or the held price would
  // never match the charge and every guest order would be refused.
  let charge = pricing.value.chargeKobo;
  const active = await getActivePromotion().catch(() => null);
  if (active) {
    const discount = applyPromotionDiscount(charge, active.promotion, active.promotion.maxDiscountPerOrder);
    if (discount > 0) charge = Math.max(100, Math.ceil((charge - discount) / 100) * 100);
  }
  if (charge < GUEST_MIN_ORDER_KOBO) return fail('Orders start at ₦1,000. Add a few more.');

  return {
    ok: true,
    value: { tier, service, link: parsed.value.link, quantity: pricing.value.qty, comments: comments || null, priceKobo: charge },
  };
}

/** Hold a price for 30 minutes under a fresh guest code. */
export async function quoteGuestOrder(input, { ip, ua, fbp, fbc } = {}) {
  const priced = await priceGuestOrder(input);
  if (!priced.ok) return priced;
  const ownerUserId = await guestAccountId();
  if (!ownerUserId) return fail('Ordering without an account is not available right now', 503);

  const { tier, service, link, quantity, comments, priceKobo } = priced.value;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const checkout = await prisma.guestCheckout.create({
        data: {
          code: newGuestCode(),
          ownerUserId,
          tierId: tier.id,
          serviceId: service.id,
          link,
          quantity,
          comments,
          priceKobo,
          dueKobo: priceKobo,
          expiresAt: new Date(Date.now() + GUEST_HOLD_MS),
          ip: ip || null,
          ua: ua || null,
          fbp: fbp || null,
          fbc: fbc || null,
        },
      });
      return { ok: true, checkout };
    } catch (err) {
      // A code collision is astronomically unlikely; draw another.
      if (err.code !== 'P2002') throw err;
    }
  }
  return fail('Could not start the order. Try again.', 500);
}

/** Whose order this becomes: an account the email already has, or the guest account. */
async function resolveOwner(email) {
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, status: true, deletedAt: true } });
    if (user && user.status === 'Active' && !user.deletedAt) return user.id;
  }
  return guestAccountId();
}

/**
 * Move up to `wantKobo` of a code's credit onto a checkout. Conditional on the
 * credit still being there, so two checkouts spending one code can never take
 * more than it holds.
 */
async function reserveCredit(db, { fromCode, checkout, wantKobo }) {
  const source = await db.guestCheckout.findUnique({ where: { code: fromCode }, select: { id: true, creditKobo: true } });
  if (!source || source.creditKobo <= 0 || source.id === checkout.id) return 0;
  const amount = Math.min(source.creditKobo, wantKobo);
  const taken = await db.guestCheckout.updateMany({ where: { id: source.id, creditKobo: { gte: amount } }, data: { creditKobo: { decrement: amount } } });
  if (taken.count !== 1) return 0;
  await db.guestCreditEvent.create({ data: { checkoutId: source.id, amountKobo: -amount, reason: 'spent', orderId: checkout.code } });
  return amount;
}

/**
 * Take the visitor to Flutterwave for what is due, or place the order straight
 * away when credit covers all of it.
 */
export async function startGuestPayment({ checkoutId, email: rawEmail, creditCode, currency }) {
  const email = typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim().toLowerCase().slice(0, 254) : null;
  if (email && !EMAIL_RE.test(email)) return fail('Please enter a valid email, or leave it empty');
  const guestEmail = email && !isGuestAccountEmail(email) ? email : null;

  const existing = await prisma.guestCheckout.findUnique({ where: { id: checkoutId }, include: { transaction: true } });
  if (!existing) return fail('That order has expired. Start again.', 404);
  // A second click on Pay: the same checkout page, not a second payment.
  if (existing.status === 'AwaitingPayment' && existing.transaction?.gatewayUrl) {
    return { ok: true, code: existing.code, authorizationUrl: existing.transaction.gatewayUrl };
  }
  if (existing.status !== 'Quoted' || existing.expiresAt < new Date()) return fail('That price has expired. Start again.', 410);

  const ownerUserId = await resolveOwner(guestEmail);
  if (!ownerUserId) return fail('Ordering without an account is not available right now', 503);
  const fromCode = creditCode ? normalizeGuestCode(creditCode) : null;
  if (creditCode && !fromCode) return fail('That guest code is not right. Check it and try again.');
  // Before the claim: a claimed checkout with no payment page would refuse
  // every retry until the sweep expired it.
  const secretKey = await getFlutterwaveSecretKey();
  if (!secretKey) return fail('Payments are not available right now', 503);

  const checkout = await prisma.$transaction(async (tx) => {
    const claimed = await tx.guestCheckout.updateMany({ where: { id: existing.id, status: 'Quoted' }, data: { status: 'AwaitingPayment' } });
    if (claimed.count !== 1) return null;
    const applied = fromCode ? await reserveCredit(tx, { fromCode, checkout: existing, wantKobo: existing.priceKobo }) : 0;
    return tx.guestCheckout.update({
      where: { id: existing.id },
      data: {
        ownerUserId,
        email: guestEmail,
        creditAppliedKobo: applied,
        creditFromCode: applied > 0 ? fromCode : null,
        dueKobo: existing.priceKobo - applied,
        currency: canChargeIn(currency) ? currency : 'NGN',
        // The hold restarts at Pay, so a slow payment page cannot run it out.
        expiresAt: new Date(Date.now() + GUEST_HOLD_MS),
      },
    });
  });
  if (!checkout) return fail('That order is already being paid for.', 409);

  if (checkout.dueKobo === 0) {
    const placed = await placeGuestOrder(checkout.id);
    return { ok: true, code: checkout.code, placed: placed.placed };
  }

  // The naira figure is what lands on the wallet; a foreign charge is derived
  // from it at the deposit rate, as /api/payments/initialize does.
  let chargeCurrency = 'NGN';
  let chargeAmount = checkout.dueKobo / 100;
  if (checkout.currency !== 'NGN') {
    const fx = await resolveDepositRate().catch(() => null);
    const foreign = fx ? foreignChargeAmount(checkout.dueKobo, checkout.currency, fx) : null;
    if (foreign) { chargeCurrency = checkout.currency; chargeAmount = foreign; }
  }

  const reference = `NTR-G${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const transaction = await prisma.transaction.create({
    data: {
      userId: checkout.ownerUserId,
      type: 'deposit',
      amount: checkout.dueKobo,
      method: 'flutterwave',
      status: 'Pending',
      reference,
      idempotencyKey: `guest:${checkout.id}`,
      ...(chargeCurrency !== 'NGN' ? { providerPriceAmount: String(chargeAmount), providerPriceCurrency: chargeCurrency } : {}),
      note: `Guest checkout ${checkout.code}`,
    },
  });
  await prisma.guestCheckout.update({ where: { id: checkout.id }, data: { transactionId: transaction.id } });

  const origin = getApplicationUrl();
  const res = await fetchWithRetry('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tx_ref: reference,
      amount: chargeAmount,
      currency: chargeCurrency,
      payment_options: GUEST_PAYMENT_OPTIONS[chargeCurrency] || GUEST_PAYMENT_OPTIONS.NGN,
      // Back to the order card, which turns into the receipt (the mockup's flow).
      redirect_url: `${origin}/?guest_order=${checkout.code}&verify=${reference}`,
      // Plus-addressed per payment when there is no email, so Flutterwave never
      // sees thousands of payments from one address.
      customer: { email: guestEmail || `nitrongguest+${checkout.code.replace('-', '')}@gmail.com`, name: 'Nitro guest' },
      customizations: { title: 'Nitro order', logo: `${origin}/icon-192.png` },
      meta: { guestCheckoutId: checkout.id },
    }),
  });
  const data = await res.json().catch(() => ({}));
  const url = data?.data?.link;
  if (!res.ok || !url) {
    log.warn('Guest payment', `Flutterwave refused ${reference}: ${data?.message || res.status}`);
    await releaseCheckout(checkout.id, 'Failed', 'payment_not_started');
    return fail('Could not open the payment page. Try again.', 502);
  }
  await prisma.transaction.update({ where: { id: transaction.id }, data: { gatewayUrl: url, gatewayHandoffAt: new Date() } });
  return { ok: true, code: checkout.code, authorizationUrl: url };
}

/** Give back any credit a checkout reserved and close it. */
async function releaseCheckout(checkoutId, status, reason) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.guestCheckout.findUnique({ where: { id: checkoutId } });
    if (!c) return;
    if (c.creditAppliedKobo > 0 && c.creditFromCode) {
      const source = await tx.guestCheckout.findUnique({ where: { code: c.creditFromCode }, select: { id: true } });
      if (source) {
        await tx.guestCheckout.update({ where: { id: source.id }, data: { creditKobo: { increment: c.creditAppliedKobo } } });
        await tx.guestCreditEvent.create({ data: { checkoutId: source.id, amountKobo: c.creditAppliedKobo, reason: 'released', orderId: c.code } });
      }
    }
    await tx.guestCheckout.update({ where: { id: checkoutId }, data: { status, failReason: reason, creditAppliedKobo: 0 } });
  });
}

/** The request createOrderForSession reads its Meta identity from, rebuilt from the checkout. */
function visitorRequest(checkout) {
  const headers = new Headers();
  if (checkout.ip) headers.set('x-forwarded-for', checkout.ip);
  if (checkout.ua) headers.set('user-agent', checkout.ua);
  const cookie = [checkout.fbp && `_fbp=${checkout.fbp}`, checkout.fbc && `_fbc=${checkout.fbc}`].filter(Boolean).join('; ');
  if (cookie) headers.set('cookie', cookie);
  headers.set('referer', `${getApplicationUrl()}/`);
  return new Request(`${getApplicationUrl()}/api/guest/pay`, { headers });
}

/**
 * Place a paid guest order. Idempotent: it claims the checkout first, so the
 * webhook, the verify redirect, the reconcile cron and the sweep can all call
 * it and only one order is ever placed.
 */
export async function placeGuestOrder(checkoutId) {
  const claimed = await prisma.guestCheckout.updateMany({ where: { id: checkoutId, status: 'AwaitingPayment' }, data: { status: 'Placing' } });
  if (claimed.count !== 1) return { placed: false, reason: 'not_claimable' };

  const checkout = await prisma.guestCheckout.findUnique({ where: { id: checkoutId }, include: { transaction: true, owner: { select: { id: true, email: true, name: true } } } });
  if (checkout.dueKobo > 0 && checkout.transaction?.status !== 'Completed') {
    await prisma.guestCheckout.update({ where: { id: checkoutId }, data: { status: 'AwaitingPayment' } });
    return { placed: false, reason: 'not_paid' };
  }

  // Credit taken from a code is not in any wallet yet. Put it in the owner's,
  // with its own row, so deposit + credit − order balances to nothing.
  if (checkout.creditAppliedKobo > 0) {
    await prisma.$transaction([
      prisma.$executeRaw`UPDATE users SET balance = balance + ${checkout.creditAppliedKobo} WHERE id = ${checkout.ownerUserId}`,
      prisma.transaction.create({ data: { userId: checkout.ownerUserId, type: 'guest_credit', amount: checkout.creditAppliedKobo, method: 'guest_credit', status: 'Completed', reference: `GCR-${checkout.code}`, note: `Credit from guest code ${checkout.creditFromCode} for ${checkout.code}` } }),
    ]);
  }

  const { createOrderForSession } = await import('../app/api/orders/route.js');
  let res;
  try {
    res = await createOrderForSession(
      { id: checkout.owner.id, email: checkout.owner.email, name: checkout.owner.name },
      { tierId: checkout.tierId, link: checkout.link, quantity: checkout.quantity, ...(checkout.comments ? { comments: checkout.comments } : {}) },
      visitorRequest(checkout),
      { source: 'guest', guest: { checkoutId: checkout.id, priceKobo: checkout.priceKobo, email: checkout.email } },
    );
  } catch (err) {
    log.error('Guest order', `${checkout.code}: ${err.message}`);
    res = Response.json({ error: 'Failed to place order' }, { status: 500 });
  }
  const data = await res.json().catch(() => ({}));

  if (res.ok && data?.order?.id) {
    const order = await prisma.order.findUnique({ where: { orderId: data.order.id }, select: { id: true } });
    await prisma.guestCheckout.update({ where: { id: checkoutId }, data: { status: 'Placed', orderId: order?.id ?? null, placedAt: new Date() } });
    if (checkout.email) await sendGuestReceipt(checkoutId);
    return { placed: true, orderId: data.order.id };
  }

  // Not placed. The money is in the owner's wallet: an existing account keeps
  // it there, but the guest account's wallet is shared, so it moves onto this
  // checkout's code as credit, where only this visitor can spend it.
  const heldKobo = checkout.dueKobo + checkout.creditAppliedKobo;
  const reason = String(data?.error || 'unknown').slice(0, 300);
  const guestId = await guestAccountId();
  if (checkout.ownerUserId === guestId && heldKobo > 0) {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.$executeRaw`UPDATE users SET balance = balance - ${heldKobo} WHERE id = ${guestId} AND balance >= ${heldKobo}`;
      if (moved !== 1) throw new Error(`guest wallet short of ${heldKobo} for ${checkout.code}`);
      await tx.transaction.create({ data: { userId: guestId, type: 'guest_credit', amount: -heldKobo, method: 'guest_credit', status: 'Completed', reference: `GCF-${checkout.code}`, note: `Guest order ${checkout.code} not placed (${reason.slice(0, 80)}); moved to its code as credit` } });
      await tx.guestCheckout.update({ where: { id: checkoutId }, data: { status: 'Failed', failReason: reason, creditKobo: { increment: heldKobo } } });
      await tx.guestCreditEvent.create({ data: { checkoutId, amountKobo: heldKobo, reason: 'placement_failed' } });
    });
  } else {
    await prisma.guestCheckout.update({ where: { id: checkoutId }, data: { status: 'Failed', failReason: reason } });
  }
  log.warn('Guest order', `${checkout.code} not placed: ${reason}`);
  return { placed: false, reason };
}

/**
 * Email the receipt for a placed guest order: to the email given at checkout,
 * or to `to` when the visitor asks for one afterwards. Never throws, because a
 * receipt that fails to send must not fail the order that was placed.
 */
export async function sendGuestReceipt(checkoutId, to = null) {
  try {
    const c = await prisma.guestCheckout.findUnique({
      where: { id: checkoutId },
      include: { order: { select: { orderId: true, quantity: true, serviceNameAtPurchase: true, tierNameAtPurchase: true } } },
    });
    const email = to || c?.email;
    if (!c?.order || !email) return { sent: false };
    const { guestReceiptEmail, sendEmail } = await import('./email.js');
    const html = guestReceiptEmail({
      code: c.code, orderId: c.order.orderId, service: c.order.serviceNameAtPurchase, tier: c.order.tierNameAtPurchase,
      quantity: c.order.quantity, link: c.link, paidKobo: c.dueKobo, creditKobo: c.creditAppliedKobo,
    });
    const result = await sendEmail(email, `Order ${c.order.orderId} placed`, html);
    return { sent: !!result?.success };
  } catch (err) {
    log.warn('Guest receipt', `${checkoutId}: ${err.message}`);
    return { sent: false };
  }
}

// ── Claim: a guest's order moves into an account ──
//
// Decided 16 Oct 2026: by the guest code, which only the buyer holds, and
// automatically only on Google sign-up, where Google has verified the email.
// Never by email alone, because email sign-up does not verify the address and
// anyone who knew a guest's email could otherwise take their orders and credit.

// Only settled checkouts move. One still being paid for stays on the guest
// account, where its payment is about to land.
const CLAIMABLE = ['Placed', 'Failed'];

/**
 * Move one checkout onto `userId`: its order, and any credit left on its code
 * into the account's wallet as a guest_credit row. Stamped first and
 * conditionally, so the same checkout can never be claimed twice, nor while a
 * refund is landing on it. Returns what moved, or null when nothing did.
 */
async function claimCheckout(checkoutId, userId) {
  return prisma.$transaction(async (tx) => {
    const guestId = await guestAccountId(tx);
    const c = await tx.guestCheckout.findUnique({ where: { id: checkoutId } });
    if (!c || !guestId || c.ownerUserId !== guestId || c.claimedByUserId || !CLAIMABLE.includes(c.status)) return null;
    const stamped = await tx.guestCheckout.updateMany({
      where: { id: c.id, ownerUserId: guestId, claimedByUserId: null, creditKobo: c.creditKobo },
      data: { ownerUserId: userId, claimedByUserId: userId, creditKobo: 0 },
    });
    if (stamped.count !== 1) return null;
    if (c.orderId) await tx.order.update({ where: { id: c.orderId }, data: { userId } });
    if (c.creditKobo > 0) {
      await tx.$executeRaw`UPDATE users SET balance = balance + ${c.creditKobo} WHERE id = ${userId}`;
      await tx.transaction.create({ data: { userId, type: 'guest_credit', amount: c.creditKobo, method: 'guest_credit', status: 'Completed', reference: `GCC-${c.code}`, note: `Credit from guest code ${c.code}, moved into this account` } });
      await tx.guestCreditEvent.create({ data: { checkoutId: c.id, amountKobo: -c.creditKobo, reason: 'claimed' } });
    }
    return { code: c.code, orderDbId: c.orderId, creditKobo: c.creditKobo };
  });
}

/** A signed-in customer adds a guest order to their account with its code. */
export async function claimGuestCode(userId, rawCode) {
  const code = normalizeGuestCode(rawCode);
  if (!code) return fail('That guest code is not right. Check it and try again.');
  const c = await prisma.guestCheckout.findUnique({ where: { code }, select: { id: true, ownerUserId: true, claimedByUserId: true, status: true } });
  if (!c) return fail('No order has that guest code. Check it and try again.', 404);
  if (c.claimedByUserId === userId || c.ownerUserId === userId) return fail('That order is already in your account.', 409);
  if (c.claimedByUserId) return fail('That order is already in another account.', 409);
  if (!CLAIMABLE.includes(c.status)) return fail('That order is still being paid for. Try again in a few minutes.', 409);
  const moved = await claimCheckout(c.id, userId);
  if (!moved) return fail('That order could not be moved. Try again.', 409);
  const order = moved.orderDbId ? await prisma.order.findUnique({ where: { id: moved.orderDbId }, select: { orderId: true } }) : null;
  return { ok: true, value: { code: moved.code, orderId: order?.orderId || null, creditKobo: moved.creditKobo } };
}

/**
 * On Google sign-up: every settled guest checkout bought with that (verified)
 * email moves into the new account. Never throws; sign-up must not fail on it.
 */
export async function claimGuestCheckoutsByEmail(userId, email) {
  const moved = [];
  try {
    const guestId = await guestAccountId();
    const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!guestId || !address) return moved;
    const found = await prisma.guestCheckout.findMany({
      where: { ownerUserId: guestId, email: address, claimedByUserId: null, status: { in: CLAIMABLE } },
      select: { id: true },
      take: 200,
    });
    for (const c of found) {
      const m = await claimCheckout(c.id, userId).catch((err) => { log.warn('Guest claim', `${c.id}: ${err.message}`); return null; });
      if (m) moved.push(m);
    }
  } catch (err) {
    log.warn('Guest claim', `by email for ${userId}: ${err.message}`);
  }
  return moved;
}

/** "adaeze@gmail.com" → "ad***@gmail.com": enough to recognise, not enough to read off a screen. */
export function maskEmail(email) {
  const at = typeof email === 'string' ? email.indexOf('@') : -1;
  if (at < 1) return null;
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

/**
 * A guest payment has just been credited (called from finalizeDeposit). A bank
 * transfer can land after the 30-minute hold expired the checkout; the money
 * is real, so the checkout is revived. Placement still checks the price, and a
 * price that moved, or credit the expiry gave back, turns the payment into
 * credit on the code rather than an order at the wrong price.
 */
export async function settleGuestPayment(checkoutId) {
  await prisma.guestCheckout.updateMany({ where: { id: checkoutId, status: 'Expired', transactionId: { not: null } }, data: { status: 'AwaitingPayment' } });
  return placeGuestOrder(checkoutId);
}

/**
 * The sweep, run by the payments cron: places any checkout whose payment has
 * landed but whose order has not (a crash between the two steps), and closes
 * quotes nobody paid for, giving their reserved credit back.
 */
export async function sweepGuestCheckouts(now = new Date()) {
  const stats = { placed: 0, expired: 0 };
  const paid = await prisma.guestCheckout.findMany({
    where: { status: 'AwaitingPayment', transaction: { status: 'Completed' } },
    select: { id: true },
    take: 50,
  });
  for (const c of paid) if ((await placeGuestOrder(c.id)).placed) stats.placed++;

  const stale = await prisma.guestCheckout.findMany({
    where: { status: { in: ['Quoted', 'AwaitingPayment'] }, expiresAt: { lt: now }, OR: [{ transactionId: null }, { transaction: { status: { notIn: ['Completed', 'Pending', 'Processing'] } } }] },
    select: { id: true },
    take: 200,
  });
  for (const c of stale) { await releaseCheckout(c.id, 'Expired', 'not_paid'); stats.expired++; }
  return stats;
}

/**
 * Whether guest checkout answers at all. Off until `guest_checkout_enabled` is
 * "true" (docs/SHELF.md), except to a signed-in admin, so staff can test real
 * payments on the live site while customers still see nothing. Always on in
 * local development, so it can be built and tried without flipping the real
 * setting, which local dev would flip on production too.
 */
export async function guestCheckoutOpen() {
  if (process.env.NODE_ENV !== 'production') return true;
  if (await guestCheckoutLive()) return true;
  return signedInAdmin();
}

/** The setting alone: on for everyone. */
export async function guestCheckoutLive() {
  const setting = await prisma.setting.findUnique({ where: { key: 'guest_checkout_enabled' } });
  return setting?.value === 'true';
}

/**
 * A signed-in, active admin on this request. Reads the admin cookie, so it
 * costs nothing for a visitor without one. Never clears a cookie and never
 * throws: a failed check is "no".
 */
export async function signedInAdmin() {
  try {
    const { getCurrentAdmin } = await import('./auth.js');
    return !!(await getCurrentAdmin({ clearInvalidCookie: false }));
  } catch {
    return false;
  }
}

/**
 * The rate limit on looking up a code, one budget per IP shared by the track
 * route and the order page, so a guesser cannot spend one and then the other.
 * Sized for an order page checking on a payment, and for Nigerian mobile
 * networks putting many customers behind one address. The code space is the
 * real guard; this only makes walking it slower.
 */
export function guestLookupLimit(headers) {
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip')?.trim() || 'unknown';
  return { key: `rl:${ip}:guest-lookup`, maxAttempts: 60, windowMs: 10 * 60 * 1000 };
}

/**
 * What the order page and the track pop-up show for a code: enough to follow
 * the order and spend its credit, nothing about the account it sits on beyond
 * where a refund goes.
 */
export async function guestOrderView(code) {
  const checkout = await prisma.guestCheckout.findUnique({
    where: { code },
    include: {
      order: { select: { orderId: true, status: true, quantity: true, remains: true, completedAt: true, updatedAt: true, createdAt: true, refillRequestedAt: true, tierNameAtPurchase: true, serviceNameAtPurchase: true, platformAtPurchase: true } },
      transaction: { select: { status: true, gatewayUrl: true } },
    },
  });
  if (!checkout) return null;
  const { canRequestRefill } = await import('./refill-promise.js');
  const order = checkout.order;
  let service = order?.serviceNameAtPurchase || null;
  let tier = order?.tierNameAtPurchase || null;
  let platform = order?.platformAtPurchase || null;
  if (!order && checkout.tierId) {
    const t = await prisma.serviceTier.findUnique({ where: { id: checkout.tierId }, select: { tier: true, group: { select: { name: true, platform: true } } } });
    service = t?.group?.name || null; tier = t?.tier || null; platform = t?.group?.platform || null;
  }
  const guestId = await guestAccountId();
  const delivered = !order ? 0
    : order.status === 'Completed' ? order.quantity
      : order.remains != null ? Math.max(0, order.quantity - order.remains) : 0;
  return {
    code: checkout.code,
    // The checkout's own stage until there is an order, then the order's status.
    stage: order ? order.status : checkout.status,
    orderId: order?.orderId || null,
    service, tier, platform,
    quantity: checkout.quantity,
    delivered,
    link: checkout.link,
    priceKobo: checkout.priceKobo,
    // What is paid in money; the rest, if any, came off a code's credit.
    dueKobo: checkout.dueKobo,
    // Back to the Flutterwave page for anyone who closed it before paying.
    payUrl: checkout.status === 'AwaitingPayment' && checkout.transaction?.status === 'Pending' ? checkout.transaction.gatewayUrl || null : null,
    creditKobo: checkout.creditKobo,
    // A refund on the guest account becomes credit on the code; one on an
    // existing account goes to its wallet like any other order's.
    refundsTo: checkout.ownerUserId === guestId ? 'code' : 'wallet',
    // Where the receipt went, masked, so the card can say so without
    // showing anyone with the code the whole address.
    receiptTo: checkout.email ? maskEmail(checkout.email) : null,
    // Still on the guest account and settled: a signed-in customer can move it.
    claimable: checkout.ownerUserId === guestId && !checkout.claimedByUserId && CLAIMABLE.includes(checkout.status),
    placedAt: (checkout.placedAt || order?.createdAt)?.toISOString() || null,
    completedAt: order?.completedAt?.toISOString() || null,
    canRefill: order ? canRequestRefill({ status: order.status, completedAt: order.completedAt || order.updatedAt, tierName: tier }) : false,
    refillRequested: !!order?.refillRequestedAt,
  };
}
