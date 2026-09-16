import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fullListIsNewsTo, FULL_LIST_LAUNCH_AT, FULL_LIST_SEEN_KEY } from '../components/full-list-notice.jsx';

const dash = readFileSync(new URL('../components/dashboard.jsx', import.meta.url), 'utf8');
const notice = readFileSync(new URL('../components/full-list-notice.jsx', import.meta.url), 'utf8');

/**
 * Three one-time cards can come due on the same visit: the WhatsApp prompt, the
 * full-list notice, and the order tour. A Gmail signup with no phone number, on
 * an account older than the full list, who has never toured, is owed all three.
 *
 * Nothing sequenced them before this. The phone prompt renders on any page and
 * the tour fires on New Order, so those two could already land together — the
 * notice would have made it three. All of them should be seen, one after
 * another, rather than one suppressing the rest.
 */
describe('the first-visit queue', () => {
  it('runs the phone prompt first, because it is the one that asks', () => {
    expect(dash).toMatch(/const phoneDue = shouldShowPhonePrompt\(/);
    expect(dash).toMatch(/const noticeDue = !phoneDue &&/);
  });

  it('lets the tour wait its turn instead of losing it', () => {
    // The old check ran once behind a ref and never again, so a tour blocked by
    // another card on the first pass would never have fired at all. The ref is
    // not claimed until the queue is clear.
    expect(dash).toMatch(/if \(!isServices \|\| !queueClear \|\| orderTourChecked\.current \|\| !user\) return;/);
    expect(dash).toMatch(/\}, \[isServices, user, queueClear\]\);/);
  });

  it('is told about the full list only if the account predates it', () => {
    const before = { createdAt: new Date(FULL_LIST_LAUNCH_AT.getTime() - 86400000).toISOString() };
    const after = { createdAt: new Date(FULL_LIST_LAUNCH_AT.getTime() + 86400000).toISOString() };
    expect(fullListIsNewsTo(before)).toBe(true);
    expect(fullListIsNewsTo(after), 'a newer account meets both lists in the tour').toBe(false);
  });

  it('survives a user with no createdAt, or a broken one', () => {
    expect(fullListIsNewsTo(null)).toBe(false);
    expect(fullListIsNewsTo({})).toBe(false);
    expect(fullListIsNewsTo({ createdAt: 'not a date' })).toBe(false);
  });

  it('shares its seen flag with the New badge, so only one of them speaks', () => {
    // Whoever sees the modal never sees the badge; anybody who slips past the
    // modal still gets the badge as the quieter backup.
    expect(FULL_LIST_SEEN_KEY).toBe('nitro_full_list_seen');
    const newOrder = readFileSync(new URL('../components/new-order.jsx', import.meta.url), 'utf8');
    expect(newOrder).toContain('nitro_full_list_seen');
    expect(notice).toMatch(/localStorage\.setItem\(FULL_LIST_SEEN_KEY, "1"\)/);
    // Both buttons record it — dismissing is still being told.
    expect(dash).toMatch(/onClose=\{\(\) => \{ markFullListSeen\(\); setNoticeClosed\(true\); \}\}/);
    // "Show me" has to arrive ON the full list, not merely on New Order —
    // setActive("services") alone is a no-op for anyone already there, which is
    // why the button appeared to do nothing.
    expect(dash).toMatch(/onShowMe=\{\(\) => \{ markFullListSeen\(\); setNoticeClosed\(true\); setActive\("services"\); setOpenFullList\(true\); \}\}/);
    expect(dash).toMatch(/openFullList=\{openFullList\}/);
  });

  it('owns the screen while it is up, like every other overlay here', () => {
    expect(notice).toMatch(/document\.body\.style\.overflow = "hidden"/);
    expect(notice).toMatch(/if \(e\.key === "Escape"\) onClose/);
    expect(notice).toMatch(/onClick=\{e => e\.stopPropagation\(\)\}/);
    // Opaque card, never a translucent token — the house rule for overlays.
    expect(notice).toMatch(/const card = dark \? "#1a1329" : "#ffffff";/);
  });
});
