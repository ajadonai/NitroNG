import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Sentry 7794355937, on /dashboard: "t is not a function" inside
 * t(Math.floor(e/100),{round:"down"}).
 *
 * fmtNaira takes the money formatter as its second argument, and the Summary
 * panel in TasksPage called it with one. TaskCard held the file's only
 * useMoney(), so `money` was simply not a binding in TasksPage — opening
 * Summary threw into the error boundary and the page went blank.
 *
 * This is asserted against the source because the mistake is a missing
 * argument, which no amount of rendering with good data would reveal: it only
 * appears when that panel opens.
 */
const SOURCE = readFileSync("components/tasks-page.jsx", "utf8");

/** Arguments at the top level of a call, ignoring commas nested inside it. */
function argCountsFor(name, src) {
  const counts = [];
  const re = new RegExp(`(?<!function\\s)(?<![A-Za-z0-9_])${name}\\(`, "g");
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 1;
    let commas = 0;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if (c === "," && depth === 1) commas++;
    }
    counts.push(commas + 1);
  }
  return counts;
}

describe("the tasks page can format its own money", () => {
  it("gives TasksPage a money formatter of its own", () => {
    const body = SOURCE.slice(SOURCE.indexOf("export default function TasksPage"));
    const ownScope = body.slice(0, body.indexOf("\nfunction TaskCard"));
    expect(ownScope).toContain("useMoney()");
  });

  it("passes the formatter at every fmtNaira call", () => {
    const calls = argCountsFor("fmtNaira", SOURCE);
    expect(calls.length).toBeGreaterThan(1);
    for (const n of calls) expect(n).toBe(2);
  });

  it("would have caught the Summary call that shipped", () => {
    // The exact line, as it was. Proves the check above has teeth rather than
    // passing because the pattern never matches anything.
    const broken = "const x = [['Earned', fmtNaira(stats.earned || 0), green]];";
    expect(argCountsFor("fmtNaira", broken)).toEqual([1]);
  });
});
