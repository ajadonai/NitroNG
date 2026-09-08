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
  const flush = () => { if (usedAt && !hasHook) missing.push(`${name} (line ${usedAt})`); };

  source.split("\n").forEach((raw, i) => {
    // Prose mentions the call all over this codebase; only code counts.
    const trimmed = raw.trim();
    const line = (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) ? "" : raw;
    const m = line.match(COMPONENT_START);
    if (m) { flush(); name = m[1] || m[2]; hasHook = false; usedAt = 0; }
    if (/const money = useMoney\(\)/.test(line)) hasHook = true;
    // A helper that takes the formatter as an argument supplies its own.
    if (/function \w+\([^)]*\bmoney\b/.test(line) || /=>\s*$/.test(line) === false && /\(\s*[^)]*\bmoney\b[^)]*\)\s*=>/.test(line)) hasHook = true;
    if (!usedAt && /[^\w.]money\(/.test(line) && !/useMoney/.test(line)) usedAt = i + 1;
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
