import { describe, expect, it } from 'vitest';

const {
  PAYMENT_STATUS_STORAGE_KEY,
  PAYMENT_STATUS_STORAGE_TTL_MS,
  persistPaymentStatus,
  readStoredPaymentStatus,
} = await import('@/components/dashboard');
const {
  paymentNoticeFromResult,
  paymentNoticeFromTransaction,
} = await import('@/lib/dashboard-state');
const { recoverableFlutterwaveDeposits, visiblePendingDeposits } = await import('@/components/addfunds-page');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

describe('persisted payment UI state', () => {
  it('restores a recent status only for the user who created it', () => {
    const storage = memoryStorage();
    const now = Date.UTC(2026, 6, 17, 12);
    const status = { reference: 'NTR-USER-BOUND', paymentState: 'provider_pending' };

    persistPaymentStatus(storage, status, 'user-1', now);

    expect(readStoredPaymentStatus(storage, 'user-1', now + 1_000)).toEqual(status);
    expect(readStoredPaymentStatus(storage, 'user-2', now + 1_000)).toBeNull();
    expect(storage.getItem(PAYMENT_STATUS_STORAGE_KEY)).toBeNull();
  });

  it('discards expired and pre-versioned statuses instead of replaying them', () => {
    const storage = memoryStorage();
    const now = Date.UTC(2026, 6, 17, 12);
    persistPaymentStatus(storage, { type: 'success' }, 'user-1', now);

    expect(readStoredPaymentStatus(
      storage,
      'user-1',
      now + PAYMENT_STATUS_STORAGE_TTL_MS + 1,
    )).toBeNull();

    storage.setItem(PAYMENT_STATUS_STORAGE_KEY, JSON.stringify({ type: 'success' }));
    expect(readStoredPaymentStatus(storage, 'user-1', now)).toBeNull();
    expect(storage.getItem(PAYMENT_STATUS_STORAGE_KEY)).toBeNull();
  });
});

describe('dashboard payment notices', () => {
  it('builds a credited notice only from a completed credited transaction', () => {
    expect(paymentNoticeFromTransaction({
      reference: 'NTR-CREDITED',
      status: 'Completed',
      amount: 250_000,
    })).toEqual({
      success: true,
      reference: 'NTR-CREDITED',
      paymentState: 'credited',
      transactionStatus: 'Completed',
      type: 'success',
      amount: 250_000,
      message: 'Payment successful!',
    });
  });

  it('keeps retryable provider failures out of the success path', () => {
    expect(paymentNoticeFromResult({
      retryable: true,
      error: 'Provider unavailable',
      transactionStatus: 'Expired',
    }, 'NTR-RETRY')).toEqual({
      success: false,
      reference: 'NTR-RETRY',
      paymentState: 'retryable',
      transactionStatus: 'Expired',
      type: 'warning',
      message: 'Provider unavailable',
    });
  });

  it('preserves the verifying and provider-pending states', () => {
    expect(paymentNoticeFromTransaction({
      reference: 'NTR-VERIFYING',
      status: 'Processing',
    })).toMatchObject({
      success: false,
      paymentState: 'verifying',
      type: 'info',
    });
    expect(paymentNoticeFromTransaction({
      reference: 'NTR-PENDING',
      status: 'Pending',
    })).toMatchObject({
      success: false,
      paymentState: 'provider_pending',
      type: 'warning',
    });
  });
});

describe('pending deposits badge filter', () => {
  const now = Date.UTC(2026, 6, 20, 12);

  it('shows a recent Expired Flutterwave deposit in the badge', () => {
    const txs = [{
      type: 'deposit',
      method: 'flutterwave',
      status: 'Expired',
      date: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      amount: 500_000,
    }];
    expect(visiblePendingDeposits(txs, now)).toHaveLength(1);
  });

  it('hides a 5-hour-old Expired deposit from the badge', () => {
    const txs = [{
      type: 'deposit',
      method: 'flutterwave',
      status: 'Expired',
      date: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      amount: 500_000,
    }];
    expect(visiblePendingDeposits(txs, now)).toHaveLength(0);
  });

  it('always shows Pending deposits regardless of age', () => {
    const txs = [{
      type: 'deposit',
      method: 'flutterwave',
      status: 'Pending',
      date: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
      amount: 500_000,
    }];
    expect(visiblePendingDeposits(txs, now)).toHaveLength(1);
  });

  it('uses tx.date (API shape), not tx.createdAt', () => {
    const txs = [{
      type: 'deposit',
      method: 'flutterwave',
      status: 'Expired',
      date: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      amount: 500_000,
    }];
    expect(visiblePendingDeposits(txs, now)).toHaveLength(1);

    const txsWithCreatedAtOnly = [{
      type: 'deposit',
      method: 'flutterwave',
      status: 'Expired',
      createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      amount: 500_000,
    }];
    expect(visiblePendingDeposits(txsWithCreatedAtOnly, now)).toHaveLength(1);
  });

  it('excludes crypto and manual Expired deposits from the badge', () => {
    const txs = [
      { type: 'deposit', method: 'crypto', status: 'Expired', date: new Date(now - 1 * 60 * 60 * 1000).toISOString() },
      { type: 'deposit', method: 'manual', status: 'Expired', date: new Date(now - 1 * 60 * 60 * 1000).toISOString() },
    ];
    expect(visiblePendingDeposits(txs, now)).toHaveLength(0);
  });
});

describe('Flutterwave dashboard recovery selection', () => {
  it('includes legacy deposits but excludes the reference already being verified after redirect', () => {
    const deposits = [
      { type: 'deposit', method: 'flutterwave', status: 'Pending', reference: 'NTR-REDIRECT' },
      { type: 'deposit', method: null, status: 'Processing', reference: 'NTR-LEGACY' },
      { type: 'deposit', method: 'flutterwave', status: 'Completed', reference: 'NTR-DONE' },
      { type: 'deposit', method: 'manual', status: 'Pending', reference: 'NTR-MANUAL' },
    ];

    expect(recoverableFlutterwaveDeposits(deposits, 'NTR-REDIRECT')).toEqual([
      deposits[1],
    ]);
  });
});
