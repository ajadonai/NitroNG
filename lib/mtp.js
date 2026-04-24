// MoreThanPanel API integration
// Docs: https://morethanpanel.com/api

import { fetchWithRetry } from '@/lib/fetch';

const MTP_KEY = process.env.MTP_API_KEY;
const MTP_URL = process.env.MTP_API_URL || 'https://morethanpanel.com/api/v2';

/**
 * Make a request to MTP API
 */
async function mtpRequest(params) {
  if (!MTP_KEY) throw new Error('MTP_API_KEY not configured. Add it to your environment variables.');

  const body = new URLSearchParams({ key: MTP_KEY, ...params });

  const res = await fetchWithRetry(MTP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }, { maxRetries: 2, timeoutMs: 30000 });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

/**
 * Get account balance from MTP
 */
export async function getBalance() {
  return mtpRequest({ action: 'balance' });
}

/**
 * Fetch all services from MTP
 * Returns array of { service, name, type, category, rate, min, max, refill, cancel }
 */
export async function getServices() {
  return mtpRequest({ action: 'services' });
}

/**
 * Place an order on MTP
 * @param {number} serviceId - MTP service ID
 * @param {string} link - target URL
 * @param {number} quantity
 * @param {object} [extra] - { comments, usernames, answer_number }
 * @returns {{ order }} - MTP order ID
 */
export async function placeOrder(serviceId, link, quantity, extra = {}) {
  const params = {
    action: 'add',
    service: serviceId,
    link,
    quantity,
  };
  if (extra.comments) params.comments = extra.comments;
  if (extra.usernames) params.usernames = extra.usernames;
  if (extra.answer_number) params.answer_number = extra.answer_number;
  return mtpRequest(params);
}

/**
 * Check order status on MTP
 * @param {number} orderId - MTP order ID
 * @returns {{ status, charge, start_count, remains }}
 */
export async function checkOrder(orderId) {
  return mtpRequest({
    action: 'status',
    order: orderId,
  });
}

/**
 * Check multiple orders at once
 * @param {number[]} orderIds
 */
export async function checkMultipleOrders(orderIds) {
  return mtpRequest({
    action: 'status',
    orders: orderIds.join(','),
  });
}

/**
 * Request order refill (if service supports it)
 * @param {number} orderId
 */
export async function refillOrder(orderId) {
  return mtpRequest({
    action: 'refill',
    order: orderId,
  });
}

/**
 * Cancel an order
 * @param {number} orderId
 */
export async function cancelOrder(orderId) {
  return mtpRequest({
    action: 'cancel',
    order: orderId,
  });
}
