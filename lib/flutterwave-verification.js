const VERIFY_BY_REFERENCE_URL = 'https://api.flutterwave.com/v3/transactions/verify_by_reference';
const DEFAULT_TIMEOUT_MS = 15_000;

const PROVIDER_PENDING_STATUSES = new Set(['pending', 'processing']);
const PROVIDER_FAILED_STATUSES = new Set(['failed', 'cancelled', 'canceled']);

function retryable(reason, details = {}) {
  return { state: 'retryable', reason, ...details };
}

function failed(reason, details = {}) {
  return { state: 'failed', reason, ...details };
}

function normalizedProviderStatus(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hasTrustedIdentity(data, reference, expectedCurrency) {
  return typeof reference === 'string'
    && data.tx_ref === reference
    && typeof data.currency === 'string'
    && data.currency === expectedCurrency;
}

export function classifyFlutterwaveResponse(payload, {
  reference,
  expectedAmountKobo,
  expectedCurrency = 'NGN',
} = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return retryable('malformed_response');
  }
  if (payload.status !== 'success' || !payload.data || typeof payload.data !== 'object') {
    return retryable('provider_error', {
      providerMessage: typeof payload.message === 'string' ? payload.message : undefined,
    });
  }

  const providerStatus = normalizedProviderStatus(payload.data.status);
  if (PROVIDER_PENDING_STATUSES.has(providerStatus)) {
    if (!hasTrustedIdentity(payload.data, reference, expectedCurrency)) {
      return retryable('untrusted_pending_response', { providerStatus });
    }
    return { state: 'provider_pending', providerStatus };
  }
  if (PROVIDER_FAILED_STATUSES.has(providerStatus)) {
    if (!hasTrustedIdentity(payload.data, reference, expectedCurrency)) {
      return retryable('untrusted_terminal_response', { providerStatus });
    }
    return failed('provider_failed', { providerStatus });
  }
  if (providerStatus !== 'successful') {
    return retryable('unknown_provider_status', { providerStatus: providerStatus || undefined });
  }

  if (typeof reference !== 'string' || payload.data.tx_ref !== reference) {
    return failed('reference_mismatch', {
      providerReference: payload.data.tx_ref,
      expectedReference: reference,
    });
  }

  if (typeof payload.data.currency !== 'string' || payload.data.currency !== expectedCurrency) {
    return failed('currency_mismatch', {
      providerCurrency: payload.data.currency,
      expectedCurrency,
    });
  }

  if (typeof payload.data.amount !== 'number') {
    return retryable('malformed_amount');
  }
  const providerAmount = payload.data.amount;
  const paidAmountKobo = Math.round(providerAmount * 100);
  if (
    !Number.isFinite(providerAmount)
    || !Number.isSafeInteger(paidAmountKobo)
    || paidAmountKobo <= 0
    || !Number.isSafeInteger(expectedAmountKobo)
    || paidAmountKobo !== expectedAmountKobo
  ) {
    return failed('amount_mismatch', {
      paidAmountKobo: Number.isSafeInteger(paidAmountKobo) ? paidAmountKobo : null,
      expectedAmountKobo,
    });
  }

  return {
    state: 'verified',
    providerStatus,
    paidAmountKobo,
    providerTransactionId: payload.data.id ?? null,
  };
}

export async function verifyFlutterwaveTransaction({
  reference,
  expectedAmountKobo,
  expectedCurrency = 'NGN',
  secretKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!secretKey || typeof secretKey !== 'string') {
    return retryable('missing_configuration');
  }
  if (typeof fetchImpl !== 'function') {
    return retryable('transport_unavailable');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));

  try {
    const response = await fetchImpl(
      `${VERIFY_BY_REFERENCE_URL}?tx_ref=${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        signal: controller.signal,
      },
    );

    if (!response?.ok) {
      return retryable('provider_http_error', { httpStatus: response?.status ?? null });
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      return retryable('malformed_json');
    }

    return classifyFlutterwaveResponse(payload, {
      reference,
      expectedAmountKobo,
      expectedCurrency,
    });
  } catch (error) {
    return retryable(error?.name === 'AbortError' ? 'timeout' : 'transport_error');
  } finally {
    clearTimeout(timeout);
  }
}
