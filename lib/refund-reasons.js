/**
 * Why an order was refunded or cancelled, said in words.
 *
 * Orders keep the reason as a code in `lastError` (`needs_post_link`,
 * `wrong_platform_link`, `admin_cancelled: <note>`) or as upstream's own
 * sentence, and both Pulse and the Telegram refund alerts printed it raw. One
 * list here so the office screen and the chat say the same thing (17 Oct 2026).
 *
 * Nothing with an underscore reaches a screen: an unknown code reads as its
 * words with spaces.
 */
const REASONS = Object.freeze({
  needs_post_link: 'Wrong link, needed a post',
  needs_profile_link: 'Wrong link, needed a profile',
  wrong_platform_link: 'Link for another platform',
  user_cancelled: 'Cancelled by the customer',
  'user_cancelled (bulk)': 'Customer cancelled the batch',
  admin_cancelled: 'Cancelled by an admin',
  admin_cancelled_duplicate: 'Duplicate order',
  provider_cancelled: 'Cancelled',
  // A partial says itself: the heading or the quantity line already does.
  provider_partial: null,
  dispatch_failed: 'Never got sent',
  recovered: 'Cancelled',
  // Upstream's words for a service it has removed.
  'Incorrect service ID': 'Service no longer offered',
});

/** `some_code-here` as "Some code here". */
export function inWords(value) {
  const text = String(value ?? '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/**
 * The reason in words, or null when there is nothing worth a line.
 *
 * `unknown` decides what happens to upstream's own sentences: Pulse keeps them
 * ('raw'), the Telegram alert says 'Cancelled' (Trip's call on the alerts).
 */
export function refundReasonText(reason, { unknown = 'raw' } = {}) {
  if (!reason) return null;
  const raw = String(reason).trim();
  if (Object.prototype.hasOwnProperty.call(REASONS, raw)) return REASONS[raw];
  // `admin_cancelled: they used the wrong link`: keep the note, drop the code.
  const noted = raw.match(/^admin_cancelled:\s*(.+)$/);
  if (noted) return `Admin: ${inWords(noted[1])}`;
  if (unknown === 'cancelled') return 'Cancelled';
  return /_/.test(raw) ? inWords(raw) : raw;
}
