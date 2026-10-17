import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Some groups hold variants rather than a quality ladder — WhatsApp poll votes,
 * where the letter picks which answer the votes land on. There is no better or
 * worse among them, so the three-up tier grid would misrepresent the decision,
 * and five of them do not fit a three-column grid anyway.
 *
 * The whole feature is gated on a group tag so it cannot leak onto the 165
 * groups that are quality ladders. These assertions guard that gate.
 */
const SOURCE = readFileSync("components/new-order.jsx", "utf8");

describe("option-picker groups", () => {
  // Both rules are written down where a future session will meet them: beside
  // the code and in CLAUDE.md. The refill one especially — a session already
  // read the mismatch as a bug and rewrote the label before being corrected.
  it("records that the refill promise is the tier name, not the data", () => {
    expect(SOURCE).toMatch(/INTENTIONAL\. Do not "fix" this to read ServiceTier\.refillDays/);
    const md = readFileSync("CLAUDE.md", "utf8");
    expect(md).toMatch(/## The refill promise is the tier name, not the data/);
    expect(md).toMatch(/Nitro assurance — we set it and we honour it ourselves/);
  });

  it("records that the dropdown is opt-in per group", () => {
    expect(SOURCE).toMatch(/deliberately opt-in per group/);
    expect(SOURCE).toMatch(/Do not make this the default picker/);
    expect(readFileSync("CLAUDE.md", "utf8")).toMatch(/## Groups that hold options instead of tiers/);
  });

  it("renders the dropdown only for groups tagged options", () => {
    expect(SOURCE).toContain('tags?.includes("options")');
    // The ternary is what keeps the tier grid for everyone else. Without it the
    // dropdown would be the only picker.
    expect(SOURCE).toMatch(/isOptionPicker \? \(/);
  });

  it("keeps the tier well as the default path", () => {
    expect(SOURCE).toMatch(/<div className=\{`tw\$\{/);
    expect(SOURCE).toMatch(/const TIER_CSS = `/);
  });

  // Every segment is the same box, so switching tier never resizes the row:
  // equal columns, and the picked state is colour and an inset ring only.
  it("keeps every tier segment the same size", () => {
    const css = SOURCE.slice(SOURCE.indexOf("const TIER_CSS"), SOURCE.indexOf("`;", SOURCE.indexOf("const TIER_CSS")));
    expect(css).toContain("grid-auto-columns:minmax(0,1fr)");
    const on = css.match(/\.tw-tier\.on\{([^}]*)\}/)[1];
    expect(on).not.toMatch(/padding|width|height|font-size|border:/);
  });

  // The refill line states the Budget/Standard/Premium assurance. "Option B" is
  // not a point on that ladder, and refillLabel would silently call it Premium
  // and promise lifetime refill — the exact shape of mistake that put a false
  // promise on 62 tiers once already.
  it("does not state a refill assurance for an option", () => {
    const select = SOURCE.slice(SOURCE.indexOf("<select"), SOURCE.indexOf("</select>"));
    expect(select).not.toContain("refillLabel");
    // The well, which only renders off the options branch, is the one place
    // the promise is printed, and only for a name on the ladder.
    expect(SOURCE).toContain("{onLadder ? tr(refillLabel(tier.tier)) :");
  });

  it("labels the control Option rather than Tier", () => {
    expect(SOURCE).toContain('isOptionPicker ? tr("Option")');
    expect(SOURCE).toContain('tr("Choose an option")');
  });

  // The card collapses itself when clicked while open. Tier chips escape that
  // because pickTier stops their click bubbling; a select fires `change`, which
  // is a different event from the click the card hears, so opening the dropdown
  // shut the card out from under it. Both handlers are what keep it open.
  it("keeps the card open when the dropdown is clicked", () => {
    const select = SOURCE.slice(SOURCE.indexOf("<select"), SOURCE.indexOf("</select>"));
    expect(select).toContain("onMouseDown={e => e.stopPropagation()}");
    expect(select).toContain("onClick={e => e.stopPropagation()}");
  });

  // Every option is a real tier row, so the order path is unchanged: the picker
  // hands back the same object the grid would have.
  it("selects a tier object, so ordering is untouched", () => {
    expect(SOURCE).toMatch(/svc\.tiers\.find\(x => x\.tier === e\.target\.value\)/);
    expect(SOURCE).toMatch(/if \(picked\) onPickTier\(picked, e\)/);
  });
});
