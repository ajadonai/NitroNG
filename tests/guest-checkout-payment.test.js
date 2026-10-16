import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The money path of guest checkout (docs/v2/guest_checkout_brief.md): a guest
 * deposit earns nothing and moves no counters, and a paid checkout places at
 * most one order, turning the payment into credit on its code when it cannot.
 */

const GUEST = 'guest-account';
const db = vi.hoisted(() => ({
  guestCheckout: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  guestCreditEvent: { create: vi.fn() },
  user: { findUnique: vi.fn() },
  setting: { findUnique: vi.fn() },
  order: { findUnique: vi.fn(), update: vi.fn() },
  transaction: { create: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
const createOrderForSession = vi.hoisted(() => vi.fn());

vi.mock('../lib/prisma.js', () => ({ default: db }));
vi.mock('../lib/logger.js', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../app/api/orders/route.js', () => ({ createOrderForSession }));
const getFlutterwaveSecretKey = vi.hoisted(() => vi.fn());
vi.mock('../lib/flutterwave-payment.js', () => ({ getFlutterwaveSecretKey }));
vi.mock('../lib/env.js', () => ({ getApplicationUrl: () => 'https://nitro.ng' }));
const sendEmail = vi.hoisted(() => vi.fn(async () => ({ success: true })));
const getCurrentAdmin = vi.hoisted(() => vi.fn());
vi.mock('../lib/auth.js', () => ({ getCurrentAdmin }));
vi.mock('../lib/email.js', () => ({ sendEmail, guestReceiptEmail: vi.fn(() => '<html>receipt</html>') }));

const { placeGuestOrder, startGuestPayment, maskEmail, guestCheckoutOpen, claimGuestCode, claimGuestCheckoutsByEmail } = await import('../lib/guest-checkout.js');

const paidCheckout = (over = {}) => ({
  id: 'gc-1', code: 'G7K2-9XQM', status: 'Placing', ownerUserId: GUEST, email: null,
  tierId: 'tier-1', link: 'https://instagram.com/ada', quantity: 500, comments: null,
  priceKobo: 10_000_00, dueKobo: 10_000_00, creditAppliedKobo: 0, creditFromCode: null,
  ip: '1.2.3.4', ua: 'phone', fbp: null, fbc: null,
  transaction: { status: 'Completed' },
  owner: { id: GUEST, email: 'nitrongguest@gmail.com', name: 'Nitro Guest' },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ id: GUEST });
  db.$transaction.mockImplementation(async (arg) => (typeof arg === 'function' ? arg(db) : Promise.all(arg)));
  db.$executeRaw.mockResolvedValue(1);
});

describe('placeGuestOrder', () => {
  it('places nothing when another caller already claimed the checkout', async () => {
    db.guestCheckout.updateMany.mockResolvedValue({ count: 0 });
    expect(await placeGuestOrder('gc-1')).toEqual({ placed: false, reason: 'not_claimable' });
    expect(createOrderForSession).not.toHaveBeenCalled();
  });

  it('waits for the payment before placing', async () => {
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });
    db.guestCheckout.findUnique.mockResolvedValue(paidCheckout({ transaction: { status: 'Pending' } }));
    expect(await placeGuestOrder('gc-1')).toEqual({ placed: false, reason: 'not_paid' });
    expect(db.guestCheckout.update).toHaveBeenCalledWith({ where: { id: 'gc-1' }, data: { status: 'AwaitingPayment' } });
    expect(createOrderForSession).not.toHaveBeenCalled();
  });

  it('places the order at the held price on the owning account, as a guest order', async () => {
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });
    db.guestCheckout.findUnique.mockResolvedValue(paidCheckout());
    createOrderForSession.mockResolvedValue(Response.json({ success: true, order: { id: 'NTR-15978' } }));
    db.order.findUnique.mockResolvedValue({ id: 'order-db-1' });

    expect(await placeGuestOrder('gc-1')).toEqual({ placed: true, orderId: 'NTR-15978' });
    const [session, body, , options] = createOrderForSession.mock.calls[0];
    expect(session.id).toBe(GUEST);
    expect(body).toEqual({ tierId: 'tier-1', link: 'https://instagram.com/ada', quantity: 500 });
    expect(options).toEqual({ source: 'guest', guest: { checkoutId: 'gc-1', priceKobo: 10_000_00, email: null } });
    expect(db.guestCheckout.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'Placed', orderId: 'order-db-1' }) }));
  });

  it('turns a refused order on the guest account into credit on its code', async () => {
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });
    db.guestCheckout.findUnique.mockResolvedValue(paidCheckout());
    createOrderForSession.mockResolvedValue(Response.json({ error: 'The price changed before the order could be placed', guestPriceChanged: true }, { status: 409 }));

    expect((await placeGuestOrder('gc-1')).placed).toBe(false);
    // Out of the shared wallet, conditionally, and onto this code.
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.guestCheckout.update).toHaveBeenCalledWith({ where: { id: 'gc-1' }, data: expect.objectContaining({ status: 'Failed', creditKobo: { increment: 10_000_00 } }) });
    expect(db.guestCreditEvent.create).toHaveBeenCalledWith({ data: { checkoutId: 'gc-1', amountKobo: 10_000_00, reason: 'placement_failed' } });
  });

  it('leaves a refused order’s money in an existing account’s own wallet', async () => {
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });
    db.guestCheckout.findUnique.mockResolvedValue(paidCheckout({ ownerUserId: 'customer-1', owner: { id: 'customer-1', email: 'ada@x.ng', name: 'Ada' } }));
    createOrderForSession.mockResolvedValue(Response.json({ error: 'Service not available' }, { status: 400 }));

    await placeGuestOrder('gc-1');
    expect(db.$executeRaw).not.toHaveBeenCalled();
    expect(db.guestCreditEvent.create).not.toHaveBeenCalled();
    expect(db.guestCheckout.update).toHaveBeenCalledWith({ where: { id: 'gc-1' }, data: { status: 'Failed', failReason: 'Service not available' } });
  });
});

