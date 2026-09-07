import { describe, it, expect } from "vitest";
import {
  CURRENCIES,
  BASE_CURRENCY,
  FALLBACK_DEPOSIT_RATE,
  convertFromNaira,
  creditForDollars,
  depositRateForPremium,
  impliedPremiumPercent,
  isActive,
  canDisplay,
  formatMoney,
  formatDisplayPrice,
} from "../lib/currency.js";

// Real figures, 7 Sep 2026: official mid-market from the FX cron's API, and
// the rate the crypto rail actually credits at today (market + ₦200 cushion).
const MARKET = 1329;
const TODAY = 1529;
const PREMIUM_20 = 1107.5; // 1329 / 1.2 — a 20% premium expressed as a rate
const RATES = { GBP: 0.74, GHS: 11.36, KES: 129.38 };
const at = (depositRate, code = "USD") => ({ code, depositRate, usdRates: RATES });

describe("display currency — one deposit rate, read both ways", () => {
  describe("deposit and display are exact inverses", () => {
    it("what a dollar credits is what a dollar shows", () => {
      for (const rate of [TODAY, MARKET, PREMIUM_20, 1000, 2000]) {
        for (const usd of [1, 100, 65.4, 0.07, 12345.67]) {
          const naira = creditForDollars(usd, rate);
          expect(convertFromNaira(naira, at(rate))).toBeCloseTo(usd, 9);
        }
      }
    });

    it("$100 credits ₦152,900 at today's rate, and ₦152,900 reads back as $100", () => {
      expect(creditForDollars(100, TODAY)).toBe(152900);
      expect(convertFromNaira(152900, at(TODAY))).toBe(100);
    });

    it("the shown dollar price is naira divided by the deposit rate — nothing else", () => {
      expect(convertFromNaira(2490, at(TODAY))).toBeCloseTo(2490 / 1529, 12);
      expect(convertFromNaira(12500, at(MARKET))).toBeCloseTo(12500 / 1329, 12);
    });
  });

  describe("the premium is the rate, not a percentage in the maths", () => {
    it("a lower deposit rate means a higher foreign price — the premium direction", () => {
      const cheap = convertFromNaira(2490, at(TODAY));
      const dear = convertFromNaira(2490, at(PREMIUM_20));
      expect(dear).toBeGreaterThan(cheap);
    });

    it("matches the worked examples at the real base", () => {
      // What a USDT payer sees today, with no premium
      expect(convertFromNaira(2490, at(TODAY))).toBeCloseTo(1.63, 2);
      // The same item under a 20% premium
      expect(convertFromNaira(2490, at(PREMIUM_20))).toBeCloseTo(2.25, 2);
      expect(creditForDollars(100, PREMIUM_20)).toBeCloseTo(110750, 0);
    });

    it("implied premium reads correctly for the admin screen", () => {
      expect(impliedPremiumPercent(PREMIUM_20, MARKET)).toBeCloseTo(20, 6);
      expect(impliedPremiumPercent(MARKET, MARKET)).toBeCloseTo(0, 9);
      // Today's rate credits ABOVE market: a negative premium, i.e. a subsidy.
      expect(impliedPremiumPercent(TODAY, MARKET)).toBeLessThan(0);
      expect(impliedPremiumPercent(TODAY, MARKET)).toBeCloseTo(-13.08, 1);
    });

    it("the fallback rate is today's crypto rate, so nothing moves on day one", () => {
      expect(FALLBACK_DEPOSIT_RATE).toBe(TODAY);
    });
  });

  describe("naira never converts", () => {
    it("returns the naira figure untouched at any rate", () => {
      expect(convertFromNaira(12500, at(TODAY, "NGN"))).toBe(12500);
      expect(convertFromNaira(12500, at(PREMIUM_20, "NGN"))).toBe(12500);
    });

    it("prints bare, with no approximation marker", () => {
      expect(formatDisplayPrice(12500, at(TODAY, "NGN"))).toBe("₦12,500");
      expect(formatDisplayPrice(12500, at(TODAY, "NGN"))).not.toContain("≈");
    });
  });

  describe("switching the display currency cannot dodge the premium", () => {
    // The premium is charged on the way IN — inside the exchange at deposit.
    // The display is only a lens on what is already in the wallet, so flipping
    // it afterwards changes nothing. This is why the premium lives in the
    // deposit rate and not in the price display: put it in the display and
    // switching to naira WOULD dodge it.
    const market = 1324, premium = 15;
    const rate = depositRateForPremium(market, premium);
    const price = 2490;

    it("a foreigner who deposits $100 then switches to naira buys exactly as much", () => {
      const credited = creditForDollars(100, rate);          // what landed in the wallet
      const inNaira = Math.floor(credited / price);            // shopping with naira on screen
      const shownBal = convertFromNaira(credited, at(rate));   // shopping with dollars on screen
      const shownPrice = convertFromNaira(price, at(rate));
      const inUsd = Math.floor(shownBal / shownPrice);
      expect(inNaira).toBe(inUsd);
    });

    it("and buys LESS than a Nigerian who deposited the same value in naira", () => {
      const foreigner = Math.floor(creditForDollars(100, rate) / price);          // paid the premium
      const local = Math.floor(creditForDollars(100, market) / price);           // ₦ worth $100 at market
      expect(foreigner).toBeLessThan(local);
    });

    it("the only way to avoid it is to not deposit dollars — display has no effect", () => {
      const credited = creditForDollars(100, rate);
      for (const code of ["NGN", "USD", "GBP", "GHS", "KES"]) {
        // Whatever unit is on screen, the naira in the wallet is identical.
        expect(credited).toBeCloseTo(100 * rate, 9);
        expect(convertFromNaira(credited, at(rate, "NGN"))).toBe(credited);
      }
    });
  });

  describe("premium as a percentage", () => {
    it("derives the deposit rate from market and premium", () => {
      expect(depositRateForPremium(1324, 15)).toBeCloseTo(1151.30, 2);
      expect(depositRateForPremium(1324, 10)).toBeCloseTo(1203.64, 2);
      expect(depositRateForPremium(1324, 0)).toBe(1324);
    });

    it("round-trips with impliedPremiumPercent", () => {
      for (const p of [0, 5, 10, 15, 20, 35]) {
        expect(impliedPremiumPercent(depositRateForPremium(1324, p), 1324)).toBeCloseTo(p, 9);
      }
    });

    it("15% is about ₦173 off today's market, and a flat naira amount drifts as the naira moves", () => {
      expect(depositRateForPremium(1324, 15)).toBeCloseTo(1324 - 173, 0);
      // The same 15% at a weaker naira is a bigger naira gap — which is exactly
      // why the setting is a percentage and not "minus ₦200".
      expect(depositRateForPremium(1600, 15)).not.toBeCloseTo(1600 - 173, 0);
      expect(1600 - depositRateForPremium(1600, 15)).toBeGreaterThan(173);
    });

    it("refuses nonsense", () => {
      expect(depositRateForPremium(0, 15)).toBeNull();
      expect(depositRateForPremium(1324, -100)).toBeNull();
      expect(depositRateForPremium("x", 15)).toBeNull();
    });
  });

  describe("a balance converts on exactly the same rate as a price", () => {
    it("so 'can I afford this' has the same answer in either unit", () => {
      const balance = 150000, price = 2490;
      const inNaira = Math.floor(balance / price);
      const inUsd = Math.floor(convertFromNaira(balance, at(TODAY)) / convertFromNaira(price, at(TODAY)));
      expect(inUsd).toBe(inNaira);
    });
  });

  describe("cross rates", () => {
    it("converts through USD", () => {
      const usd = convertFromNaira(12500, at(TODAY));
      expect(convertFromNaira(12500, at(TODAY, "GBP"))).toBeCloseTo(usd * RATES.GBP, 9);
      expect(convertFromNaira(12500, at(TODAY, "GHS"))).toBeCloseTo(usd * RATES.GHS, 9);
      expect(convertFromNaira(12500, at(TODAY, "KES"))).toBeCloseTo(usd * RATES.KES, 9);
    });

    it("covers every currency the switcher offers", () => {
      for (const code of Object.keys(CURRENCIES)) {
        expect(convertFromNaira(5000, at(TODAY, code))).not.toBeNull();
      }
    });
  });

  describe("missing or bad data falls back to naira rather than guessing", () => {
    it("returns null without a deposit rate", () => {
      expect(convertFromNaira(1000, { code: "USD" })).toBeNull();
      expect(convertFromNaira(1000, { code: "USD", depositRate: 0 })).toBeNull();
      expect(convertFromNaira(1000, { code: "USD", depositRate: -5 })).toBeNull();
    });

    it("returns null when a cross rate is missing", () => {
      expect(convertFromNaira(1000, { code: "GBP", depositRate: TODAY, usdRates: {} })).toBeNull();
    });

    it("returns null for an unknown currency", () => {
      expect(convertFromNaira(1000, at(TODAY, "XYZ"))).toBeNull();
    });

    it("creditForDollars refuses nonsense", () => {
      expect(creditForDollars(-1, TODAY)).toBeNull();
      expect(creditForDollars(100, 0)).toBeNull();
      expect(creditForDollars("abc", TODAY)).toBeNull();
    });

    it("formatDisplayPrice shows naira when conversion is unavailable", () => {
      expect(formatDisplayPrice(12500, { code: "USD" })).toBe("₦12,500");
      expect(formatDisplayPrice(12500, { code: "GBP", depositRate: TODAY, usdRates: {} })).toBe("₦12,500");
    });
  });

  describe("formatting", () => {
    it("marks every foreign price as approximate", () => {
      for (const code of ["USD", "GBP", "GHS", "KES"]) {
        expect(formatDisplayPrice(12500, at(TODAY, code)).startsWith("≈ ")).toBe(true);
      }
    });

    it("uses whole units for naira and shillings, decimals elsewhere", () => {
      expect(formatMoney(1234.56, "NGN")).toBe("₦1,235");
      expect(formatMoney(1234.56, "KES")).toBe("KSh1,235");
      expect(formatMoney(1234.56, "USD")).toBe("$1,234.56");
      expect(formatMoney(1234.5, "GBP")).toBe("£1,234.50");
      expect(formatMoney(9.876, "GHS")).toBe("₵9.88");
    });

    it("keeps the minus sign outside the symbol", () => {
      expect(formatMoney(-500, "NGN")).toBe("-₦500");
    });
  });

  describe("active vs merely supported — the pre-Flutterwave gate", () => {
    // GBP/GHS/KES convert correctly today (the math and the cross rates are
    // ready) but nobody can actually pay Nitro in them: Flutterwave is
    // hardcoded to NGN and the only foreign rail is dollar-denominated USDT.
    // `active` is what the switcher gates on; it must not be conflated with
    // "this module knows how to convert it", which conversion still needs.
    it("only NGN and USD are active until a rail exists for the rest", () => {
      expect(isActive("NGN")).toBe(true);
      expect(isActive("USD")).toBe(true);
      expect(isActive("GBP")).toBe(false);
      expect(isActive("GHS")).toBe(false);
      expect(isActive("KES")).toBe(false);
    });

    it("an inactive currency still converts — the rail is missing, not the maths", () => {
      expect(convertFromNaira(2490, { code: "GBP", depositRate: 1151, usdRates: { GBP: 0.74 } })).not.toBeNull();
    });

    it("unknown codes are never active", () => {
      expect(isActive("XYZ")).toBe(false);
      expect(isActive(undefined)).toBe(false);
    });
  });

  describe("canDisplay — what the picker is allowed to offer", () => {
    // The day GBP's rail goes live, someone flips one boolean. If the FX cron
    // had not written a GBP cross rate, the menu would offer it and every price
    // would quietly stay in naira — a switch that looks broken. The picker asks
    // canDisplay so that cannot happen. These tests flip `active` the way that
    // day will, and restore it, so they describe the future rather than today.
    const withActive = (code, fn) => {
      const was = CURRENCIES[code].active;
      CURRENCIES[code].active = true;
      try { fn(); } finally { CURRENCIES[code].active = was; }
    };

    it("naira needs no rate — always offerable", () => {
      expect(canDisplay("NGN", {})).toBe(true);
    });

    it("dollars need the deposit rate", () => {
      expect(canDisplay("USD", {})).toBe(false);
      expect(canDisplay("USD", { depositRate: 1151 })).toBe(true);
    });

    it("an inactive currency is never offered, rate or no rate", () => {
      expect(canDisplay("GBP", { depositRate: 1151, usdRates: { GBP: 0.74 } })).toBe(false);
    });

    it("activating a currency offers it only once its cross rate exists", () => {
      withActive("GBP", () => {
        expect(canDisplay("GBP", { depositRate: 1151, usdRates: {} })).toBe(false);
        expect(canDisplay("GBP", { depositRate: 1151, usdRates: { GBP: 0.739722 } })).toBe(true);
      });
    });

    it("a cross rate without a deposit rate is not enough", () => {
      withActive("KES", () => {
        expect(canDisplay("KES", { usdRates: { KES: 129.384717 } })).toBe(false);
      });
    });

    it("unknown codes are never offerable", () => {
      expect(canDisplay("XYZ", { depositRate: 1151 })).toBe(false);
    });
  });

  it("base currency and the offered set are the agreed ones", () => {
    expect(BASE_CURRENCY).toBe("NGN");
    expect(Object.keys(CURRENCIES)).toEqual(["NGN", "USD", "GBP", "GHS", "KES"]);
  });
});
