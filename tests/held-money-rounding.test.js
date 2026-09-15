import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fHeld, fN } from "../lib/format";
import { formatDisplayPrice } from "../lib/currency";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * Balances live in the database as kobo and reach the screen as kobo ÷ 100, so
 * they can carry a fraction — 104 accounts held one when this was written, 60
 * of them rounding up. A balance shown higher than it is puts a price the
 * server will refuse under a figure that says it is affordable, and a locked
 * cash-out button under a total that says it should be unlocked. Prices round
 * the other way, for the same reason from the other side.
 */
describe("money someone holds never rounds up", () => {
  it("floors the fraction instead of rounding it", () => {
    expect(fHeld(4734.6)).toBe("₦4,734");   // a real production balance
    expect(fN(4734.6)).toBe("₦4,735");      // what a price would show
    expect(fHeld(4734)).toBe("₦4,734");     // exact figures are untouched
    expect(fHeld(0)).toBe("₦0");
  });

  it("survives null and rubbish, because a missing balance is not a debit", () => {
    expect(fHeld(undefined)).toBe("₦0");
    expect(fHeld(null)).toBe("₦0");
    expect(fHeld("abc")).toBe("₦0");
  });

  it("is used wherever a customer reads their own money", () => {
    // Two ways to floor, and which one a surface needs depends on whether the
    // figure follows the currency picker. money(…, { round: "down" }) converts
    // AND floors — proven below for every currency — so it is what a wallet
    // balance uses. fHeld floors in naira alone, which is right for a payout:
    // the money leaves to a Nigerian bank account in naira whatever the page
    // is being read in. The wallet page used fHeld until 14 Sep 2026 and so
    // stayed in naira while everything around it converted.
    expect(read("components/dashboard-overview.jsx")).toContain('money(balance, { round: "down" })');
    expect(read("components/dashboard.jsx")).toContain('money(user?.balance || 0, { round: "down" })');
    expect(read("components/addfunds-page.jsx")).toContain('money(balance, { round: "down" })');
    expect(read("components/m/payouts-page.jsx")).toContain("fHeld(data?.availableBalance || 0)");
  });

  it("floors a converted balance too — a picker must not round money up", () => {
    const fx = { depositRate: 1155.65, usdRates: { GHS: 11.413414, KES: 129.445665, GBP: 0.739517 } };
    for (const [code, held, price] of [
      ["USD", "≈ $4.09", "≈ $4.10"],
      ["GHS", "≈ ₵46.75", "≈ ₵46.76"],
      ["KES", "≈ KSh530", "≈ KSh531"],
      ["GBP", "≈ £3.02", "≈ £3.03"],
    ]) {
      expect(formatDisplayPrice(4734.6, { code, round: "down", ...fx }), code).toBe(held);
      expect(formatDisplayPrice(4734.6, { code, ...fx }), code).toBe(price);
    }
  });


  it("the welcome bonus never rounds up — it is a promise, not a price", () => {
    // Caught on the landing hero when the top rung was ₦1,500: ÷ 1529 = $0.98103,
    // which rounded like a price reads $0.99 and offers a cent that is not given.
    // Trip found it there after it was already fixed on the dashboard, so the
    // check covers every surface that quotes the figure, at whatever the rung is.
    const dir = path.join(process.cwd(), "components");
    const offenders = fs.readdirSync(dir, { recursive: true })
      .filter(f => typeof f === "string" && f.endsWith(".jsx"))
      .filter(f => fs.readFileSync(path.join(dir, f), "utf8").includes("money(MAX_BONUS_NAIRA)"));
    expect(offenders).toEqual([]);
  });

  it("leaves the shortfall rounding up — never understate what must be added", () => {
    const form = read("components/order-form.jsx");
    // The sentence around these two figures is split for translation, so the
    // words between them move. What must not move is the direction of each
    // rounding: the balance down (never show more than is held), the shortfall
    // up (never understate what must be added).
    expect(form).toMatch(/\{money\(balance, \{ round: "down" \}\)\}[^\n]*\{money\(price - balance\)\}/);
  });

  it("does not round the balance before formatting it, which is what rounded it up", () => {
    expect(read("components/dashboard.jsx")).not.toContain("money(Math.round(user?.balance");
  });
});
