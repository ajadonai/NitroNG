import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROVIDER_IDS } from "@/lib/smm";

/**
 * Both admin service surfaces used to select every Service row with no filter
 * and no limit. That is 18,291 rows and 6.11 MB against Vercel's 4.5 MB
 * response cap, so the end of the list silently never arrived: DaoSMM 660 was
 * present, enabled by nobody, listed by its provider that morning, and still
 * unfindable in Raw Services, Menu Builder and search at the same time.
 *
 * These assertions are about the shape of the query rather than its results,
 * because the failure is a property of how much is asked for, which no amount
 * of mocked data would reveal.
 */
const SERVICES_ROUTE = "app/api/admin/services/route.js";
const GROUPS_ROUTE = "app/api/admin/service-groups/route.js";

const read = (p) => readFileSync(p, "utf8");

describe("admin service lists stay inside the response cap", () => {
  it("asks only for live providers, on both surfaces", () => {
    for (const route of [SERVICES_ROUTE, GROUPS_ROUTE]) {
      const source = read(route);
      expect(source, route).toContain("where: { provider: { in: PROVIDER_IDS } }");
      expect(source, route).toContain("from '@/lib/smm'");
    }
  });

  // The register is the list. Writing the keys out by hand is what made removing
  // one provider touch eleven files last time.
  it("reads the provider list from the register rather than naming providers", () => {
    for (const route of [SERVICES_ROUTE, GROUPS_ROUTE]) {
      const source = read(route);
      expect(source, route).not.toMatch(/provider: \{ in: \[['"]/);
      expect(source, route).not.toContain("'jap'");
    }
  });

  it("excludes the retired provider whose rows are kept only as receipts", () => {
    // jap was disconnected on 16 Sep 2026. Its 6,023 service rows stay in the
    // table because 22 historical orders point at them, but they cannot be
    // ordered and so have no business in a picker.
    expect(PROVIDER_IDS).not.toContain("jap");
    expect(PROVIDER_IDS).toEqual(expect.arrayContaining(["mtp", "dao"]));
  });

  it("alarms before the payload reaches the cap again", () => {
    const source = read(SERVICES_ROUTE);
    const match = source.match(/SERVICE_PAYLOAD_WARN_ROWS = ([\d_]+)/);
    expect(match, "threshold constant is missing").toBeTruthy();

    const threshold = Number(match[1].replace(/_/g, ""));
    // Measured: ~343 bytes a row, so 4.5 MB lands near 13,750 rows. The warning
    // has to fire before that and after today's 12,268, or it is either noise or
    // too late to be useful.
    expect(threshold).toBeGreaterThan(12_268);
    expect(threshold).toBeLessThan(13_750);
    expect(source).toContain("admin_services_payload_near_cap");
  });
});
