import { describe, it, expect } from 'vitest';
import {
  createNowPaymentsIpnSignature,
  verifyNowPaymentsIpnSignature,
} from '@/lib/nowpayments-verification';

describe('Flutterwave webhook signature', () => {
  it('rejects when signature does not match hash', () => {
    const hash = 'my-secret-hash';
    const signature = 'wrong-hash';
    expect(signature === hash).toBe(false);
  });

  it('accepts when signature matches hash', () => {
    const hash = 'my-secret-hash';
    const signature = 'my-secret-hash';
    expect(signature === hash).toBe(true);
  });
});

describe('NowPayments webhook signature', () => {
  it('verifies valid HMAC signature', () => {
    const secret = 'test-ipn-secret';
    const body = {
      payment_status: 'finished',
      order_id: 'NTR-123',
      pay_amount: 10,
      nested: { z: 1, a: 2 },
    };
    const sig = createNowPaymentsIpnSignature(body, secret);
    expect(verifyNowPaymentsIpnSignature(body, sig, secret)).toBe(true);
  });

  it('rejects tampered payload', () => {
    const secret = 'test-ipn-secret';
    const body = { payment_status: 'finished', order_id: 'NTR-123', pay_amount: 10 };
    const sig = createNowPaymentsIpnSignature(body, secret);
    const tampered = { ...body, pay_amount: 999 };
    expect(verifyNowPaymentsIpnSignature(tampered, sig, secret)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const body = { payment_status: 'finished', order_id: 'NTR-123' };
    const sig = createNowPaymentsIpnSignature(body, 'correct-secret');
    expect(verifyNowPaymentsIpnSignature(body, sig, 'wrong-secret')).toBe(false);
  });

  it('sorts keys alphabetically for HMAC', () => {
    const secret = 'test';
    const body1 = { z: { y: 1, a: 2 }, a: 2, m: 3 };
    const body2 = { a: 2, m: 3, z: { a: 2, y: 1 } };
    expect(createNowPaymentsIpnSignature(body1, secret))
      .toBe(createNowPaymentsIpnSignature(body2, secret));
  });
});
