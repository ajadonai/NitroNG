import { log } from '@/lib/logger';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';
import { reconcileNowPaymentsDeposit } from '@/lib/nowpayments-payment';
import {
  normalizeNowPaymentsProviderId,
  verifyNowPaymentsIpnSignature,
} from '@/lib/nowpayments-verification';

const WEBHOOK_PROVIDER_TIMEOUT_MS = 2_200;

function nowPaymentsIpnSecret() {
  return process.env.NOWPAYMENTS_IPN_SECRET?.trim() || '';
}

function validOrderReference(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 200
    && value === value.trim()
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
}

function retryableWebhookResponse(message, status = 503) {
  return Response.json({ ok: false, retryable: true, error: message }, {
    status,
    headers: { 'Retry-After': '15' },
  });
}

export async function POST(req) {
  try {
    // Read at request time so rotated secrets take effect without a module reload.
    const secret = nowPaymentsIpnSecret();
    if (!secret) {
      log.error('NOWPayments Webhook', 'NOWPAYMENTS_IPN_SECRET is not configured');
      return retryableWebhookResponse('Webhook not configured');
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const signature = req.headers.get('x-nowpayments-sig');
    if (!verifyNowPaymentsIpnSignature(body, signature, secret)) {
      log.warn('NOWPayments Webhook', 'Invalid signature');
      return Response.json({ ok: false, error: 'Invalid signature' }, { status: 403 });
    }

    const providerPaymentId = normalizeNowPaymentsProviderId(body?.payment_id);
    const reference = body?.order_id;
    if (!providerPaymentId || !validOrderReference(reference)) {
      return Response.json({
        ok: false,
        error: !providerPaymentId ? 'Missing or invalid payment_id' : 'Missing or invalid order_id',
      }, { status: 400 });
    }

    // The signed callback is only a trigger. Crediting uses a fresh,
    // authoritative GET and the same reconciler as polling and cron recovery.
    const outcome = await reconcileNowPaymentsDeposit({
      reference,
      providerPaymentId,
      timeoutMs: WEBHOOK_PROVIDER_TIMEOUT_MS,
      auditCompleted: true,
      recoveredBy: 'webhook',
    });

    const confirmedCredit = outcome.success === true
      && outcome.paymentState === 'credited'
      && outcome.transactionStatus === 'Completed'
      && outcome.transaction?.status === 'Completed'
      && !(
        outcome.transaction.paymentReviewReason
        && !outcome.transaction.paymentReviewResolvedAt
      );
    if (outcome.newlyFinalized && outcome.finalization && confirmedCredit) {
      try {
        await notifyDepositFinalized(outcome.finalization, { channel: 'Crypto' });
      } catch (notifyError) {
        log.warn('NOWPayments Webhook', `Deposit notification failed: ${notifyError.message}`);
      }
    }

    if (outcome.reason === 'not_found') {
      log.warn('NOWPayments Webhook', `No matching deposit for ${reference}`);
      return retryableWebhookResponse('Transaction not found', 404);
    }
    if (outcome.paymentState === 'retryable' || outcome.paymentState === 'verifying') {
      log.warn('NOWPayments Webhook', `${reference}: ${outcome.reason || outcome.paymentState}`);
      return retryableWebhookResponse(
        outcome.message || 'Provider verification is temporarily unavailable',
      );
    }

    log.info(
      'NOWPayments Webhook',
      `${reference}: ${outcome.paymentState} (${outcome.providerStatus || 'provider status unavailable'})`,
    );
    return Response.json({
      ok: true,
      paymentState: outcome.paymentState,
      status: outcome.transactionStatus,
      reason: outcome.reason || null,
      reference,
    });
  } catch (error) {
    log.error('NOWPayments Webhook', error.message);
    return retryableWebhookResponse('Webhook processing failed', 500);
  }
}
