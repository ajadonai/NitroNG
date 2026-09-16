import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A notification dismissed on a phone stays dismissed on a laptop.
 *
 * The bell's per-row × used to hide the row on the device it was tapped on and
 * mark it read everywhere else, because there was nowhere to put a per-id
 * clear: `clearAll` persists as `notifClearedAt`, a single timestamp, and the
 * cleared-id set lived only in localStorage. So the row came back on the next
 * device as an ordinary read line and had to be dismissed again.
 */
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const schema = read('prisma/schema.prisma');
const route = read('app/api/auth/notifications/route.js');
const dash = read('components/dashboard.jsx');

describe('dismissing one notification', () => {
  it('has somewhere to persist, mirroring the read set', () => {
    // A nullable text column holding a JSON array, not a table: every
    // notification ages out of the list at 30 days, so the set is small and
    // prunes itself.
    expect(schema).toMatch(/notifClearedIds\s+String\?/);
    expect(read('prisma/migrations/20260916150000_add_notif_cleared_ids/migration.sql'))
      .toMatch(/ALTER TABLE "users" ADD COLUMN "notifClearedIds" TEXT;/);
  });

  it('is sent to the server, not only hidden locally', () => {
    const fn = dash.slice(dash.indexOf('const dismiss = (id) => {'), dash.indexOf('const open = (n) => {'));
    expect(fn).toMatch(/clearedIds: \[id\]/);
    // Still marked read: the two sets answer different questions, and a
    // dismissed row must not keep counting toward the badge on a device that
    // has not synced yet.
    expect(fn).toMatch(/markRead\(id\)/);
  });

  it('merges rather than replaces, so two devices cannot erase each other', () => {
    const block = route.slice(route.indexOf('if (Array.isArray(body.clearedIds))'), route.indexOf('// Mark all as read'));
    expect(block).toMatch(/\[\.\.\.new Set\(\[\.\.\.existing, \.\.\.body\.clearedIds/);
    expect(block).toMatch(/merged\.slice\(-500\)/);
    // Strings only: an id is a string, and anything else would poison the JSON
    // this column is parsed back out of.
    expect(block).toMatch(/typeof v === 'string'/);
  });

  it('reads the other devices back on sync, merged with this one', () => {
    expect(route).toMatch(/notifClearedIds: clearedIds,/);
    expect(dash).toMatch(/setClearedNotifIds\(prev => new Set\(\[\.\.\.prev, \.\.\.nd\.notifClearedIds\]\)\)/);
  });

  it('starts both id sets over when everything is cleared', () => {
    // clearAll persists as a timestamp that already covers everything before
    // it, so keeping the ids would be dead weight that never prunes.
    const block = route.slice(route.indexOf('if (body.clearAll === true)'));
    expect(block).toMatch(/data\.notifReadIds = '\[\]';/);
    expect(block).toMatch(/data\.notifClearedIds = '\[\]';/);
  });
});
