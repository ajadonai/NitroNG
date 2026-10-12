import { describe, expect, it } from 'vitest';
import crypto from 'crypto';
import {
  classifyCryptomusStatusResponse,
  cryptomusSign,
  cryptomusEmptySign,
  verifyCryptomusWebhook,
  classifyCryptomusStatus,
  CRYPTOMUS_STATUS_MAP,
} from '@/lib/cryptomus-verification';

const KEY = 'test-api-key';

/**
 * The webhook endpoint credits wallets, and the only thing standing between the
 * open internet and that crediting path is this signature. Cryptomus issues no
 * separate IPN secret the way NOWPayments did, so the payment API key is the
 * whole of the security model.
 */
describe('cryptomusSign', () => {
  it('matches the documented formula exactly', () => {
    const body = JSON.stringify({ amount: '5000', currency: 'NGN' });
    const expected = crypto.createHash('md5')
      .update(Buffer.from(body).toString('base64') + KEY)
      .digest('hex');
    expect(cryptomusSign(body, KEY)).toBe(expected);
  });

  // Signing a re-serialised object rather than the transmitted string is the
  // classic failure: key order or spacing shifts, the hash shifts with it, and
  // every request is rejected with nothing explaining why.
  it('signs the exact string given, not a re-serialisation of it', () => {
    const a = '{"b":1,"a":2}';
    const b = '{"a":2,"b":1}';
    expect(cryptomusSign(a, KEY)).not.toBe(cryptomusSign(b, KEY));
  });

  it('signs an empty body, which parameterless endpoints need', () => {
    expect(cryptomusEmptySign(KEY)).toBe(cryptomusSign('{}', KEY));
    expect(cryptomusEmptySign(KEY)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('refuses to sign without a key rather than producing a hash of nothing', () => {
    expect(() => cryptomusSign('{}', '')).toThrow(/API key/);
    expect(() => cryptomusSign({ not: 'a string' }, KEY)).toThrow(/body string/);
  });
});

describe('verifyCryptomusWebhook', () => {
  function signed(payload) {
    return { ...payload, sign: cryptomusSign(JSON.stringify(payload), KEY) };
  }

  it('accepts a correctly signed payload', () => {
    expect(verifyCryptomusWebhook(signed({ uuid: 'u1', order_id: 'NTR-1', status: 'paid' }), KEY)).toBe(true);
  });

  it('rejects a payload whose body was altered after signing', () => {
    const payload = signed({ uuid: 'u1', order_id: 'NTR-1', status: 'wrong_amount' });
    payload.status = 'paid'; // the exact forgery that would credit a wallet
    expect(verifyCryptomusWebhook(payload, KEY)).toBe(false);
  });

  it('rejects a forged or absent signature', () => {
    expect(verifyCryptomusWebhook({ uuid: 'u1', sign: 'f'.repeat(32) }, KEY)).toBe(false);
    expect(verifyCryptomusWebhook({ uuid: 'u1' }, KEY)).toBe(false);
    expect(verifyCryptomusWebhook({ uuid: 'u1', sign: '' }, KEY)).toBe(false);
  });

  it('rejects everything when no key is configured, rather than passing', () => {
    const payload = signed({ uuid: 'u1', status: 'paid' });
    expect(verifyCryptomusWebhook(payload, '')).toBe(false);
    expect(verifyCryptomusWebhook(payload, undefined)).toBe(false);
  });

  it('survives junk input without throwing', () => {
    for (const junk of [null, undefined, 'string', 42, []]) {
      expect(verifyCryptomusWebhook(junk, KEY), String(junk)).toBe(false);
    }
  });

  // The sign travels inside the object it signs, so it must be removed before
  // the hash is recomputed or verification can never succeed.
  it('excludes the sign field itself from the recomputed hash', () => {
    const payload = { uuid: 'u1', status: 'paid' };
    const withSign = signed(payload);
    expect(cryptomusSign(JSON.stringify(payload), KEY)).toBe(withSign.sign);
  });
});

describe('status mapping', () => {
  it('credits only an exact payment', () => {
    expect(classifyCryptomusStatus('paid').state).toBe('credited');
  });

  // Both of these were review cases under NOWPayments and stay review cases
  // here. Auto-crediting an overpayment gives away money; auto-crediting an
  // underpayment gives away service.
  it('sends over and underpayment to review, never straight to credited', () => {
    expect(classifyCryptomusStatus('paid_over')).toMatchObject({ state: 'review', reason: 'overpayment' });
    expect(classifyCryptomusStatus('wrong_amount')).toMatchObject({ state: 'review', reason: 'underpayment' });
  });

  it('treats in-flight statuses as pending', () => {
    for (const s of ['process', 'check', 'confirm_check']) {
      expect(classifyCryptomusStatus(s), s).toMatchObject({ state: 'provider_pending', terminal: false });
    }
  });

  it('treats the failure statuses as failed', () => {
    for (const s of ['cancel', 'fail', 'system_fail']) {
      expect(classifyCryptomusStatus(s), s).toMatchObject({ state: 'failed', terminal: true });
    }
  });

  it('holds an AML lock in review, since the money is neither lost nor available', () => {
    expect(classifyCryptomusStatus('locked')).toMatchObject({ state: 'review', reason: 'locked' });
  });

  // Refunds are their own state, not review. Whether a refund needs manual
  // recovery depends on if the wallet was already credited, and the
  // orchestration makes that call; collapsing them into review would decide it
  // here, wrongly, for the uncredited case.
  it('keeps refunds in their own state rather than folding them into review', () => {
    for (const s of ['refund_process', 'refund_paid', 'refund_fail']) {
      expect(classifyCryptomusStatus(s), s).toMatchObject({ state: 'refunded' });
    }
  });

  // Asymmetric cost: a payment wrongly held is recovered by the reconciliation
  // cron, a payment wrongly failed tells a customer their money is gone while
  // it is still on the chain.
  it('treats an unknown status as pending rather than failed', () => {
    const out = classifyCryptomusStatus('some_status_cryptomus_added_later');
    expect(out).toMatchObject({ state: 'provider_pending', terminal: false, known: false });
  });

  it('is case insensitive and survives junk', () => {
    expect(classifyCryptomusStatus('PAID').state).toBe('credited');
    expect(classifyCryptomusStatus(null).state).toBe('provider_pending');
  });

  it('never maps anything to a state the codebase does not have', () => {
    const valid = new Set(['credited', 'verifying', 'provider_pending', 'retryable', 'review', 'failed', 'refunded']);
    for (const [status, entry] of Object.entries(CRYPTOMUS_STATUS_MAP)) {
      expect(valid.has(entry.state), `${status} -> ${entry.state}`).toBe(true);
    }
  });
});

/**
 * Cryptomus calls any overpayment `paid_over`, down to a cent, and its
 * merchant-side accuracy setting only forgives underpayment. Routing all of
 * those to manual approval is what made crypto deposits stop being instant.
 */
describe('dust overpayment credits itself', () => {
  const REFERENCE = 'NTR-CRYPTO-OVER-1';
  function read(overrides = {}) {
    return classifyCryptomusStatusResponse({
      uuid: '940c4d31-70fb-4bf3-856b-5eb12a490af4',
      order_id: REFERENCE,
      status: 'paid_over',
      amount: '17.31',
      currency: 'usd',
      payer_currency: 'usdttrc20',
      payer_amount: '17.31',
      payment_amount: '17.31',
      ...overrides,
    }, { reference: REFERENCE, expectedAmount: '17.31', expectedCurrency: 'usd' });
  }

  it('credits a customer who rounded $17.31 up to $18', () => {
    expect(read({ payment_amount: '18' })).toMatchObject({
      state: 'verified',
      reason: 'provider_verified_overpaid_dust',
    });
  });

  it('credits a few cents over', () => {
    expect(read({ payment_amount: '17.35' }).state).toBe('verified');
  });

  it('credits a payment landing exactly at the 5% ceiling', () => {
    // 17.31 × 1.05 = 18.1755 exactly, so the boundary itself must pass.
    expect(read({ payment_amount: '18.1755' }).state).toBe('verified');
  });

  it('still sends a large overpayment to a person', () => {
    // Someone who sent double wants it back, not wallet credit.
    expect(read({ payment_amount: '34.62' })).toMatchObject({
      state: 'review',
      reason: 'overpayment',
    });
    expect(read({ payment_amount: '18.1756' }).state).toBe('review');
  });

  // This is the trap the implementation originally fell into: the decimal
  // helpers return null for input they cannot parse, and `null <= 0` is true in
  // JavaScript, so a loose comparison turns "unreadable amount" into "credit
  // it". Each of these must reach a human instead.
  it('reviews rather than credits when either amount is missing or unreadable', () => {
    for (const bad of [null, undefined, '', 'abc', '-1', {}, []]) {
      expect(read({ payment_amount: bad }).state, `payment_amount=${JSON.stringify(bad)}`).toBe('review');
      expect(read({ payer_amount: bad }).state, `payer_amount=${JSON.stringify(bad)}`).toBe('review');
    }
  });

  it('reviews when the requested amount is zero, which no ratio can judge', () => {
    expect(read({ payer_amount: '0', payment_amount: '5' }).state).toBe('review');
  });

  // The tolerance is for the over side only. Underpayment beyond whatever
  // Cryptomus was told to forgive is a real shortfall and stays manual.
  it('does not forgive underpayment', () => {
    expect(read({ status: 'wrong_amount', payment_amount: '17.30' })).toMatchObject({
      state: 'review',
      reason: 'underpayment',
    });
  });

  it('leaves an exact payment on the ordinary credited path', () => {
    expect(read({ status: 'paid' })).toMatchObject({
      state: 'verified',
      reason: 'provider_verified',
    });
  });
});
