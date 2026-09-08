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
// Both formatters come from a hook and are therefore per component, and both
// have shipped this bug: money() crashed the dashboard twice, tr() crashed the
// landing page and the auth modal. One check, two names.
// The declaration is any binding of the name, not the hook call specifically.
// What crashes a page is the identifier being unbound; how it got bound does
// not matter — LocaleProvider builds its own tr with useMemo and is correct.
const HOOKS = [
  { call: /(?<![\w.$])money\(|[,(]\s*money\s*[,)]/, decl: /const money\s*=/, name: "useMoney()" },
  { call: /(?<![\w.$])tr\(/,                          decl: /const tr\s*=/,    name: "useT()" },
];

const COMPONENT_START = /^(?:export\s+)?(?:default\s+)?function\s+([A-Za-z]\w*)|^(?:export\s+)?const\s+([A-Z]\w*)\s*=\s*(?:\(|function|forwardRef|memo)/;

function componentsMissingHook(source) {
  const missing = [];
  for (const { call, decl, name: hookName } of HOOKS) {
    let name = "<module>", hasHook = false, usedAt = 0, hookAt = 0;
    const flush = () => {
      if (!usedAt) return;
      if (!hasHook) missing.push(`${name} (line ${usedAt}) — no ${hookName}`);
      else if (hookAt > usedAt) missing.push(`${name} — ${hookName} on line ${hookAt} is below its first use on line ${usedAt}`);
    };
    const PARAM = /function\s+\w+\s*\([^)]*\b(?:money|tr)\b|\([^)]*\b(?:money|tr)\b[^)]*\)\s*=>/;

    source.split("\n").forEach((raw, i) => {
      // Prose mentions these words all over the codebase — in comments, and
      // inside strings. Template literals keep their ${…} parts, because those
      // are code: the dashboard's TDZ crash was a call inside one.
      const t = raw.trim();
      const line = (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"))
        ? ""
        : raw
            .replace(/`[^`]*`/g, m => (m.match(/\$\{[^}]*\}?/g) || []).join(" "))
            .replace(/'[^']*'|"[^"]*"/g, "''");
      const m = line.match(COMPONENT_START);
      if (m) { flush(); name = m[1] || m[2]; hasHook = false; usedAt = 0; hookAt = 0; }
      if (decl.test(line)) { hasHook = true; if (!hookAt) hookAt = i + 1; }
      else if (PARAM.test(line)) { hasHook = true; if (!hookAt) hookAt = 1; }
      if (!usedAt && call.test(line) && !/useMoney|useT/.test(line)) usedAt = i + 1;
    });
    flush();
  }
  return missing;
}

describe("every component that formats money holds the hook itself", () => {
  const dir = path.join(process.cwd(), "components");
  const files = fs.readdirSync(dir, { recursive: true })
    .filter(f => typeof f === "string" && f.endsWith(".jsx"));

  it("finds no component calling money() or tr() without its hook, or below it", () => {
    const broken = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      if (!src.includes("money(") && !src.includes("tr(")) continue;
      for (const c of componentsMissingHook(src)) broken.push(`${f}: ${c}`);
    }
    expect(broken).toEqual([]);
  });
});
