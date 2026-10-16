import prisma from './prisma.js';

/**
 * The one account every email-less guest order lives on
 * (docs/v2/guest_checkout_brief.md). Nobody logs in to it: the password,
 * Google and reset routes all refuse this email. Its wallet is a pass-through
 * that should always read ₦0 — a guest payment is credited and the order
 * debited in the same breath, and refunds go onto the guest code instead.
 */
export const GUEST_ACCOUNT_EMAIL = 'nitrongguest@gmail.com';

export function isGuestAccountEmail(email) {
  return String(email ?? '').trim().toLowerCase() === GUEST_ACCOUNT_EMAIL;
}

// Cached once found. A miss is not cached, so the account can be created
// while the server is running and be picked up on the next call.
let cachedId = null;

/** The guest account's user id, or null before it has been created. */
export async function guestAccountId(db = prisma) {
  if (cachedId) return cachedId;
  const user = await db.user.findUnique({ where: { email: GUEST_ACCOUNT_EMAIL }, select: { id: true } });
  if (user) cachedId = user.id;
  return user?.id ?? null;
}
