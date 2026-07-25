import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = relativePath => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  "utf8",
);

describe("dashboard overview module boundary", () => {
  const shellSource = readSource("components/dashboard.jsx");
  const overviewSource = readSource("components/dashboard-overview.jsx");

  it("keeps the dashboard shell focused on navigation and orchestration", () => {
    expect(shellSource).toContain(
      'import { OverviewPage, RightSidebar } from "./dashboard-overview";',
    );
    expect(shellSource).not.toContain("function OverviewPage");
    expect(shellSource).not.toContain("function RightSidebar");
  });

  it("keeps the home content and its desktop rail in one client feature module", () => {
    expect(overviewSource).toMatch(/^'use client';/);
    expect(overviewSource).toContain("export function OverviewPage(");
    expect(overviewSource).toContain("export function RightSidebar(");
    expect(overviewSource).toContain("<RewardsStrip");
    expect(overviewSource).toContain("<PlatformIcon");
  });

  it("loads the extracted client module without browser globals", async () => {
    const feature = await import("@/components/dashboard-overview");

    expect(feature.OverviewPage).toBeTypeOf("function");
    expect(feature.RightSidebar).toBeTypeOf("function");
  });
});
