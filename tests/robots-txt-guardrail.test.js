import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("robots.txt guardrail", () => {
  const content = readFileSync(resolve(__dirname, "../public/robots.txt"), "utf8");
  const lines = content.split("\n").map((l) => l.trim());

  it("contains Allow: /api/cron/cohort-stats", () => {
    expect(lines).toContain("Allow: /api/cron/cohort-stats");
  });

  it("Allow: /api/cron/cohort-stats appears BEFORE Disallow: /api/", () => {
    const allowIdx = lines.indexOf("Allow: /api/cron/cohort-stats");
    const disallowIdx = lines.indexOf("Disallow: /api/");
    expect(allowIdx).toBeGreaterThanOrEqual(0);
    expect(disallowIdx).toBeGreaterThanOrEqual(0);
    expect(allowIdx).toBeLessThan(disallowIdx);
  });

  it("robots.txt is a static file (no dynamic app/robots route)", () => {
    let hasRoute = false;
    try {
      readFileSync(resolve(__dirname, "../app/robots.js"), "utf8");
      hasRoute = true;
    } catch {}
    try {
      readFileSync(resolve(__dirname, "../app/robots.ts"), "utf8");
      hasRoute = true;
    } catch {}
    expect(hasRoute).toBe(false);
  });
});