describe('startGuestPayment', () => {
  it('refuses before claiming the checkout when payments are not set up, so Pay can be pressed again', async () => {
    db.guestCheckout.findUnique.mockResolvedValue({ id: 'gc-1', code: 'G7K2-9XQM', status: 'Quoted', priceKobo: 10_000_00, expiresAt: new Date(Date.now() + 60_000), transaction: null });
    getFlutterwaveSecretKey.mockResolvedValue('');
    expect(await startGuestPayment({ checkoutId: 'gc-1', currency: 'NGN' })).toEqual({ ok: false, error: 'Payments are not available right now', status: 503 });
    expect(db.guestCheckout.updateMany).not.toHaveBeenCalled();
    expect(db.transaction.create).not.toHaveBeenCalled();
  });
});

describe('the receipt', () => {
  it('is emailed to the address given at checkout once the order is placed', async () => {
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });
    db.guestCheckout.findUnique
      .mockResolvedValueOnce(paidCheckout({ email: 'ada@x.ng' }))
      .mockResolvedValueOnce({ ...paidCheckout({ email: 'ada@x.ng' }), order: { orderId: 'NTR-15978', quantity: 500, serviceNameAtPurchase: 'Instagram Followers', tierNameAtPurchase: 'Standard' } });
    createOrderForSession.mockResolvedValue(Response.json({ success: true, order: { id: 'NTR-15978' } }));
    db.order.findUnique.mockResolvedValue({ id: 'order-db-1' });

    expect((await placeGuestOrder('gc-1')).placed).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith('ada@x.ng', 'Order NTR-15978 placed', '<html>receipt</html>');
  });

  it('is not sent when no email was given', async () => {
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });
    db.guestCheckout.findUnique.mockResolvedValue(paidCheckout());
    createOrderForSession.mockResolvedValue(Response.json({ success: true, order: { id: 'NTR-15978' } }));
    db.order.findUnique.mockResolvedValue({ id: 'order-db-1' });

    await placeGuestOrder('gc-1');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('names where it went without showing the whole address', () => {
    expect(maskEmail('adaeze@gmail.com')).toBe('ad***@gmail.com');
    expect(maskEmail('a@b.ng')).toBe('a***@b.ng');
    expect(maskEmail('nope')).toBeNull();
  });
});

