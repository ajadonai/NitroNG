import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIER_LADDER, compareTiers, isLadderTier, sortTiers, tierRank } from "@/lib/tier-order";

/**
 * Instagram Followers rendered Standard, Budget, Premium because the catalogue
 * ordered tiers by whatever sortOrder Menu Builder had saved, and that group's
 * were 2, 3, 4 in the wrong pairing. Fixing the row fixed one group of 167.
 * This is the part that stops it being possible.
 *
 * The order is the ladder Nitro offers, by NAME. It is not a price sort, and
 * the test below pins that: Snapchat Followers really does sell Budget dearer
 * than Standard, so anything sorting on sellPer1k would reorder it.
 */
describe("the tier ladder decides its own order", () => {
  const row = (tier, sortOrder) => ({ tier, sortOrder });

  it("renders in ladder order however the numbers were saved", () => {
    // The exact shape that shipped.
    const asStored = [row("Standard", 2), row("Budget", 3), row("Premium", 4)];
    expect(sortTiers(asStored).map(t => t.tier)).toEqual(["Budget", "Standard", "Premium"]);
  });

  it("does not care if every tier shares one number", () => {
    const flat = [row("Premium", 0), row("Budget", 0), row("Standard", 0)];
    expect(sortTiers(flat).map(t => t.tier)).toEqual(["Budget", "Standard", "Premium"]);
  });

  it("does not care if the numbers are reversed", () => {
    const backwards = [row("Budget", 99), row("Standard", 50), row("Premium", 1)];
    expect(sortTiers(backwards).map(t => t.tier)).toEqual(["Budget", "Standard", "Premium"]);
  });

  // WhatsApp Poll Votes. The letter picks which answer gets the votes, so one
  // is not better than another and the author's order is the only one that
  // means anything.
  it("leaves option groups in the order they were given", () => {
    const options = ["E", "D", "C", "B", "A"].map((l, i) => row(`Option ${l}`, 4 - i));
    expect(sortTiers(options).map(t => t.tier)).toEqual(
      ["Option A", "Option B", "Option C", "Option D", "Option E"],
    );
  });

  it("falls back to the stored number for names it does not know", () => {
    const odd = [row("Gold", 2), row("Silver", 1), row("Bronze", 0)];
    expect(sortTiers(odd).map(t => t.tier)).toEqual(["Bronze", "Silver", "Gold"]);
  });

  // A ladder rung beside a variant is nonsense we should not try to interpret.
  it("uses the stored number when only one side is a rung", () => {
    expect(compareTiers(row("Budget", 5), row("Option A", 1))).toBeGreaterThan(0);
    expect(compareTiers(row("Budget", 0), row("Option A", 3))).toBeLessThan(0);
  });

  // Snapchat Followers, as actually priced on 15 Oct 2026: Budget ₦37,882,
  // Standard ₦37,672. A tier is a promise about quality and refill, not a
  // position in a price list, so the dearer Budget still comes first.
  it("keeps ladder order when the price runs backwards", () => {
    const snapchat = [
      row("Premium", 0), { ...row("Standard", 1), sellPer1k: 3767200 },
      { ...row("Budget", 2), sellPer1k: 3788200 },
    ];
    expect(sortTiers(snapchat).map(t => t.tier)).toEqual(["Budget", "Standard", "Premium"]);
  });

  it("never mutates what it is given", () => {
    const input = [row("Premium", 0), row("Budget", 1)];
    const copy = [...input];
    sortTiers(input);
    expect(input).toEqual(copy);
  });

  it("survives junk", () => {
    expect(sortTiers(null)).toEqual([]);
    expect(sortTiers(undefined)).toEqual([]);
    expect(tierRank("Nonsense")).toBeNull();
    expect(isLadderTier("Budget")).toBe(true);
    expect(isLadderTier("Option A")).toBe(false);
    expect(TIER_LADDER).toEqual(["Budget", "Standard", "Premium"]);
  });
});

describe("every surface that lists tiers uses it", () => {
  // The bug was one consumer trusting the database. Both of them are checked
  // here so a third cannot quietly go back to a raw orderBy.
  it.each([
    ["lib/service-catalog.js", "the storefront menu"],
    ["app/api/admin/service-groups/route.js", "Menu Builder"],
  ])("%s orders through sortTiers (%s)", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("@/lib/tier-order");
    expect(src).toMatch(/sortTiers\(/);
  });

  // Reordering by hand is still right for option groups and meaningless for the
  // ladder, so the endpoint refuses that case out loud rather than appearing to
  // work and changing nothing.
  it("refuses to hand-reorder two ladder rungs", () => {
    const src = readFileSync("app/api/admin/service-groups/route.js", "utf8");
    expect(src).toMatch(/isLadderTier\(a\.tier\) && isLadderTier\(b\.tier\)/);
    expect(src).toContain("always show in that order");
  });
});
