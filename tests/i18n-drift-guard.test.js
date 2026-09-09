import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepo, DELIBERATELY_ENGLISH } from "../scripts/i18n-detect.mjs";
import { LOCALE_CODES, SOURCE_LOCALE, coverage } from "../lib/i18n";

/**
 * Translation drift, made impossible to ship rather than easy to notice.
 *
 * `npm run i18n:report` has always been able to say what is missing, and that
 * was not enough twice over. It counts strings that have been wrapped in tr(),
 * so a page nobody ever wrapped reads as 100% complete — which is how the three
 * tiles on the dashboard overview, and their seven tutorial steps and four
 * expectation cards, sat in English on every French, Pidgin, Swahili and Arabic
 * dashboard while the report showed four full bars. Trip found them. Twice.
 *
 * These tests close both halves:
 *
 *   1. every string wrapped in tr() has a translation in all four dictionaries
 *   2. no file gains untranslated English that was not already recorded
 *
 * The second is a ratchet, not a clean bill of health. There are 1,401 strings
 * of known debt in scripts/i18n-baseline.json and every one of them is a
 * customer somewhere reading English. The list exists so the debt cannot grow
 * silently while it is being paid down.
 */

const BASELINE = path.join(process.cwd(), "scripts", "i18n-baseline.json");
const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
const rows = scanRepo();
const current = Object.fromEntries([...rows].map(([f, r]) => [f, r.count]));
const REGEN = "npm run i18n:baseline -- --write";

describe("translation drift", () => {
  it("has a translation for every string the app asks for", () => {
    // The report reads tr() calls out of the source, so this needs no list to
    // maintain and cannot fall behind the code.
    const strings = sourceStrings();
    for (const code of LOCALE_CODES.filter((c) => c !== SOURCE_LOCALE)) {
      const messages = JSON.parse(fs.readFileSync(`messages/${code}.json`, "utf8"));
      const { missing } = coverage(strings, messages);
      expect(
        missing,
        `messages/${code}.json is missing ${missing.length} string(s). ` +
        `Run: node scripts/i18n-report.mjs --missing ${code}`,
      ).toEqual([]);
    }
  });

  it("does not let a file gain untranslated English", () => {
    const worse = Object.entries(current)
      .filter(([f, n]) => n > (baseline[f] ?? 0))
      .map(([f, n]) => `  ${f}: ${baseline[f] ?? 0} → ${n}`);

    expect(
      worse,
      "Untranslated English was added. Wrap it:\n" +
      "  node scripts/i18n-wrap.mjs <file> --dry     # read the list first\n" +
      "  node scripts/i18n-wrap.mjs <file>\n" +
      "then translate it into all four dictionaries. If it is meant to stay " +
      "English, add it to DELIBERATELY_ENGLISH in scripts/i18n-detect.mjs " +
      "with the reason.\n",
    ).toEqual([]);
  });

  it("makes the record follow the work down", () => {
    // A number that falls without being written back leaves the guard slacker
    // than the code deserves, and the slack is invisible. Translating a page
    // and recording that you did belong in the same commit.
    const better = Object.entries(baseline)
      .filter(([f, n]) => (current[f] ?? 0) < n)
      .map(([f, n]) => `  ${f}: ${n} → ${current[f] ?? 0}`);

    expect(better, `Fewer untranslated strings than recorded. Run: ${REGEN}\n`).toEqual([]);
  });

  it("keeps every deliberate exception explained", () => {
    // The value of the allowlist is not that it silences the guard, it is that
    // somebody had to write down why. An entry with no reason is a string that
    // was waved through.
    expect(DELIBERATELY_ENGLISH.size).toBeGreaterThan(0);
    for (const [text, why] of DELIBERATELY_ENGLISH) {
      expect(typeof why === "string" && why.length > 20, `"${text}" needs a real reason`).toBe(true);
    }
  });
});

/** Every tr("…") in the app — the same read scripts/i18n-report.mjs does. */
function sourceStrings() {
  const CALL = /\b(?:tr|msg)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*\)/g;
  const out = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); continue; }
      if (!/\.jsx?$/.test(e.name)) continue;
      const src = fs.readFileSync(p, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
      for (const m of src.matchAll(CALL)) {
        const text = (m[1] ?? m[2]).replace(/\\(["'])/g, "$1");
        if (text.trim()) out.add(text);
      }
    }
  };
  for (const d of ["components", "app"]) if (fs.existsSync(d)) walk(d);
  return [...out];
}

/**
 * Emphasis markers, checked in every language.
 *
 * <Emph> rebuilds `*bold*` inside a translated sentence, which is what lets a
 * sentence with an emphasised word in the middle stay ONE string — the
 * alternative being three fragments reassembled in English's word order, which
 * is nonsense in French and worse in Arabic.
 *
 * The cost is a convention a translation has to respect. A dropped or added
 * asterisk bolds the rest of the line, so the pairs are counted here rather
 * than noticed on a customer's screen.
 */
describe("emphasis markers", () => {
  const dicts = LOCALE_CODES.filter((c) => c !== SOURCE_LOCALE)
    .map((c) => [c, JSON.parse(fs.readFileSync(`messages/${c}.json`, "utf8"))]);

  it("pairs every marker, in the English and in all four translations", () => {
    const bad = [];
    const count = (s) => (s.match(/\*/g) || []).length;

    for (const english of sourceStrings()) {
      if (!english.includes("*")) continue;
      if (count(english) % 2) bad.push(`en: ${english}`);
      for (const [code, d] of dicts) {
        const hit = d[english];
        if (typeof hit !== "string") continue;
        if (count(hit) % 2) bad.push(`${code}: ${hit}`);
        // A sentence that emphasises nothing in one language is a translator
        // dropping the markup, not a style choice — the bold is part of the copy.
        if (count(hit) === 0) bad.push(`${code}: lost its emphasis — ${hit}`);
      }
    }
    expect(bad, "Unbalanced or missing *emphasis* markers:\n" + bad.join("\n")).toEqual([]);
  });
});
