import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TIERS, USD_TIERS, USD_BONUS_PRESETS, bonusForAmount, bonusForUsdCents } from "../lib/welcome-bonus";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const RATE = 1529;

/**
 * The dollar ladder is the naira one's shape in another unit: a bracket you
 * enter, one fixed bonus for the whole bracket. What it must never become is a
 * second offer a customer can choose between — the ladder follows the rail the
 * money arrives on, not the currency on screen.
 */
describe("welcome bonus — one ladder per rail", () => {
  it("brackets hold across their whole range, not just at the entry point", () => {
    // ₦2,500 opens the 10% bracket and ₦4,999 is still in it.
    expect(bonusForAmount(250000)).toBe(25000);
    expect(bonusForAmount(499900)).toBe(25000);
    expect(bonusForAmount(500000)).toBe(60000);
    // $2 opens the same bracket in dollars, $4.99 is still in it.
    expect(bonusForUsdCents(200)).toBe(20);
    expect(bonusForUsdCents(499)).toBe(20);
    expect(bonusForUsdCents(500)).toBe(60);
  });

  it("shows the cards derived from the ladder, so the offer cannot drift from the payout", () => {
    expect(USD_BONUS_PRESETS).toEqual([
      { amount: 2, bonus: 0.2 },
      { amount: 5, bonus: 0.6, tag: "Best value" },
      { amount: 10, bonus: 1.5 },
    ]);
  });

  it("pays nothing below the first rung, in either currency", () => {
    expect(bonusForAmount(249900)).toBe(0);
    expect(bonusForUsdCents(199)).toBe(0);
  });

  it("opens each bracket on the agreed percentage", () => {
    for (const { min, bonus } of USD_TIERS) {
      expect(Math.round((bonus / min) * 100)).toBeGreaterThanOrEqual(10);
    }
    expect(USD_TIERS.map(t => Math.round((t.bonus / t.min) * 100))).toEqual([15, 12, 10]);
    expect(TIERS.map(t => Math.round((t.bonus / t.min) * 100))).toEqual([15, 12, 10]);
  });

  it("caps free money near the naira cap, not far above it", () => {
    // Whatever the top bracket pays becomes the cap for a first deposit, however
    // large. Naira caps at ₦1,500; the dollar cap must stay in the same order of
    // magnitude, or the ladder is a promotion nobody costed.
    const usdCapKobo = USD_TIERS[0].bonus * RATE;
    const ngnCapKobo = TIERS[0].bonus;
    expect(usdCapKobo / ngnCapKobo).toBeLessThan(2);
  });

  it("recovers the dollars from the kobo exactly, both ways", () => {
    for (const dollars of [2, 5, 10, 25, 100]) {
      const kobo = dollars * 100 * RATE;      // what the rail credits
      expect(Math.floor(kobo / RATE)).toBe(dollars * 100);  // cents back out
    }
  });

  it("is chosen by the rail, never by the display currency", () => {
    // The guarantee the whole display-currency design rests on: flipping the
    // switcher cannot change what you are paid.
    const src = read("lib/welcome-bonus.js");
    expect(src).toContain("async function bonusKoboForDeposit(depositKobo, paymentCurrency = 'NGN')");
    expect(src).toContain("if (paymentCurrency !== 'USD') return bonusForAmount(depositKobo);");
    // Only the dollar-denominated rail asks for the dollar ladder.
    expect(read("lib/nowpayments-payment.js")).toContain("paymentCurrency: 'USD'");
    expect(read("lib/flutterwave-payment.js")).not.toContain("paymentCurrency: 'USD'");
  });

  it("falls back to the naira ladder if the rate cannot be resolved, rather than paying nothing", () => {
    const src = read("lib/welcome-bonus.js");
    expect(src).toContain("if (!Number.isFinite(depositRate) || depositRate <= 0) return bonusForAmount(depositKobo);");
  });
});
