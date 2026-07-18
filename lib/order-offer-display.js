import { getPublicServiceLabel } from '@/lib/public-service-label';

const SNAPSHOT_TEXT_MAX_LENGTH = 120;
const TIER_LABEL_MAX_LENGTH = 60;

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
  const platform = cleanSnapshotText(
    sourceOrder?.platformAtPurchase || tier?.group?.platform || service?.category
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
  const platform = cleanSnapshotText(
    order.platformAtPurchase || order.tier?.group?.platform || order.service?.category
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

  return {
    serviceName,
    tierLabel,
    platform,
    serviceType,
    offerDisabled: !hasCurrentOffer,
  };
}
