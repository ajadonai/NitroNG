import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = relativePath => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  "utf8",
);

describe("admin create-order module boundary", () => {
  const facadeSource = readSource("components/admin-extra-pages.jsx");
  const createOrderSource = readSource("components/admin-create-order-page.jsx");
  const dashboardSource = readSource("components/admin-dashboard.jsx");

  it("keeps the existing admin-extra-pages import surface", () => {
    expect(facadeSource).toContain(
      'export { AdminCreateOrderPage } from "./admin-create-order-page";',
    );
    expect(dashboardSource).toContain(
      'import("./admin-create-order-page").then(m => m.AdminCreateOrderPage)',
    );
  });

  it("keeps the feature and its helpers in the dedicated client module", () => {
    expect(facadeSource).not.toContain("function AdminCreateOrderPage");
    expect(facadeSource).not.toContain("const DRIP_DAILY_CAP");
    expect(createOrderSource).toMatch(/^'use client';/);
    expect(createOrderSource).toContain(
      "export function AdminCreateOrderPage({ dark, t })",
    );
    expect(createOrderSource).toContain("const DRIP_DAILY_CAP");
    expect(createOrderSource).toContain("function SumRow(");
  });
});
