import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const lib = readFileSync(new URL('../lib/group-integrity.js', import.meta.url), 'utf8');
const groups = readFileSync(new URL('../app/api/admin/service-groups/route.js', import.meta.url), 'utf8');
const services = readFileSync(new URL('../app/api/admin/services/route.js', import.meta.url), 'utf8');

/**
 * A group that is on must have something a customer can buy.
 *
 * Three groups reached the opposite state without anybody deciding they
 * should — the whole of Spotify, Threads Followers, and X/Twitter Followers
 * 🇺🇸 — each rendering as a card you could open and not order from. In every
 * case somebody switched tiers off (directly, or by disabling the backing
 * service, which cascades) and the group did not follow, because nothing made
 * it follow.
 */
describe('a group cannot be a dead end', () => {
  it('counts a tier as orderable only if its service is on too', () => {
    // A tier pointing at a disabled service is exactly as unbuyable as no tier.
    expect(lib).toMatch(/where: \{ enabled: true, service: \{ enabled: true \} \}/);
    expect(groups).toMatch(/where: \{ groupId, enabled: true, service: \{ enabled: true \} \}/);
  });

  it('refuses to switch a group on when nothing in it can be ordered', () => {
    expect(groups).toMatch(/if \(data\.enabled === true\)/);
    expect(groups).toMatch(/This group has no tier a customer could order/);
  });

  it('takes the group down with its last orderable tier', () => {
    // The cascade rather than a refusal: it is what an admin does by hand
    // anyway, and refusing would leave the dead end standing whenever somebody
    // did only the first step of a two-step job.
    expect(groups).toMatch(/if \(data\.enabled === false\)/);
    expect(groups).toMatch(/closeStrandedGroups\(prisma, \[updated\.groupId\]\)/);
  });

  it('takes the group down when its last orderable tier is deleted', () => {
    // The hole the other two guards left open, and the one that actually
    // stranded every group we found: Spotify Podcast Plays, Threads Followers
    // and X/Twitter Followers 🇺🇸 were each left enabled with zero tiers
    // because the last tier was deleted rather than switched off, and only the
    // disable path called the cascade.
    const del = groups.slice(groups.indexOf("action === 'delete-tier'"), groups.indexOf("action === 'recalculate-prices'"));
    expect(del).toMatch(/await prisma\.serviceTier\.delete\(\{ where: \{ id: tierIdToDelete \} \}\);/);
    expect(del).toMatch(/closeStrandedGroups\(prisma, \[existing\.groupId\]\)/);
    // After the delete, not before — the tier still counts until it is gone.
    expect(del.indexOf('serviceTier.delete')).toBeLessThan(del.indexOf('closeStrandedGroups'));
    expect(del).toMatch(/its last orderable tier was deleted/);
  });

  it('does the same when a disabled service cascades through its tiers', () => {
    expect(services).toMatch(/closeStrandedGroups\(prisma, affected\.map\(t => t\.groupId\)\)/);
  });

  it('reads the affected groups before the cascade, not after', () => {
    // Once the tiers are off there is no way back to their groups.
    // Anchored forward from the read: the import of closeStrandedGroups sits
    // at the top of the file and would otherwise end the slice before it began.
    const from = services.indexOf('const affected = await prisma.serviceTier.findMany');
    const cascade = services.slice(from, services.indexOf('closeStrandedGroups', from));
    expect(cascade).toMatch(/where: \{ serviceId, enabled: true \}, select: \{ groupId: true \}/);
    expect(cascade.indexOf('updateMany'), 'the read must come first').toBeGreaterThan(-1);
  });

  it('says so in the activity log, because it is a change nobody asked for', () => {
    expect(groups).toMatch(/its last orderable tier was switched off/);
    expect(services).toMatch(/now-empty group\(s\)/);
  });
});
