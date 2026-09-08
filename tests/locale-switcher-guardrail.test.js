import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * The currency picker must never offer a currency that would not actually
 * change the prices. Turning GBP, the cedi or the shilling on is meant to be
 * one boolean in lib/currency.js — these assertions are what makes that true,
 * because the failure they prevent is silent: the menu offers the currency,
 * the customer picks it, and every price stays in naira.
 */
describe("currency picker — offered means convertible", () => {
  const switcher = read("components/locale-switcher.jsx");
  const provider = read("components/locale.jsx");

  it("gates each option on a rate being there, not on `active` alone", () => {
    expect(switcher).toContain("canDisplay(code, fx)");
    // The raw flag on its own would put an unconvertible currency in the menu.
    expect(switcher).not.toMatch(/disabled=\{!c\.active\}/);
  });

  it("treats rates still in flight as unknown rather than missing", () => {
    expect(switcher).toContain("fxPending ? isActive(code) : canDisplay(code, fx)");
  });

  it("asks for the rates when the menu opens, so the first render is accurate", () => {
    expect(switcher).toMatch(/setOpen=\{\(v\) => \{ if \(v\) ensureRates\?\.\(\);/);
    expect(provider).toContain("const ensureRates = useCallback(() => setRatesWanted(true), []);");
  });

  it("marks the fetch as failed rather than leaving it pending forever", () => {
    expect(provider).toContain("setFxFailed(true)");
    expect(provider).toContain("&& !fxFailed;");
  });
});
