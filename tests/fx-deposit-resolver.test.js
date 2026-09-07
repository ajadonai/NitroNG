import { describe, it, expect } from "vitest";
import { resolveFromSettings, DEFAULT_PREMIUM_PERCENT } from "../lib/fx-deposit.js";
import { FALLBACK_DEPOSIT_RATE } from "../lib/currency.js";

// Values as the Setting table holds them: strings. Mirrors the live DB on
// 7 Sep 2026 — market ₦1,329 written by the cron, rate ₦1,529 = market + ₦200.
const LIVE = { markup_usd_market: "1329", markup_usd_rate: "1529" };

describe("deposit rate resolver", () => {
  describe("switch off — the legacy rate, byte-identical to before", () => {
    it("uses markup_usd_rate when fx_premium_live is absent", () => {
      const r = resolveFromSettings(LIVE);
      expect(r.depositRate).toBe(1529);
      expect(r.source).toBe("legacy");
      expect(r.live).toBe(false);
    });

    it("uses markup_usd_rate when fx_premium_live is '0'", () => {
      const r = resolveFromSettings({ ...LIVE, fx_premium_live: "0", fx_premium_percent: "15" });
      expect(r.depositRate).toBe(1529);
      expect(r.source).toBe("legacy");
    });

    it("a premium sitting in settings does nothing until the switch is on", () => {
      // This is the guarantee that shipping the nav button changes no invoice.
      const off = resolveFromSettings({ ...LIVE, fx_premium_percent: "15" });
      const before = resolveFromSettings(LIVE);
      expect(off.depositRate).toBe(before.depositRate);
    });
  });

  describe("switch on — market divided by (1 + premium)", () => {
    it("applies the configured premium", () => {
      const r = resolveFromSettings({ ...LIVE, fx_premium_live: "1", fx_premium_percent: "15" });
      expect(r.depositRate).toBeCloseTo(1329 / 1.15, 2);
      expect(r.source).toBe("premium");
      expect(r.live).toBe(true);
    });

    it("defaults the premium to 15% when unset", () => {
      const r = resolveFromSettings({ ...LIVE, fx_premium_live: "1" });
      expect(DEFAULT_PREMIUM_PERCENT).toBe(15);
      expect(r.premium).toBe(15);
      expect(r.depositRate).toBeCloseTo(1329 / 1.15, 2);
    });

    it("rounds to 2dp so the invoice BigInt scale stays sane", () => {
      const r = resolveFromSettings({ ...LIVE, fx_premium_live: "1", fx_premium_percent: "15" });
      expect(String(r.depositRate).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });

    it("the premium direction is right: fewer naira per dollar than market", () => {
      const r = resolveFromSettings({ ...LIVE, fx_premium_live: "1", fx_premium_percent: "15" });
      expect(r.depositRate).toBeLessThan(1329);
    });

    it("falls back to legacy if the switch is on but market is missing", () => {
      const r = resolveFromSettings({ markup_usd_rate: "1529", fx_premium_live: "1", fx_premium_percent: "15" });
      expect(r.depositRate).toBe(1529);
      expect(r.source).toBe("legacy");
    });
  });

  describe("nothing configured at all", () => {
    it("uses the module fallback, which matches today's crypto rate", () => {
      const r = resolveFromSettings({});
      expect(r.depositRate).toBe(FALLBACK_DEPOSIT_RATE);
      expect(r.source).toBe("fallback");
    });
  });

  describe("cross rates", () => {
    it("parses the cron's JSON and drops junk", () => {
      const r = resolveFromSettings({ ...LIVE, fx_usd_rates: JSON.stringify({ GBP: 0.74, GHS: "11.36", KES: 129.38, BAD: "x", NEG: -1 }) });
      expect(r.usdRates).toEqual({ GBP: 0.74, GHS: 11.36, KES: 129.38 });
    });

    it("survives malformed JSON with an empty map, never a throw", () => {
      const r = resolveFromSettings({ ...LIVE, fx_usd_rates: "{not json" });
      expect(r.usdRates).toEqual({});
      expect(r.depositRate).toBe(1529);
    });
  });
});
