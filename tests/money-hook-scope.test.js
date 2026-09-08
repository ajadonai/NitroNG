import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `money` comes from a hook, so it lives per component, not per file. Adding it
 * to the big component and then converting a render inside a small sibling
 * lower down leaves that sibling calling an identifier it does not have — which
 * type-checks, lints, builds, and then throws "money is not defined" the moment
 * the page renders. That is exactly how the wallet page broke, so it is checked
 * here rather than found by loading every screen.
 */
const COMPONENT_START = /^(?:export\s+)?(?:default\s+)?function\s+([A-Za-z]\w*)|^(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*(?:\(|function|forwardRef|memo)/;

function componentsMissingHook(source) {
  const missing = [];
  let name = "<module>";
  let hasHook = false;
  let usedAt = 0;
  let hookAt = 0;
  // Two ways to get this wrong, and both ship: no hook at all ("money is not
  // defined"), or a hook declared BELOW the first use, where a const is still
  // in its temporal dead zone when a memo above it runs ("Cannot access 'money'
  // before initialization"). The second one took down every dashboard render in
  // production, so ordering is checked too.
  const flush = () => {
    if (!usedAt) return;
    if (!hasHook) missing.push(`${name} (line ${usedAt}) — no useMoney()`);
    else if (hookAt > usedAt) missing.push(`${name} — useMoney() on line ${hookAt} is below its first use on line ${usedAt}`);
  };

  // A call, or the formatter handed to a helper as an argument — the second is
  // how the wallet broke the second time, and matching only calls missed it.
  const USE = /(?<![\w.$])money\(|[,(]\s*money\s*[,)]/;
  const PARAM = /function\s+\w+\s*\([^)]*\bmoney\b|\([^)]*\bmoney\b[^)]*\)\s*=>/;

  source.split("\n").forEach((raw, i) => {
    // Prose mentions the word all over this codebase — in comments, and inside
    // strings ("ordering, money, delivery"). Strip both; only code counts.
    const t = raw.trim();
    // Quoted strings go. Template literals keep their ${…} parts, because those
    // are code — the dashboard's TDZ crash was a money() call inside one, and
    // stripping the whole literal is exactly how this test waved it through.
    const line = (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"))
      ? ""
      : raw
          .replace(/`[^`]*`/g, m => (m.match(/\$\{[^}]*\}?/g) || []).join(" "))
          .replace(/'[^']*'|"[^"]*"/g, "''");
    const m = line.match(COMPONENT_START);
    if (m) { flush(); name = m[1] || m[2]; hasHook = false; usedAt = 0; hookAt = 0; }
    if (/const money = useMoney\(\)/.test(line)) { hasHook = true; if (!hookAt) hookAt = i + 1; }
    else if (PARAM.test(line)) { hasHook = true; if (!hookAt) hookAt = 1; }
    if (!usedAt && USE.test(line) && !line.includes("useMoney")) usedAt = i + 1;
  });
  flush();
  return missing;
}

describe("every component that formats money holds the hook itself", () => {
  const dir = path.join(process.cwd(), "components");
  const files = fs.readdirSync(dir, { recursive: true })
    .filter(f => typeof f === "string" && f.endsWith(".jsx"));

  it("finds no component calling money() without useMoney()", () => {
    const broken = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      if (!src.includes("money(")) continue;
      for (const c of componentsMissingHook(src)) broken.push(`${f}: ${c}`);
    }
    expect(broken).toEqual([]);
  });
});
