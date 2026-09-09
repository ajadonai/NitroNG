import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NOT_SCANNED } from "../scripts/i18n-detect.mjs";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * Support is WhatsApp. The ticket system is a read-only view of old data kept
 * for history, and it must not be presented anywhere as a way to reach us.
 *
 * CLAUDE.md has said so for months, and it still got proposed as work twice
 * and still rendered to customers whenever the WhatsApp number was unset. An
 * instruction is not a mechanism. This is the mechanism.
 */
describe("support is WhatsApp, not tickets", () => {
  it("never renders the ticket page from the dashboard", () => {
    const dash = read("components/dashboard.jsx");
    expect(dash, "dashboard imports the ticket page again").not.toMatch(/support-page/);
    expect(dash, "dashboard renders SupportPage again").not.toMatch(/<SupportPage/);
  });

  it("sends the support nav to WhatsApp, and to the guide when it is unset", () => {
    const dash = read("components/dashboard.jsx");
    const branch = dash.slice(dash.indexOf('case "support":'), dash.indexOf('case "add-funds":'));
    expect(branch).toMatch(/social_whatsapp_support/);
    expect(branch).toMatch(/wa\.me/);
    // The fallback must be the guide. Anything else risks the ticket page
    // creeping back in as "somewhere to put people".
    expect(branch).toMatch(/<GuidePage/);
  });

  it("does not offer tickets as a page an admin can be granted", () => {
    const extra = read("components/admin-extra-pages.jsx");
    expect(extra, "tickets is back in the permissions picker")
      .not.toMatch(/\{\s*id:\s*"tickets"/);
    // and no role preset hands it out
    const presets = extra.slice(extra.indexOf("const DEFAULT_PAGES"), extra.indexOf("const DEFAULT_PAGES") + 600);
    expect(presets).not.toMatch(/"tickets"/);
  });

  it("keeps the ticket code out of anything that ranks work to do", () => {
    // The scanner sorts files by how much untranslated English they hold, and
    // support-page.jsx sat near the top of that list — which is how it kept
    // being suggested. Excluding it is what actually stopped that.
    expect(NOT_SCANNED.some((re) => re.test("components/support-page.jsx"))).toBe(true);
    expect(NOT_SCANNED.some((re) => re.test("components/admin-tickets.jsx"))).toBe(true);
    const baseline = JSON.parse(read("scripts/i18n-baseline.json"));
    const listed = Object.keys(baseline).filter((f) => /support-page|ticket/i.test(f));
    expect(listed, `these should not be tracked as work: ${listed.join(", ")}`).toEqual([]);
  });
});