describe('who guest checkout is open to on the live site', () => {
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'production'); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('is open to everyone once the setting is on', async () => {
    db.setting.findUnique.mockResolvedValue({ value: 'true' });
    expect(await guestCheckoutOpen()).toBe(true);
  });

  it('is open to a signed-in admin while the setting is off, so staff can test it', async () => {
    db.setting.findUnique.mockResolvedValue({ value: 'false' });
    getCurrentAdmin.mockResolvedValue({ id: 'admin-1' });
    expect(await guestCheckoutOpen()).toBe(true);
  });

  it('is closed to everyone else while the setting is off', async () => {
    db.setting.findUnique.mockResolvedValue(null);
    getCurrentAdmin.mockResolvedValue(null);
    expect(await guestCheckoutOpen()).toBe(false);
  });

  it('is closed when the admin check itself fails', async () => {
    db.setting.findUnique.mockResolvedValue(null);
    getCurrentAdmin.mockRejectedValue(new Error('no request scope'));
    expect(await guestCheckoutOpen()).toBe(false);
  });
});

describe('moving a guest order into an account', () => {
  const settled = (over = {}) => ({ id: 'gc-1', code: 'G7K2-9XQM', ownerUserId: GUEST, claimedByUserId: null, status: 'Placed', orderId: 'order-db-1', creditKobo: 3800_00, ...over });

  it('moves the order and the credit on its code into the account, with the code as proof', async () => {
    db.guestCheckout.findUnique.mockResolvedValueOnce(settled()).mockResolvedValueOnce(settled());
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });
    db.order.findUnique.mockResolvedValue({ orderId: 'NTR-15978' });

    const result = await claimGuestCode('user-9', 'g7k29xqm');
    expect(result).toEqual({ ok: true, value: { code: 'G7K2-9XQM', orderId: 'NTR-15978', creditKobo: 3800_00 } });
    expect(db.guestCheckout.updateMany).toHaveBeenCalledWith({
      where: { id: 'gc-1', ownerUserId: GUEST, claimedByUserId: null, creditKobo: 3800_00 },
      data: { ownerUserId: 'user-9', claimedByUserId: 'user-9', creditKobo: 0 },
    });
    expect(db.order.update).toHaveBeenCalledWith({ where: { id: 'order-db-1' }, data: { userId: 'user-9' } });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.transaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user-9', type: 'guest_credit', amount: 3800_00, reference: 'GCC-G7K2-9XQM' }) });
    expect(db.guestCreditEvent.create).toHaveBeenCalledWith({ data: { checkoutId: 'gc-1', amountKobo: -3800_00, reason: 'claimed' } });
  });

  it('refuses a code already in someone else\'s account', async () => {
    db.guestCheckout.findUnique.mockResolvedValue(settled({ ownerUserId: 'user-2', claimedByUserId: 'user-2' }));
    expect(await claimGuestCode('user-9', 'G7K2-9XQM')).toMatchObject({ ok: false, status: 409 });
    expect(db.order.update).not.toHaveBeenCalled();
  });

  it('leaves one that is still being paid for, since its payment lands on the guest account', async () => {
    db.guestCheckout.findUnique.mockResolvedValue(settled({ status: 'AwaitingPayment' }));
    expect(await claimGuestCode('user-9', 'G7K2-9XQM')).toMatchObject({ ok: false, status: 409 });
    expect(db.guestCheckout.updateMany).not.toHaveBeenCalled();
  });

  it('moves nothing when another claim got there first', async () => {
    db.guestCheckout.findUnique.mockResolvedValueOnce(settled()).mockResolvedValueOnce(settled());
    db.guestCheckout.updateMany.mockResolvedValue({ count: 0 });
    expect((await claimGuestCode('user-9', 'G7K2-9XQM')).ok).toBe(false);
    expect(db.order.update).not.toHaveBeenCalled();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it('on Google sign-up, moves every settled checkout bought with that email', async () => {
    db.guestCheckout.findMany.mockResolvedValue([{ id: 'gc-1' }, { id: 'gc-2' }]);
    db.guestCheckout.findUnique.mockImplementation(async ({ where }) => settled({ id: where.id, code: where.id === 'gc-1' ? 'AAAA-BBBB' : 'CCCC-DDDD', orderId: `order-${where.id}`, creditKobo: 0 }));
    db.guestCheckout.updateMany.mockResolvedValue({ count: 1 });

    const moved = await claimGuestCheckoutsByEmail('user-9', ' Ada@X.ng ');
    expect(moved.map(m => m.code)).toEqual(['AAAA-BBBB', 'CCCC-DDDD']);
    expect(db.guestCheckout.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email: 'ada@x.ng', ownerUserId: GUEST, claimedByUserId: null }) }));
    expect(db.order.update).toHaveBeenCalledTimes(2);
  });
});
