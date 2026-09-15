/**
 * A service group is only as orderable as what is inside it.
 *
 * An enabled group whose tiers are all off still renders as a card on New
 * Order: a customer opens it and finds nothing to buy. It looks like stock and
 * behaves like a dead end, which is worse than the product simply not being
 * listed.
 *
 * Three groups reached that state without anybody deciding they should. The
 * whole of Spotify sat in it until 15 Sep 2026, and Threads Followers and
 * X/Twitter Followers were still in it afterwards. In every case somebody
 * switched tiers off — directly, or by disabling the backing service, which
 * cascades — and the group did not follow, because nothing made it.
 *
 * So the group follows its tiers. This is the cascade rather than a refusal
 * because it matches what an admin does by hand anyway: Spotify's group was
 * disabled alongside its tiers for exactly this reason. Blocking the tier
 * change instead would make switching a product off a two-step job and leave
 * the dead end standing whenever somebody did only the first step.
 *
 * Orderable means the tier is on AND its backing service is on. A tier pointing
 * at a disabled service is exactly as unbuyable as no tier at all.
 */
export async function closeStrandedGroups(db, groupIds) {
  const ids = [...new Set((groupIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const groups = await db.serviceGroup.findMany({
    where: { id: { in: ids }, enabled: true },
    select: {
      id: true,
      name: true,
      // One is enough to prove the group still has something to sell.
      tiers: {
        where: { enabled: true, service: { enabled: true } },
        select: { id: true },
        take: 1,
      },
    },
  });

  const stranded = groups.filter(g => g.tiers.length === 0);
  if (!stranded.length) return [];

  await db.serviceGroup.updateMany({
    where: { id: { in: stranded.map(g => g.id) } },
    data: { enabled: false },
  });
  return stranded.map(g => g.name);
}
