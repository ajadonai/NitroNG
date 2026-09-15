import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * The bell, and the two things that were wrong with it.
 *
 * The first was a stuck badge. Support notifications were built from unread
 * tickets and carried `alwaysUnread: true`, a flag the filter honoured ahead of
 * both the read check and the cleared check — so Mark all read could not touch
 * them and neither could Clear all. On 14 Sep 2026 that was 25 flags across 22
 * customers, every one of them on a ticket already Resolved, the newest raised
 * on 20 June, through a support channel that moved to WhatsApp months earlier.
 * The flags were cleared in the database and the rows removed from the bell.
 * Ify can still open a ticket on escalation, so the guard here is that no path
 * puts one back in the list with a flag nothing can clear.
 *
 * The second was a dead end. The list stopped at ten under a footer reading
 * "Showing latest 10 of 23" — naming the rest, offering no way to them, and
 * there is no notifications page to link to. And tapping a row only marked it
 * read, so a notification about a delivered order could not open that order.
 */
describe("notification panel", () => {
  const dash = read("components/dashboard.jsx");
  const orders = read("components/orders-page.jsx");

  it("has no notification nothing can clear", () => {
    // The property and every read of it, not the word — the comment above the
    // list says why the flag is gone, and that sentence is worth keeping.
    expect(dash).not.toMatch(/alwaysUnread:/);   // nothing sets it
    expect(dash).not.toMatch(/\.alwaysUnread\b/); // nothing reads it
    // The ticket branch itself, and the state that fed it.
    expect(dash).not.toMatch(/unreadTickets|type: "ticket"/);
  });

  it("builds nothing older than 30 days, which is the auto-clear", () => {
    // No sweep runs and none is needed: an order or transaction past the cutoff
    // never becomes a notification, so the list empties itself.
    expect(dash).toContain("const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)");
    expect(dash).toMatch(/orders\.filter\(o => o\.created && new Date\(o\.created\) >= cutoff\)/);
  });

  it("opens the thing it is telling you about, rather than only marking it read", () => {
    // An order goes to History seeded with its own reference; a deposit or a
    // reward goes to the wallet, which has no search to seed.
    expect(dash).toContain('onNavigate(n.type === "order" ? "orders" : "add-funds", n.ref || null)');
    expect(dash).toContain("onNavigate={openFromNotification}");
    expect(dash).toContain('initialSearch={ordersFocus || ""}');
    expect(orders).toContain("const [search, setSearch] = useState(initialSearch || \"\")");
  });

  it("does not name rows it will not show", () => {
    expect(dash).not.toContain("Showing latest 10 of");
    expect(dash).toContain("const NOTIF_LIMIT = 30;");
    expect(dash).toContain("filtered.slice(0, NOTIF_LIMIT)");
  });

  it("is a sheet on a phone and a dropdown on a desktop, never both at once", () => {
    // Both are in the tree and the viewport picks one, the same way the More
    // sheet works. The breakpoint in the stylesheet and the Tailwind variant
    // have to agree or a phone gets two panels.
    expect(dash).toContain("dash-notif-overlay");
    expect(dash).toContain("dash-notif-sheet");
    expect(dash).toContain("max-desktop:hidden absolute");
    const css = read("app/globals.css");
    expect(css).toContain("--breakpoint-desktop: 1200px;");
    expect(css).toMatch(/@media \(max-width: 1199px\) \{[\s\S]*\.dash-notif-sheet \{/);
    // The sheet obeys the house rules: a backdrop that closes it, and the page
    // behind it locked. The lock already covers notifOpen.
    expect(dash).toMatch(/className="dash-notif-overlay" onClick=\{onClose\}/);
    expect(dash).toContain("leftOpen || notifOpen || moreOpen || installMoment");
  });

  it("filters on the kinds it actually produces, and hides the empty ones", () => {
    // Four kinds are built and the old tabs offered three, so rewards could not
    // be filtered for at all.
    for (const kind of ["order", "deposit", "reward"]) {
      expect(dash).toContain(`type: "${kind}"`);
      expect(dash).toContain(`key: "${kind}"`);
    }
    expect(dash).toContain('.filter(k => k.n > 0 || k.key === "all")');
  });
});
