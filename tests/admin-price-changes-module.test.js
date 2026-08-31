import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = relativePath => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  "utf8",
);

describe("admin price changes module", () => {
  it("loads the page module without browser globals", async () => {
    const feature = await import("@/components/admin-price-changes");
    expect(feature.AdminPriceChangesPage).toBeTypeOf("function");
  });

  it("is wired into the admin dashboard next to Pricing", () => {
    const shell = readSource("components/admin-dashboard.jsx");
    expect(shell).toContain('import("./admin-price-changes")');
    expect(shell).toContain('{ id: "price-changes", label: "Price Changes"');
    expect(shell).toContain('case "price-changes": return <AdminPriceChangesPage dark={dark} t={t} />;');
  });

  it("records every path that moves a sell price", () => {
    expect(readSource("app/api/cron/prices/route.js")).toContain("recordPriceChanges(");
    const adminRoute = readSource("app/api/admin/service-groups/route.js");
    expect(adminRoute.match(/recordPriceChanges\(/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
