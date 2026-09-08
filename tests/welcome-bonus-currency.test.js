import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TIERS, USD_TIERS, BONUS_LADDERS, bonusPresetsFor, bonusForAmount, bonusForUsdCents, bonusKoboForDeposit } from "../lib/welcome-bonus";
import { nairaPerUnit } from "../lib/currency";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const RATE = 1529;
const FX = { depositRate: RATE, usdRates: { GBP: 0.739722, GHS: 11.364734, KES: 129.384717 } };

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
    expect(bonusPresetsFor("USD")).toEqual([
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

  it("caps free money near the naira cap in every currency, not far above it", () => {
    // Whatever the top bracket pays becomes the cap for a first deposit, however
    // large it is. Naira caps at ₦1,500; a foreign cap several times that is a
    // promotion nobody costed, and the premium that would fund one is switched
    // off. This is the assertion that stops a rounder, richer ladder slipping
    // in later without that being a decision someone made.
    const ngnCapKobo = TIERS[0].bonus;
    for (const [code, ladder] of Object.entries(BONUS_LADDERS)) {
      const perUnit = nairaPerUnit(code, FX);
      const capKobo = ladder[0].bonus * perUnit;
      expect(capKobo / ngnCapKobo, `${code} cap`).toBeGreaterThan(1);
      expect(capKobo / ngnCapKobo, `${code} cap`).toBeLessThan(2);
    }
  });

  it("opens every foreign ladder on 10 / 12 / 15%, like naira", () => {
    for (const [code, ladder] of Object.entries(BONUS_LADDERS)) {
      expect(ladder.map(t => Math.round((t.bonus / t.min) * 100)), code).toEqual([15, 12, 10]);
    }
  });

  it("pays each foreign ladder from its own rail, recovering the customer's figure exactly", () => {
    for (const [code, ladder] of Object.entries(BONUS_LADDERS)) {
      const perUnit = nairaPerUnit(code, FX);
      for (const rung of ladder) {
        const paidKobo = Math.ceil((rung.min / 100) * perUnit) * 100;   // they deposit exactly the rung
        const paid = bonusKoboForDeposit(paidKobo, code, perUnit);
        expect(paid, `${code} ${rung.min}`).toBe(Math.round(rung.bonus * perUnit));
      }
      // A deposit under the first rung earns nothing, in any currency.
      const under = Math.floor((ladder.at(-1).min / 100) * perUnit) * 100 - 100;
      expect(bonusKoboForDeposit(under, code, perUnit), `${code} under`).toBe(0);
    }
  });

  it("falls back to the naira ladder when the currency or the rate is unknown", () => {
    expect(bonusKoboForDeposit(1000000, "XYZ", 1529)).toBe(bonusForAmount(1000000));
    expect(bonusKoboForDeposit(1000000, "USD", null)).toBe(bonusForAmount(1000000));
    expect(bonusKoboForDeposit(1000000, "NGN", null)).toBe(bonusForAmount(1000000));
  });

  it("recovers the dollars from the kobo exactly, both ways", () => {
    for (const dollars of [2, 5, 10, 25, 100]) {
      const kobo = dollars * 100 * RATE;      // what the rail credits
      expect(Math.floor(kobo / RATE)).toBe(dollars * 100);  // cents back out
    }
  });

  it("is chosen by the customer's market, never by the rail or the display currency", () => {
    // Country, because the rail was the wrong question: it gave a Nigerian
    // paying USDT the dollar ladder, and made a US customer hunt for the
    // payment method before their own ladder appeared. Country is set from the
    // phone number at signup and only an admin can change it, so nobody picks
    // their own bonus. The display switcher must never reach this decision.
    expect(read("lib/deposit-finalization.js")).toContain("currencyForCountry(depositor?.country)");
    expect(read("components/addfunds-page.jsx")).toContain("currencyForCountry(user?.country)");
    expect(read("components/addfunds-page.jsx")).not.toContain('method === "crypto" ? "USD"');
    // The guarantee the whole display-currency design rests on: flipping the
    // switcher cannot change what you are paid.
    // Only the dollar-denominated rail names a foreign currency. Flutterwave is
    // still NGN-only; when it collects in cedi or shillings, that is the line
    // that changes, and it should be a deliberate edit, not a default.
    expect(read("lib/nowpayments-payment.js")).toContain("paymentCurrency: 'USD'");
    expect(read("lib/flutterwave-payment.js")).not.toMatch(/paymentCurrency:\s*'(?!NGN)/);
  });

  it("stays out of the browser's way — no database anywhere near the tier tables", () => {
    // This module is imported by the dashboard and the wallet for its tiers, so
    // an import that reaches Prisma bundles Prisma for the browser and the
    // dashboard stops loading. It did exactly that once.
    const src = read("lib/welcome-bonus.js");
    expect(src).not.toMatch(/from\s+['"][^'"]*prisma/);
    expect(src).not.toMatch(/from\s+['"][^'"]*fx-deposit/);
  });
});
