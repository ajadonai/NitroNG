import { getPublicServiceLabel } from '@/lib/public-service-label';
import { platformOf } from '@/lib/full-catalogue';

const SNAPSHOT_TEXT_MAX_LENGTH = 120;
const TIER_LABEL_MAX_LENGTH = 60;
const PROVIDER_LISTING_STALE_MS = 48 * 60 * 60 * 1000;

function cleanSnapshotText(value, maxLength = SNAPSHOT_TEXT_MAX_LENGTH) {
  if (typeof value !== 'string') return null;
  const clean = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, maxLength) : null;
}

/**
 * Immutable public catalogue details written onto an order at creation time.
 * Provider-facing service names are never copied into the public snapshot.
 */
export function buildOrderOfferSnapshot({ tier = null, service = null, sourceOrder = null } = {}) {
  // A curated order has a group and its platform is ours. A full-list order has
  // no tier at all, and falling through to `service.category` put the PROVIDER'S
  // own category on the row — "Cheap", "Cheapest", "Vip", "Private". Twenty-eight
  // orders in ninety days carried one of those into the Telegram feed, which is
  // precisely the house style the public label exists to hide. platformOf maps a
  // service to a Nitro tile instead, and answers null when it cannot — a missing
  // platform is better than the provider's word for it.
  const platform = cleanSnapshotText(
    sourceOrder?.platformAtPurchase || tier?.group?.platform || platformOf(service?.name, service?.category)
  );
  const serviceName = cleanSnapshotText(
    sourceOrder?.serviceNameAtPurchase || tier?.group?.name
  ) || getPublicServiceLabel(service?.name, platform || service?.category);

  return {
    serviceNameAtPurchase: serviceName,
    tierNameAtPurchase: cleanSnapshotText(
      sourceOrder?.tierNameAtPurchase || tier?.tier,
      TIER_LABEL_MAX_LENGTH
    ),
    platformAtPurchase: platform,
    serviceTypeAtPurchase: cleanSnapshotText(
      sourceOrder?.serviceTypeAtPurchase || tier?.group?.type,
      TIER_LABEL_MAX_LENGTH
    ),
  };
}

/**
 * Resolves an order label without ever returning the provider's raw service name.
 * The immutable purchase snapshot wins, followed by a still-linked public offer,
 * then a conservative masked label for legacy orders.
 */
export function getOrderOfferDisplay(order = {}) {
  // Also mapped on the way out, so the twenty-eight orders already carrying a
  // provider category stop showing it wherever they are displayed. Their stored
  // snapshot is left alone: it is a record of what was written that day.
  const platform = cleanSnapshotText(
    order.platformAtPurchase || order.tier?.group?.platform || platformOf(order.service?.name, order.service?.category)
  ) || 'unknown';
  const linkedPublicName = cleanSnapshotText(order.tier?.group?.name);
  const snapshottedPublicName = cleanSnapshotText(order.serviceNameAtPurchase);
  const serviceName = snapshottedPublicName || linkedPublicName || getPublicServiceLabel(
    order.service?.name,
    platform
  );
  const tierLabel = cleanSnapshotText(
    order.tierNameAtPurchase || order.tier?.tier,
    TIER_LABEL_MAX_LENGTH
  );
  const serviceType = cleanSnapshotText(
    order.serviceTypeAtPurchase || order.tier?.group?.type,
    TIER_LABEL_MAX_LENGTH
  );

  const hasCurrentOffer = Boolean(
    order.tierId &&
    order.tier &&
    order.tier.enabled !== false &&
    order.tier.group &&
    order.tier.group.enabled !== false &&
    order.service &&
    order.service.enabled !== false &&
    order.tier.serviceId &&
    order.tier.serviceId === order.serviceId
  );
  // Full-list orders are deliberately tierless. They have a public purchase
  // snapshot but no tier label, so treating a missing tier as "Disabled" made
  // a live full-list order look unavailable. Older broken links with no
  // snapshot remain disabled instead of being reclassified after the fact.
  const fullList = Boolean(
    !order.tierId &&
    !order.tier &&
    !order.tierNameAtPurchase &&
    order.serviceNameAtPurchase &&
    order.service
  );

  // Full-list rows are deliberately imported switched off: `enabled` means
  // "curated by Nitro" there, not whether the provider still carries it. The
  // daily sweep refreshes providerListedAt for every live row, so its age is
  // the signal that an upstream service actually disappeared.
  const listedAt = new Date(order.service?.providerListedAt || 0).getTime();
  const fullListDisabled = fullList && (!Number.isFinite(listedAt) || Date.now() - listedAt > PROVIDER_LISTING_STALE_MS);
  // A curated offer whose tier, group or service has since been switched off,
  // or whose tier no longer points at the service that was bought.
  const retiredFromMenu = !fullList && !hasCurrentOffer;

  return {
    serviceName,
    tierLabel,
    platform,
    serviceType,
    fullList,
    fullListDisabled,
    retiredFromMenu,
    offerDisabled: fullList ? fullListDisabled : retiredFromMenu,
  };
}
