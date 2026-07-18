import { headers as getHeaders } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { log } from '@/lib/logger';
import { parseFbCookies } from '@/lib/meta-capi';
import { rateLimit } from '@/lib/rate-limit';
import {
  isCreditedPaymentResult,
  reconcileFlutterwaveDeposit,
} from '@/lib/flutterwave-payment';
import { notifyDepositFinalized } from '@/lib/deposit-notifications';

function nonCreditedResponse(outcome) {
  const common = {
    success: false,
    paymentState: outcome.paymentState,
    transactionStatus: outcome.transactionStatus,
    retryable: Boolean(outcome.retryable),
    reference: outcome.transaction?.reference || null,
    message: outcome.message || 'Payment verification failed',
    error: outcome.message || 'Payment verification failed',
  };

  if (outcome.reason === 'not_found') {
    return Response.json(common, { status: 404 });
  }
  if (outcome.paymentState === 'verifying' || outcome.paymentState === 'provider_pending') {
    return Response.json(common, { status: 202 });
  }
  if (outcome.paymentState === 'retryable') {
    return Response.json(common, { status: 503 });
  }
  return Response.json(common, { status: 422 });
}

function inconsistentOutcome(outcome) {
  return Response.json({
    success: false,
    paymentState: 'retryable',
    transactionStatus: outcome.transactionStatus || null,
    retryable: true,
    reference: outcome.transaction?.reference || null,
    message: 'Payment status could not be confirmed. Please try again.',
    error: 'Payment status could not be confirmed. Please try again.',
  }, { status: 503 });
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const limit = await rateLimit(req, {
      maxAttempts: 12,
      windowMs: 60 * 1000,
      key: `rl:payment-verify:${session.id}`,
    });
    if (limit.unavailable) {
      const message = 'Payment verification protection is temporarily unavailable. Please try again shortly.';
      return Response.json({
        success: false,
        paymentState: 'retryable',
        transactionStatus: null,
        retryable: true,
        unavailable: true,
        message,
        error: message,
      }, { status: 503, headers: { 'Retry-After': String(limit.retryAfter ?? 5) } });
    }
    if (limit.limited) {
      const message = 'Too many verification attempts. Please wait a minute and try again.';
      return Response.json({
        success: false,
        paymentState: 'retryable',
        transactionStatus: null,
        retryable: true,
        message,
        error: message,
      }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 60) } });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    const reference = typeof body?.reference === 'string' ? body.reference.trim() : '';
    if (!reference) return Response.json({ error: 'Reference required' }, { status: 400 });

    // Provider I/O happens before any financial status claim. A timeout or
    // process interruption therefore cannot strand a newly Processing row.
    const outcome = await reconcileFlutterwaveDeposit({
      reference,
      userId: session.id,
    });

    const candidate = {
      success: true,
      paymentState: outcome.paymentState,
      transactionStatus: outcome.transactionStatus,
    };
    const outcomeClaimsCredit = outcome.paymentState === 'credited'
      || outcome.transactionStatus === 'Completed';
    const storedCompletionConfirmed = outcome.transaction?.status === 'Completed';

    if (!isCreditedPaymentResult(candidate) || !storedCompletionConfirmed) {
      if (outcomeClaimsCredit) return inconsistentOutcome(outcome);
      return nonCreditedResponse(outcome);
    }

    const finalization = outcome.finalization;
    const amountKobo = finalization?.depositAmount ?? outcome.transaction?.amount ?? 0;
    const couponBonus = finalization?.couponBonus || 0;
    const welcomeBonus = finalization?.welcomeBonus || 0;
    const totalCredit = finalization?.totalUserCredit
      ?? (amountKobo + couponBonus + welcomeBonus);
    const eventId = outcome.newlyFinalized
      ? `apinfo_${outcome.transaction.reference}`
      : undefined;

    if (outcome.newlyFinalized && finalization) {
      try {
        // Everything after the financial commit is best effort. Header access,
        // attribution parsing, or notification delivery must never turn a
        // completed deposit into a retryable response.
        const hdrs = await getHeaders();
        const { fbp, fbc } = parseFbCookies(hdrs.get('cookie'));
        await notifyDepositFinalized(finalization, {
          channel: 'Flutterwave',
          clientIp: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip'),
          userAgent: hdrs.get('user-agent'),
          fbp,
          fbc,
          sourceUrl: hdrs.get('referer'),
        });
      } catch (notifyError) {
        log.warn('Payments Verify notifications', notifyError.message);
      }

      log.info(
        'Payments Verify',
        `Credited verified Flutterwave deposit (ref: ${outcome.transaction.reference})`,
      );
    }

    return Response.json({
      success: true,
      paymentState: 'credited',
      transactionStatus: 'Completed',
      retryable: false,
      reference: outcome.transaction.reference,
      ...(eventId ? { eventId } : {}),
      message: outcome.newlyFinalized
        ? (couponBonus > 0 ? `Payment successful! ₦${couponBonus / 100} bonus applied.` : 'Payment successful')
        : 'Already credited',
      amount: amountKobo / 100,
      bonus: couponBonus / 100,
      welcomeBonus: welcomeBonus / 100,
      total: totalCredit / 100,
    });
  } catch (error) {
    log.error('Payments Verify', error.message);
    return Response.json({
      success: false,
      paymentState: 'retryable',
      transactionStatus: null,
      retryable: true,
      message: 'Payment verification is temporarily unavailable. Please try again.',
      error: 'Payment verification is temporarily unavailable. Please try again.',
    }, { status: 503 });
  }
}
