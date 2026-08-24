// Unified SMM Provider API
// All panels use the same API format: POST with key + action params
// Supports: MTP (MoreThanPanel), JAP (JustAnotherPanel), DaoSMM

import { fetchWithRetry } from '@/lib/fetch';

const PROVIDERS = {
  mtp: {
    name: 'MoreThanPanel',
    url: process.env.MTP_API_URL || 'https://morethanpanel.com/api/v2',
    key: () => process.env.MTP_API_KEY,
  },
  jap: {
    name: 'JustAnotherPanel',
    url: process.env.JAP_API_URL || 'https://justanotherpanel.com/api/v2',
    key: () => process.env.JAP_API_KEY,
  },
  dao: {
    name: 'DaoSMM',
    url: process.env.DAOSMM_API_URL || 'https://daosmm.com/api/v2',
    key: () => process.env.DAOSMM_API_KEY,
  },
};

/**
 * Make a request to any SMM panel API
 * @param {string} providerId - 'mtp' | 'jap' | 'dao'
 * @param {object} params - { action, service, link, quantity, ... }
 */
async function smmRequest(providerId, params, { maxRetries = 2 } = {}) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const apiKey = provider.key();
  if (!apiKey) throw new Error(`${provider.name} API key not configured (${providerId.toUpperCase()}_API_KEY)`);

  const body = new URLSearchParams({ key: apiKey, ...params });

  const res = await fetchWithRetry(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }, { maxRetries, timeoutMs: 30000 });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from ${provider.name}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ═══ BALANCE ═══
export function getBalance(providerId = 'mtp') {
  return smmRequest(providerId, { action: 'balance' });
}

// ═══ SERVICES ═══
export function getServices(providerId = 'mtp') {
  return smmRequest(providerId, { action: 'services' });
}

// ═══ PLACE ORDER ═══
export function placeOrder(providerId = 'mtp', serviceId, link, quantity, extra = {}) {
  const params = { action: 'add', service: serviceId, link, quantity };
  if (extra.keywords) params.keywords = extra.keywords;
  if (extra.comments) {
    const lines = extra.comments.split('\n').filter(l => l.trim());
    if (lines.length >= quantity) {
      params.comments = lines.slice(0, quantity).join('\n');
    } else if (lines.length > 0) {
      const cycled = Array.from({ length: quantity }, (_, i) => lines[i % lines.length]);
      params.comments = cycled.join('\n');
    } else {
      params.comments = extra.comments;
    }
  }
  if (extra.usernames) params.usernames = extra.usernames;
  if (extra.username) params.username = extra.username;
  // Web-traffic targeting, in the provider's own vocabulary: device and
  // type_of_traffic are numeric codes, and the keyword and referrer fields are
  // named differently from every other service type.
  if (extra.country) params.country = extra.country;
  if (extra.device) params.device = extra.device;
  if (extra.type_of_traffic) params.type_of_traffic = extra.type_of_traffic;
  if (extra.google_keyword) params.google_keyword = extra.google_keyword;
  if (extra.referring_url) params.referring_url = extra.referring_url;
  if (extra.min != null) { params.min = extra.min; params.max = extra.max; }
  if (extra.answer_number) params.answer_number = extra.answer_number;
  if (extra.runs && extra.interval) {
    params.runs = extra.runs;
    params.interval = extra.interval;
  }
  return smmRequest(providerId, params, { maxRetries: 0 });
}

// ═══ CHECK ORDER ═══
export function checkOrder(providerId = 'mtp', orderId) {
  return smmRequest(providerId, { action: 'status', order: orderId });
}

// ═══ CHECK MULTIPLE ═══
export function checkMultipleOrders(providerId = 'mtp', orderIds) {
  return smmRequest(providerId, { action: 'status', orders: orderIds.join(',') });
}

const MAX_STATUS_BATCH = 100;

async function checkOneForBatch(providerId, orderId) {
  try {
    return await checkOrder(providerId, orderId);
  } catch (error) {
    return { error: error?.message || 'Provider status check failed' };
  }
}

/**
 * Check a bounded set of provider orders, using the providers' standard
 * multi-status endpoint. Missing or failed batch entries are left as retryable
 * errors for the next cron run instead of expanding back into N single calls.
 * Returns an object keyed by the string form of each provider order ID.
 */
export async function checkOrders(providerId = 'mtp', orderIds = []) {
  const ids = [...new Set(
    orderIds
      .filter(id => id != null && String(id).trim())
      .map(id => String(id)),
  )];
  const results = {};

  for (let offset = 0; offset < ids.length; offset += MAX_STATUS_BATCH) {
    const chunk = ids.slice(offset, offset + MAX_STATUS_BATCH);
    if (chunk.length === 1) {
      results[chunk[0]] = await checkOneForBatch(providerId, chunk[0]);
      continue;
    }

    let batch;
    try {
      batch = await checkMultipleOrders(providerId, chunk);
    } catch (error) {
      const message = error?.message || 'Provider batch status check failed';
      for (const id of chunk) results[id] = { error: message };
      continue;
    }

    for (const id of chunk) {
      const entry = batch && !Array.isArray(batch) && typeof batch === 'object'
        ? batch[id]
        : null;
      results[id] = entry && typeof entry === 'object'
        ? entry
        : { error: 'Provider batch response omitted order' };
    }
  }

  return results;
}

// ═══ REFILL ═══
export function refillOrder(providerId = 'mtp', orderId) {
  return smmRequest(providerId, { action: 'refill', order: orderId });
}

// ═══ CANCEL ═══
export function cancelOrder(providerId = 'mtp', orderId) {
  return smmRequest(providerId, { action: 'cancel', order: orderId });
}

// ═══ HELPER ═══
export function isProviderConfigured(providerId) {
  const provider = PROVIDERS[providerId];
  return provider ? !!provider.key() : false;
}

export function getProviderName(providerId) {
  return PROVIDERS[providerId]?.name || providerId;
}

export const PROVIDER_IDS = Object.keys(PROVIDERS);
