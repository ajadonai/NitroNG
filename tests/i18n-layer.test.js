import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  LOCALES, LOCALE_CODES, SEO_LOCALES, SOURCE_LOCALE,
  isLocale, makeTranslator, coverage, orphans,
} from "../lib/i18n";

/**
 * English is the source, not one translation among five. Everything here
 * protects the one property that matters: a missing or half-finished
 * dictionary shows English, never a key, never a blank.
 */
describe("translation layer", () => {
  it("returns the English when a translation is missing, blank or the wrong type", () => {
    const t = makeTranslator("fr", { "Fund your wallet": "Alimentez votre portefeuille" });
    expect(t("Fund your wallet")).toBe("Alimentez votre portefeuille");
    expect(t("Not translated yet")).toBe("Not translated yet");

    const ragged = makeTranslator("fr", { A: "", B: "   ", C: null, D: 42 });
    for (const k of ["A", "B", "C", "D"]) expect(ragged(k)).toBe(k);
  });

  it("is a no-op in the source language and for anything unknown", () => {
    const en = makeTranslator(SOURCE_LOCALE, { Hello: "Bonjour" });
    expect(en("Hello")).toBe("Hello");
    const nonsense = makeTranslator("xx", { Hello: "Bonjour" });
    expect(nonsense("Hello")).toBe("Hello");
  });

  it("passes non-strings through untouched", () => {
    const t = makeTranslator("fr", {});
    expect(t(undefined)).toBeUndefined();
    expect(t(5)).toBe(5);
  });

  it("knows which languages exist to be found and which to be read", () => {
    // French, Swahili and Arabic are acquisition: they need their own URLs and
    // hreflang. Pidgin is not — nobody searches in it — so it never gets one.
    expect(SEO_LOCALES.sort()).toEqual(["ar", "fr", "sw"]);
    expect(LOCALES.pcm.seo).toBe(false);
    expect(LOCALES.en.seo).toBe(false);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("xx")).toBe(false);
  });

  it("carries direction so the Arabic layout work has something to read", () => {
    expect(LOCALES.ar.dir).toBe("rtl");
    for (const c of LOCALE_CODES.filter(x => x !== "ar")) expect(LOCALES[c].dir, c).toBe("ltr");
  });

  it("counts coverage and names what is missing", () => {
    const src = ["one", "two", "three", "four"];
    const c = coverage(src, { one: "un", two: "deux" });
    expect(c).toMatchObject({ total: 4, translated: 2, percent: 50 });
    expect(c.missing).toEqual(["three", "four"]);
    expect(coverage([], {}).percent).toBe(100);
  });

  it("reports translations whose English has since been edited, rather than dropping them", () => {
    // Keying on sentences means editing copy orphans its translations. They are
    // usually a word away from the new wording, so they are listed, not deleted.
    expect(orphans(["kept"], { kept: "gardé", "old wording": "ancien" })).toEqual(["old wording"]);
  });

  it("ships a dictionary file for every language but the source", () => {
    for (const code of LOCALE_CODES.filter(c => c !== SOURCE_LOCALE)) {
      const f = path.join(process.cwd(), "messages", `${code}.json`);
      expect(fs.existsSync(f), `messages/${code}.json`).toBe(true);
      expect(() => JSON.parse(fs.readFileSync(f, "utf8")), `messages/${code}.json`).not.toThrow();
    }
  });

  it("keeps the switcher's list and the locale table as one thing", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "components/locale.jsx"), "utf8");
    expect(src).toContain("LOCALE_CODES.map");
    // A language is available when its dictionary has arrived, not by hand.
    expect(src).toContain("AVAILABLE_LOCALES");
  });
});
