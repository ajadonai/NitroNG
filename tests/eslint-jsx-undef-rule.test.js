import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Sentry 7794872833: opening the Summary dropdown on the orders page threw
 * "Can't find variable: SummaryRows" from August to October. v2.4.48 deleted
 * the component and one of its two call sites and left the other behind.
 *
 * The config already carried `no-undef`, with a comment saying it existed for
 * precisely this. It could never have caught it: a JSX tag is a JSXIdentifier,
 * which core scope analysis does not resolve as a variable reference, so
 * `<SummaryRows />` was invisible to it. react/jsx-no-undef is the rule that
 * reads JSX names, and enabling it immediately found a second live one in the
 * same file — <Modal> used without its import, reachable by opening an order's
 * submitted comments.
 *
 * CI runs `npm run lint:ci`, so with this rule on, that class of bug now fails
 * the build instead of reaching a customer.
 */
const CONFIG = readFileSync("eslint.config.mjs", "utf8");

describe("undefined components fail the build", () => {
  it("enables the rule that can actually see JSX names", () => {
    expect(CONFIG).toMatch(/"react\/jsx-no-undef":\s*"error"/);
  });

  it("keeps no-undef too, which covers everything that is not a JSX tag", () => {
    expect(CONFIG).toMatch(/"no-undef":\s*"error"/);
  });

  it("is run by CI rather than only by hand", () => {
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toMatch(/npm run lint:ci/);
    // --quiet hides warnings, so the rule has to be an error to stop anything.
    expect(readFileSync("package.json", "utf8")).toMatch(/"lint:ci":\s*"eslint \. --quiet"/);
  });
});
