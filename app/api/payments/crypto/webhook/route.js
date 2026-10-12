import { log } from '@/lib/logger';
import { reportOperationalFailure } from '@/lib/monitoring';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';
import { reconcileCryptoDeposit, getCryptomusCredentials } from '@/lib/crypto-deposit';
import {
  normalizeCryptomusProviderId,
  verifyCryptomusWebhook,
} from '@/lib/cryptomus-verification';

const WEBHOOK_PROVIDER_TIMEOUT_MS = 2_200;

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
    // Cryptomus has no separate IPN secret: the payment API key both signs our
    // requests and verifies their callbacks, so the gateway credentials are
    // read at request time and a rotation takes effect without a redeploy.
    const credentials = await getCryptomusCredentials();
    if (!credentials.ready) {
      log.error('Cryptomus Webhook', 'Cryptomus credentials are not configured');
      reportOperationalFailure('webhook_configuration_missing', {
        data: { provider: 'cryptomus' },
        dedupeKey: 'webhook_configuration_missing:cryptomus',
      });
      return retryableWebhookResponse('Webhook not configured');
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    // Unlike NOWPayments, the signature travels inside the body rather than in
    // a header, and it covers every other field. Verification is constant time.
    if (!verifyCryptomusWebhook(body, credentials.apiKey)) {
      log.warn('Cryptomus Webhook', 'Invalid signature');
      return Response.json({ ok: false, error: 'Invalid signature' }, { status: 403 });
    }

    const providerPaymentId = normalizeCryptomusProviderId(body?.uuid);
    const reference = body?.order_id;
    if (!validOrderReference(reference)) {
      return Response.json({ ok: false, error: 'Missing or invalid order_id' }, { status: 400 });
    }

    // The signed callback is only a trigger. Crediting uses a fresh,
    // authoritative read and the same reconciler as polling and cron recovery,
    // so a forged or replayed callback cannot credit anything by itself.
    const outcome = await reconcileCryptoDeposit({
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
        log.warn('Cryptomus Webhook', `Deposit notification failed: ${notifyError.message}`);
      }
    }

    if (outcome.reason === 'not_found') {
      log.warn('Cryptomus Webhook', `No matching deposit for ${reference}`);
      return retryableWebhookResponse('Transaction not found', 404);
    }
    if (outcome.paymentState === 'retryable' || outcome.paymentState === 'verifying') {
      log.warn('Cryptomus Webhook', `${reference}: ${outcome.reason || outcome.paymentState}`);
      if (outcome.paymentState === 'retryable') {
        reportOperationalFailure('webhook_processing_failed', {
          level: 'warning',
          data: { provider: 'cryptomus', reason: outcome.reason || 'verification_retryable' },
          dedupeKey: 'webhook_processing_failed:cryptomus',
        });
      }
      return retryableWebhookResponse(
        outcome.message || 'Provider verification is temporarily unavailable',
      );
    }

    log.info(
      'Cryptomus Webhook',
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
    log.error('Cryptomus Webhook', error.message);
    reportOperationalFailure('webhook_processing_failed', {
      error,
      data: { provider: 'cryptomus' },
      dedupeKey: 'webhook_processing_failed:cryptomus',
    });
    return retryableWebhookResponse('Webhook processing failed', 500);
  }
}
