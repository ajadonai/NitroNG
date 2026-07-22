import { PAYMENT_STATES, paymentStateFromTransactionStatus } from './payment-state';
import { STATUS_TIERS } from './nitro-rewards-core';

export const PAYMENT_STATUS_STORAGE_KEY = 'nitro-payment-status';
export const PAYMENT_STATUS_STORAGE_TTL_MS = 15 * 60 * 1000;

export function readStoredPaymentStatus(storage, userId, now = Date.now()) {
  if (!storage || !userId) return null;
  try {
    const raw = storage.getItem(PAYMENT_STATUS_STORAGE_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    const age = now - record?.savedAt;
    const isValid = record?.version === 1
      && record.userId === userId
      && Number.isFinite(record.savedAt)
      && age >= 0
      && age <= PAYMENT_STATUS_STORAGE_TTL_MS
      && record.status != null;
    if (isValid) return record.status;
    storage.removeItem(PAYMENT_STATUS_STORAGE_KEY);
  } catch {
    try { storage.removeItem(PAYMENT_STATUS_STORAGE_KEY); } catch {}
  }
  return null;
}

export function persistPaymentStatus(storage, status, userId, now = Date.now()) {
  if (!storage) return;
  try {
    if (status == null || !userId) {
      storage.removeItem(PAYMENT_STATUS_STORAGE_KEY);
      return;
    }
    storage.setItem(PAYMENT_STATUS_STORAGE_KEY, JSON.stringify({
      version: 1,
      userId,
      savedAt: now,
      status,
    }));
  } catch {}
}

export function decorateUserWithRewardsStatus(user, rewards) {
  if (!user) return user;
  if (!rewards?.status) {
    return { ...user, badge: 'Status unavailable', badgeColor: null, nextTier: null };
  }
  const currentTier = STATUS_TIERS.find(tier => tier.key === rewards.status.key);
  if (!currentTier) {
    return { ...user, badge: 'Status unavailable', badgeColor: null, nextTier: null };
  }
  const nextTier = STATUS_TIERS.find(tier => tier.name === rewards.status.nextName) || null;
  return {
    ...user,
    badge: currentTier.name,
    badgeColor: currentTier.color,
    nextTier: nextTier ? { name: nextTier.name, color: nextTier.color } : null,
  };
}

export function paymentNoticeFromResult(result, reference) {
  const paymentState = result?.paymentState;
  const common = {
    success: false,
    reference: result?.reference || reference,
    paymentState,
    transactionStatus: result?.transactionStatus,
  };

  if (paymentState === PAYMENT_STATES.VERIFYING) {
    return { ...common, type: 'info', message: result.message || 'We’re confirming your payment. This normally takes a moment.' };
  }
  if (paymentState === PAYMENT_STATES.PROVIDER_PENDING) {
    return { ...common, type: 'warning', message: result.message || 'Flutterwave has not confirmed the payment yet. We’ll keep checking.' };
  }
  if (paymentState === PAYMENT_STATES.RETRYABLE || result?.retryable) {
    return { ...common, type: 'warning', paymentState: PAYMENT_STATES.RETRYABLE, message: result.message || result.error || 'We couldn’t reach Flutterwave. Your payment is safe and can be checked again.' };
  }
  return { ...common, type: 'error', paymentState: paymentState || PAYMENT_STATES.FAILED, message: result?.message || result?.error || 'Payment verification failed' };
}

export function paymentNoticeFromTransaction(tx) {
  const paymentState = tx.paymentState || paymentStateFromTransactionStatus(tx.status);
  const base = {
    success: false,
    reference: tx.reference,
    paymentState,
    transactionStatus: tx.status,
  };

  if (paymentState === PAYMENT_STATES.CREDITED && tx.status === 'Completed') {
    return { ...base, success: true, type: 'success', amount: tx.amount, message: 'Payment successful!' };
  }
  return paymentNoticeFromResult(base, tx.reference);
}
