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
  CURRENCY_CODES,
  depositPresets,
  DEPOSIT_PRESETS,
  MIN_DEPOSIT_NAIRA,
  MAX_DEPOSIT_NAIRA,
  convertToNaira,
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

  describe("active vs merely supported", () => {
    // All five are offered now (8 Sep 2026). `active` gates only what the
    // PICKER shows — the unit prices are read in. It never gated conversion,
    // and it does not gate payment: Flutterwave still collects naira and the
    // only foreign rail is USDT, which is why the deposit box prints the naira
    // that will actually be charged underneath whatever you are reading.
    it("offers naira and marks the other four Soon", () => {
      // The four foreign units are a product gate, not broken maths: the picker
      // renders its Soon branch for anything inactive. Flipping one back to
      // true in lib/currency.js is the whole of shipping it.
      expect(isActive("NGN")).toBe(true);
      for (const code of CURRENCY_CODES.filter((c) => c !== "NGN")) {
        expect(isActive(code), code).toBe(false);
      }
    });

    it("still refuses to convert without a rate, active or not", () => {
      expect(convertFromNaira(2490, { code: "GBP", depositRate: 1151, usdRates: {} })).toBeNull();
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
      // USD is gated off today, so activate it here: the point of this test is
      // the rate requirement, which must keep holding for whenever it ships.
      const was = CURRENCIES.USD.active;
      CURRENCIES.USD.active = true;
      try {
        expect(canDisplay("USD", {})).toBe(false);
        expect(canDisplay("USD", { depositRate: 1151 })).toBe(true);
      } finally {
        CURRENCIES.USD.active = was;
      }
    });

    it("an inactive currency is not offered even with a live rate", () => {
      expect(canDisplay("USD", { depositRate: 1151 })).toBe(false);
    });

    it("a currency turned off is never offered, rate or no rate", () => {
      // Nothing is off today, so this turns one off to prove the gate still
      // works — it is what protects the picker if a rail is ever withdrawn.
      const was = CURRENCIES.GBP.active;
      CURRENCIES.GBP.active = false;
      try {
        expect(canDisplay("GBP", { depositRate: 1151, usdRates: { GBP: 0.74 } })).toBe(false);
      } finally { CURRENCIES.GBP.active = was; }
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

  describe("rounding has a direction — the house rule, in the display layer", () => {
    // The catalogue ceils to whole naira (markup.js) and every order step ceils
    // again, because a price quoted below the real charge got customers refused
    // with "insufficient balance" for an order the screen said they could
    // afford. The display layer has to keep the same discipline, and a balance
    // is the mirror of a price: never show more money than someone holds.
    it("a price never displays below the real charge", () => {
      // ₦2,480 ÷ 1529 = $1.62197… — to-nearest would print $1.62.
      expect(formatDisplayPrice(2480, { code: "USD", depositRate: 1529 })).toBe("≈ $1.63");
    });

    it("a balance never displays above what is held", () => {
      // 473,460 kobo is a real production balance: ₦4,734.60, shown as ₦4,735.
      expect(formatMoney(4734.6, "NGN", { round: "down" })).toBe("₦4,734");
      expect(formatDisplayPrice(4734.6, { code: "USD", depositRate: 1529, round: "down" })).toBe("≈ $3.09");
    });

    it("an exact figure is left alone in both directions", () => {
      expect(formatMoney(1500, "NGN")).toBe("₦1,500");
      expect(formatMoney(1500, "NGN", { round: "down" })).toBe("₦1,500");
      expect(formatDisplayPrice(1529, { code: "USD", depositRate: 1529 })).toBe("≈ $1.00");
    });

    it("a debit rounds by magnitude, so what is owed is never understated", () => {
      expect(formatMoney(-4734.6, "NGN")).toBe("-₦4,735");
    });

    it("what a screen shows can never make an unaffordable order look affordable", () => {
      // The invariant the whole rule exists for: if the displayed balance covers
      // the displayed price, the real balance covers the real charge.
      const rate = 1529;
      for (let kobo = 0; kobo < 400; kobo++) {
        const balance = 4700 + kobo / 100;
        for (const price of [4700, 4701, 4702, 4703, 4704]) {
          for (const code of ["NGN", "USD"]) {
            const shownBal = formatMoney(
              convertFromNaira(balance, { code, depositRate: rate }), code, { round: "down" });
            const shownPrice = formatMoney(
              convertFromNaira(price, { code, depositRate: rate }), code);
            const num = str => Number(str.replace(/[^0-9.]/g, ""));
            if (num(shownBal) >= num(shownPrice)) expect(balance).toBeGreaterThanOrEqual(price);
          }
        }
      }
    });
  });

  describe("deposit quick-picks are native to each currency, not converted", () => {
    // Live rates the day this was written. The point of the ladders is that
    // every button is a figure someone would type AND one the gateway will
    // accept — a quick-pick that fails on tap is worse than no quick-pick.
    const RATES = { depositRate: 1529, usdRates: { GBP: 0.739722, GHS: 11.364734, KES: 129.384717 } };

    it("offers a ladder for every currency the switcher lists", () => {
      expect(Object.keys(DEPOSIT_PRESETS).sort()).toEqual([...CURRENCY_CODES].sort());
    });

    it("is not the naira ladder converted — nobody chooses $32.70", () => {
      const asUsd = DEPOSIT_PRESETS.NGN.map(n => convertFromNaira(n, { ...RATES, code: "USD" }));
      expect(asUsd).not.toEqual(DEPOSIT_PRESETS.USD);
      expect(DEPOSIT_PRESETS.USD.every(Number.isInteger)).toBe(true);
    });

    it("every button clears the gateway minimum once converted to naira", () => {
      for (const code of CURRENCY_CODES) {
        for (const preset of depositPresets(code)) {
          const naira = convertToNaira(preset, { ...RATES, code });
          expect(naira, `${code} ${preset}`).toBeGreaterThanOrEqual(MIN_DEPOSIT_NAIRA);
          expect(naira, `${code} ${preset}`).toBeLessThanOrEqual(MAX_DEPOSIT_NAIRA);
        }
      }
    });

    it("climbs, and falls back to naira for anything unknown", () => {
      for (const code of CURRENCY_CODES) {
        const p = depositPresets(code);
        expect(p).toEqual([...p].sort((a, b) => a - b));
      }
      expect(depositPresets("XYZ")).toEqual(DEPOSIT_PRESETS.NGN);
    });
  });

  it("base currency and the offered set are the agreed ones", () => {
    expect(BASE_CURRENCY).toBe("NGN");
    expect(Object.keys(CURRENCIES)).toEqual(["NGN", "USD", "GBP", "GHS", "KES"]);
  });
});
