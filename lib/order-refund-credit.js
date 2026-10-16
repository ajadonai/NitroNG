import { guestAccountId } from './guest-account.js';

/**
 * Pay a refund on an order to wherever its money belongs, and write its
 * `refund` row. Called in place of the old pair — a raw `balance + n` on the
 * user, then `tx.transaction.create` — at every order-refund site that can run
 * without the customer's own session: the order sync cron, admin refunds and
 * sync, drip completion, and a provider rejecting an order at placement.
 * (The sites that run on a customer's own session — cancel, bulk cancel, the
 * status check — act on that customer's own orders, and nobody can sign in to
 * the guest account, so they never reach a guest order.)
 *
 * Almost always the money goes to the customer's wallet, exactly as before.
 * The one exception is an order on the shared guest account: that wallet is
 * shared by every email-less guest, so the refund goes onto the order's guest
 * code as credit instead (docs/v2/guest_checkout_brief.md).
 *
 * `data` is the refund row exactly as each site already wrote it, so every
 * reference and note stays as it was. Only `method` changes for a guest
 * refund, to 'guest_credit'. The row is written either way, so
 * `getTotalRefundedKobo` still sees it and an order cannot be refunded twice.
 *
 * Call inside the caller's transaction.
 */
export async function creditOrderRefund(tx, orderDbId, { data }) {
  const amountKobo = data.amount;
  if (!(amountKobo > 0)) return null;

  const guestId = await guestAccountId(tx);
  const checkout = guestId && data.userId === guestId
    ? await tx.guestCheckout.findUnique({ where: { orderId: orderDbId }, select: { id: true } })
    : null;

  if (checkout) {
    await tx.guestCheckout.update({ where: { id: checkout.id }, data: { creditKobo: { increment: amountKobo } } });
    await tx.guestCreditEvent.create({ data: { checkoutId: checkout.id, amountKobo, reason: 'refund', orderId: data.reference } });
  } else {
    await tx.$executeRaw`UPDATE users SET balance = balance + ${amountKobo} WHERE id = ${data.userId}`;
  }

  return tx.transaction.create({ data: { ...data, method: checkout ? 'guest_credit' : data.method } });
}
