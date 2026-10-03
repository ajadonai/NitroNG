/**
 * Meta's custom_data vocabulary translated into TikTok's properties schema.
 *
 * Meta accepts any string for content_type; TikTok validates it against
 * exactly two values and rejects everything else, and separately requires a
 * non-empty content_id. Neither rejection stops the event being accepted — it
 * lands and is then flagged in Events Manager as a diagnostic, so the only
 * symptom is quietly degraded match quality. Reported 3 Oct against our
 * homepage ViewContent, which sent content_type "landing" and no content_id.
 *
 * Meta's own payloads are deliberately left alone. Its history and its
 * optimisation are built on these values, so this translates on the way out to
 * TikTok rather than changing what both platforms are sent.
 *
 * No node builtins in here on purpose: the browser pixel sends the same
 * properties as the server, so both halves have to import this or they
 * describe the same event differently and stop deduplicating cleanly.
 */

/** TikTok allows only these two. Anything else is a diagnostic. */
const PRODUCT = 'product';
const PRODUCT_GROUP = 'product_group';

/**
 * A single buyable thing is a product; a page listing several is a group.
 * Our order form is the one surface showing one specific service, so it is the
 * only product — the landing, platform, service-type and pricing pages all
 * present a range.
 */
const CONTENT_TYPES = {
  product: PRODUCT,
  landing: PRODUCT_GROUP,
  service_page: PRODUCT_GROUP,
  service_type_page: PRODUCT_GROUP,
  pricing: PRODUCT_GROUP,
};

/**
 * Business keys are already the right thing to use as a content_id, and the
 * event_id is built from one: purchase_<orderId>, apinfo_<reference>,
 * reg_<userId>. Stripping the prefix recovers it without threading an extra
 * argument through every call site.
 */
const EVENT_ID_PREFIXES = ['purchase_', 'apinfo_', 'reg_'];

export function contentIdFromEventId(eventId) {
  if (typeof eventId !== 'string') return undefined;
  for (const prefix of EVENT_ID_PREFIXES) {
    if (eventId.startsWith(prefix)) return eventId.slice(prefix.length) || undefined;
  }
  return undefined;
}

/**
 * @param customData Meta-shaped custom_data, or undefined.
 * @param fallbackId content_id to use when custom_data carries no usable name.
 * @returns TikTok-shaped properties, or undefined when there is nothing to say.
 */
export function tiktokProperties(customData, { fallbackId } = {}) {
  const source = customData && typeof customData === 'object' ? customData : {};
  const out = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === 'content_type' || key === 'content_id') continue;
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }

  // content_name is a stable slug identifying the surface ("homepage",
  // "services-instagram"), which is exactly what a content_id should be.
  const id = String(source.content_id || source.content_name || fallbackId || '').trim();
  if (id) out.content_id = id;

  const mapped = CONTENT_TYPES[String(source.content_type || '').toLowerCase()];
  if (mapped) out.content_type = mapped;
  // An id with no type still needs one, or TikTok flags the pair. A page we
  // have not classified is a group rather than a single product: it is the
  // safer of the two, since claiming "product" asserts one buyable item.
  else if (out.content_id) out.content_type = PRODUCT_GROUP;

  return Object.keys(out).length ? out : undefined;
}
