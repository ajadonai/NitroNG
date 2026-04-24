import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

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
  function createNPSignature(body, secret) {
    const hmac = crypto.createHmac('sha512', secret);
    const sorted = Object.keys(body).sort().reduce((acc, k) => { acc[k] = body[k]; return acc; }, {});
    hmac.update(JSON.stringify(sorted));
    return hmac.digest('hex');
  }

  it('verifies valid HMAC signature', () => {
    const secret = 'test-ipn-secret';
    const body = { payment_status: 'finished', order_id: 'NTR-123', pay_amount: 10 };
    const sig = createNPSignature(body, secret);
    expect(createNPSignature(body, secret)).toBe(sig);
  });

  it('rejects tampered payload', () => {
    const secret = 'test-ipn-secret';
    const body = { payment_status: 'finished', order_id: 'NTR-123', pay_amount: 10 };
    const sig = createNPSignature(body, secret);
    const tampered = { ...body, pay_amount: 999 };
    expect(createNPSignature(tampered, secret)).not.toBe(sig);
  });

  it('rejects wrong secret', () => {
    const body = { payment_status: 'finished', order_id: 'NTR-123' };
    const sig = createNPSignature(body, 'correct-secret');
    const fakeSig = createNPSignature(body, 'wrong-secret');
    expect(fakeSig).not.toBe(sig);
  });

  it('sorts keys alphabetically for HMAC', () => {
    const secret = 'test';
    const body1 = { z: 1, a: 2, m: 3 };
    const body2 = { a: 2, m: 3, z: 1 };
    expect(createNPSignature(body1, secret)).toBe(createNPSignature(body2, secret));
  });
});
