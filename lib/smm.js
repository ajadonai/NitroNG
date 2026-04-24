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
async function smmRequest(providerId, params) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const apiKey = provider.key();
  if (!apiKey) throw new Error(`${provider.name} API key not configured (${providerId.toUpperCase()}_API_KEY)`);

  const body = new URLSearchParams({ key: apiKey, ...params });

  const res = await fetchWithRetry(provider.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }, { maxRetries: 2, timeoutMs: 30000 });

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
  if (extra.comments) params.comments = extra.comments;
  if (extra.usernames) params.usernames = extra.usernames;
  if (extra.answer_number) params.answer_number = extra.answer_number;
  if (extra.runs && extra.interval) {
    params.runs = extra.runs;
    params.interval = extra.interval;
  }
  return smmRequest(providerId, params);
}

// ═══ CHECK ORDER ═══
export function checkOrder(providerId = 'mtp', orderId) {
  return smmRequest(providerId, { action: 'status', order: orderId });
}

// ═══ CHECK MULTIPLE ═══
export function checkMultipleOrders(providerId = 'mtp', orderIds) {
  return smmRequest(providerId, { action: 'status', orders: orderIds.join(',') });
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
