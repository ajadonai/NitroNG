import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TIERS, BONUS_PRESETS, bonusForAmount, bonusForNaira, MAX_BONUS_NAIRA } from "../lib/welcome-bonus";
import { formatDisplayPrice } from "../lib/currency";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * One welcome-bonus ladder, in naira, for every customer — whatever currency
 * they read the site in and whatever rail they pay on. Per-currency ladders
 * were built and removed the same day (8 Sep 2026): they needed keying, a rate
 * lookup at credit time and a fairness argument per currency, and bought
 * nothing the deposit rate does not already do. This file exists so nobody
 * rebuilds them without meaning to.
 */
describe("welcome bonus — one ladder for everyone", () => {
  // This file is the one place the ladder's figures are written down. Every
  // other test reads them from bonusForAmount, so changing a rung touches this
  // file and nothing else — the 1 Sep cut and the 14 Sep restore each broke six
  // unrelated IP-guard tests before that was true.
  it("is a bracket, not a decaying percentage", () => {
    // ₦2,500 opens the 20% bracket and ₦4,999 is still in it. Trip's rule.
    expect(bonusForAmount(250000)).toBe(50000);
    expect(bonusForAmount(499900)).toBe(50000);
    expect(bonusForAmount(500000)).toBe(120000);
    expect(bonusForAmount(999900)).toBe(120000);
    expect(bonusForAmount(1000000)).toBe(300000);
    expect(bonusForAmount(249900)).toBe(0);
  });

  it("opens each bracket on 20 / 24 / 30%", () => {
    expect(TIERS.map(t => Math.round((t.bonus / t.min) * 100))).toEqual([30, 24, 20]);
  });

  it("caps free money at the top bracket, however large the deposit", () => {
    expect(bonusForAmount(100000000)).toBe(300000);
    expect(MAX_BONUS_NAIRA).toBe(3000);
  });

  it("shows the cards from the same table it pays from", () => {
    for (const card of BONUS_PRESETS) {
      expect(bonusForNaira(card.amount)).toBe(card.bonus);
    }
  });

  it("converts the same figures for a foreign reader rather than offering a different deal", () => {
    // Not round, and not meant to be. The rule is round; the figures follow the rate.
    const fx = { code: "USD", depositRate: 1529 };
    expect(formatDisplayPrice(2500, fx)).toBe("≈ $1.64");
    expect(formatDisplayPrice(250, { ...fx, round: "down" })).toBe("≈ $0.16");
  });

  it("has no per-currency ladder, no country keying and no rate lookup at credit time", () => {
    const bonus = read("lib/welcome-bonus.js");
    expect(bonus).not.toMatch(/USD_TIERS|BONUS_LADDERS|bonusPresetsFor|nairaPerUnit|paymentCurrency/);
    // And nothing that would drag Prisma into the browser — this module is
    // imported by the dashboard for its tier tables.
    expect(bonus).not.toMatch(/from\s+['"][^'"]*(prisma|fx-deposit)/);

    const finalization = read("lib/deposit-finalization.js");
    expect(finalization).not.toMatch(/currencyForCountry|ladderCurrency|paymentCurrency/);

    const wallet = read("components/addfunds-page.jsx");
    expect(wallet).toContain("{BONUS_PRESETS.map(p => {");
    expect(wallet).not.toMatch(/bonusPresetsFor|railLadder|foreignLadder/);
  });
});
