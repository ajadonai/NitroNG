import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { koboToNaira, formatKobo, formatNaira } from "../lib/money";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * `naira()` was defined twenty-three times and did not mean the same thing
 * twice — eleven copies returned a string, twelve returned a number, under one
 * name. Worse than the duplication, the copies disagreed on the answer: the
 * Telegram bot printed ₦12,345.67 where the outreach summary printed ₦12,346
 * for the same 1,234,567 kobo.
 *
 * That disagreement is why this could not be a find-and-replace. The tests
 * below pin each old copy's exact behaviour against the module that replaced
 * it, so the claim "no output changed anywhere" is checked rather than
 * asserted.
 */
describe("one naira formatter", () => {
  it("matches the Telegram bot's old formatter exactly, fractions and all", () => {
    // The four byte-identical copies: lib/telegram.js, the two Telegram
    // webhooks, and admin-promotions. All were `₦${(kobo/100).toLocaleString()}`.
    const old = kobo => `₦${(kobo / 100).toLocaleString()}`;
    for (const k of [0, 1, 50, 99, 100, 150, 999, 1000, 250000, 1234567, 100000000, -500000, 12345]) {
      expect(formatKobo(k), `kobo ${k}`).toBe(old(k));
    }
  });

  it("matches the rounded copies, which are the ones that differed", () => {
    // outreach-format.js and admin-service-groups.jsx rounded to whole naira.
    // Seven of the thirteen values above print differently under this rule,
    // which is exactly the output a blind merge would have changed.
    const old = kobo => `₦${Math.round(kobo / 100).toLocaleString()}`;
    for (const k of [0, 1, 50, 99, 100, 150, 999, 1000, 250000, 1234567, 100000000, 12345]) {
      expect(formatKobo(k, { round: true }), `kobo ${k}`).toBe(old(k));
    }
    expect(formatKobo(1234567)).toBe("₦12,345.67");
    expect(formatKobo(1234567, { round: true })).toBe("₦12,346");
  });

  it("matches the naira-denominated copies in both rounding modes", () => {
    const rounded = n => `₦${Math.round(Number(n || 0)).toLocaleString()}`;
    const exact = n => `₦${Number(n || 0).toLocaleString()}`;
    for (const n of [0, 1, 999, 1000, 1234, 1234567, 999999999, -5000]) {
      expect(formatNaira(n), `naira ${n}`).toBe(rounded(n));
      expect(formatNaira(n, { round: false }), `naira ${n}`).toBe(exact(n));
    }
    // The only place the two modes part company is a fraction, which is why
    // admin-resellers keeps round:false and everyone else does not.
    expect(formatNaira(0.5)).toBe("₦1");
    expect(formatNaira(0.5, { round: false })).toBe("₦0.5");
  });

  it("matches the two kobo-to-number copies", () => {
    const old = kobo => Math.round(Number(kobo || 0) / 100);
    for (const k of [0, 49, 50, 150, 250000, 1234567, -5000]) {
      expect(koboToNaira(k), `kobo ${k}`).toBe(old(k));
    }
  });

  it("survives null, undefined and rubbish rather than printing NaN", () => {
    for (const bad of [null, undefined, "", "abc", NaN, Infinity]) {
      expect(formatKobo(bad)).toBe("₦0");
      expect(formatNaira(bad)).toBe("₦0");
      expect(koboToNaira(bad)).toBe(0);
    }
  });

  it("leaves the copies that are a different function wearing the same name", () => {
    // Folding these in would change behaviour, not remove duplication.
    // pulse-dashboard renders a true minus for negatives; ify/outreach returns
    // an empty string for null rather than ₦0; platform-card and
    // reseller-catalogue take a second argument entirely.
    expect(read("components/pulse-dashboard.jsx")).toContain("n < 0 ? '−' : ''");
    expect(read("lib/ify/outreach.js")).toContain("v == null || v === '' ? ''");
    expect(read("components/platform-card.jsx")).toContain("export function naira(v, unit, fmt");
    expect(read("components/reseller-catalogue.jsx")).toContain("const naira = (n, money)");
  });

  it("is the only naira helper, so the count cannot climb back to twenty-three", () => {
    // The ratchet guards the thing that actually went wrong: a new *named*
    // helper. It deliberately does not police one-off ₦ strings inside an error
    // message or a log line — there are around thirty of those, each written
    // once for one sentence, and forcing them through a formatter would be
    // churn rather than a fix.
    //
    // The four exceptions are the copies listed above, each a different
    // function that happens to share the name. Adding a fifth means either
    // importing lib/money or arguing here why it cannot.
    const ALLOWED = new Set([
      "components/pulse-dashboard.jsx",    // renders a true minus for negatives
      "lib/ify/outreach.js",               // empty string for null, not ₦0
      "components/platform-card.jsx",      // (v, unit, fmt) — different signature
      "components/reseller-catalogue.jsx", // (n, money) — different signature
      "components/admin-price-changes.jsx",// delegates to fN, already shared
    ]);
    const DEFINES = /(?:^|\n)\s*(?:export\s+)?(?:const\s+naira\s*=\s*\(|(?:async\s+)?function\s+naira\s*\()/;

    const offenders = [];
    const walk = dir => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(js|jsx)$/.test(e.name)) continue;
        const rel = path.relative(process.cwd(), p);
        if (rel === "lib/money.js" || ALLOWED.has(rel)) continue;
        const src = fs.readFileSync(p, "utf8");
        if (!DEFINES.test(src)) continue;
        // A helper is fine when it is a thin wrapper over the shared module.
        if (/from\s+["'][^"']*\/money(?:\.js)?["']/.test(src)) continue;
        offenders.push(rel);
      }
    };
    for (const d of ["app", "lib", "components"]) walk(path.join(process.cwd(), d));
    expect(offenders).toEqual([]);
  });
});
