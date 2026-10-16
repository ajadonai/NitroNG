import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { creditOrderRefund } from '../lib/order-refund-credit.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const GUEST = 'guest-account-id';
let tx;
beforeEach(() => {
  tx = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: GUEST }) },
    guestCheckout: { findUnique: vi.fn(), update: vi.fn() },
    guestCreditEvent: { create: vi.fn() },
    transaction: { create: vi.fn(async ({ data }) => ({ id: 'tx-1', ...data })) },
    $executeRaw: vi.fn(),
  };
});
const row = userId => ({ userId, type: 'refund', amount: 3800_00, method: 'wallet', status: 'Completed', reference: 'REF-NTR-1', note: 'Partial refund for NTR-1' });

describe('creditOrderRefund', () => {
  it('pays an ordinary order into its wallet, with the row exactly as written', async () => {
    await creditOrderRefund(tx, 'order-1', { data: row('customer-1') });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.guestCheckout.update).not.toHaveBeenCalled();
    expect(tx.transaction.create).toHaveBeenCalledWith({ data: row('customer-1') });
  });

  it('puts a guest-account order’s refund on its guest code, never the shared wallet', async () => {
    tx.guestCheckout.findUnique.mockResolvedValue({ id: 'checkout-1' });
    await creditOrderRefund(tx, 'order-1', { data: row(GUEST) });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.guestCheckout.update).toHaveBeenCalledWith({ where: { id: 'checkout-1' }, data: { creditKobo: { increment: 3800_00 } } });
    expect(tx.guestCreditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ checkoutId: 'checkout-1', amountKobo: 3800_00 }) });
    // The row is still written, so getTotalRefundedKobo blocks a second refund.
    expect(tx.transaction.create).toHaveBeenCalledWith({ data: { ...row(GUEST), method: 'guest_credit' } });
  });

  it('does nothing for a zero refund', async () => {
    expect(await creditOrderRefund(tx, 'order-1', { data: { ...row('customer-1'), amount: 0 } })).toBeNull();
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('is the only way a refund reaches a wallet from the sessionless paths', () => {
    // These run without the customer's own session (cron, admin, drip, a
    // provider rejecting at placement), so they can meet a guest order. A raw
    // balance credit here would pour a guest refund into the shared wallet.
    const sessionless = [
      'app/api/cron/orders/route.js',
      'app/api/admin/orders/route.js',
      'app/api/admin/sync/route.js',
      'lib/drip-completion.js',
    ];
    for (const file of sessionless) {
      expect(source(file), file).not.toMatch(/UPDATE users SET balance = balance \+/);
      expect(source(file), file).not.toMatch(/balance: \{ increment: walletRefund/);
      expect(source(file), file).toContain('creditOrderRefund(tx,');
    }
    // In the order route, the one sessionless path is a provider rejecting the
    // order at placement.
    const orders = source('app/api/orders/route.js');
    const rejected = orders.slice(orders.indexOf('async function refundRejectedCreatedOrder'), orders.indexOf('async function nextOrderId'));
    expect(rejected).toContain('creditOrderRefund(tx, orderDbId');
    expect(rejected).not.toMatch(/UPDATE users SET balance = balance \+/);
  });
});
