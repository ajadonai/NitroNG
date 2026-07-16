import { describe, expect, it } from 'vitest';

const {
  PAYMENT_STATUS_STORAGE_KEY,
  PAYMENT_STATUS_STORAGE_TTL_MS,
  persistPaymentStatus,
  readStoredPaymentStatus,
} = await import('@/components/dashboard');
const { recoverableFlutterwaveDeposits } = await import('@/components/addfunds-page');

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
