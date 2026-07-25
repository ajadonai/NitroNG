import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = relativePath => fs.readFileSync(
  path.join(process.cwd(), relativePath),
  "utf8",
);

describe("admin page module boundaries", () => {
  const facadeSource = readSource("components/admin-pages.jsx");
  const alertsSource = readSource("components/admin-alerts-page.jsx");
  const settingsSource = readSource("components/admin-settings-page.jsx");
  const dashboardSource = readSource("components/admin-dashboard.jsx");

  it("preserves the admin-pages public export surface", () => {
    expect(facadeSource).toContain(
      'export { AdminAlertsPage } from "./admin-alerts-page";',
    );
    expect(facadeSource).toContain(
      'export { AdminSettingsPage } from "./admin-settings-page";',
    );
    expect(facadeSource).not.toContain("function AdminAlertsPage");
    expect(facadeSource).not.toContain("function AdminSettingsPage");
    expect(facadeSource).not.toContain("function CleanupButton");
  });

  it("loads each feature through its dedicated dashboard chunk", () => {
    expect(dashboardSource).toContain(
      'import("./admin-alerts-page").then(m => m.AdminAlertsPage)',
    );
    expect(dashboardSource).toContain(
      'import("./admin-settings-page").then(m => m.AdminSettingsPage)',
    );
  });

  it("keeps announcements and settings in independent client modules", () => {
    expect(alertsSource).toMatch(/^'use client';/);
    expect(alertsSource).toContain("export function AdminAlertsPage({ dark, t })");
    expect(settingsSource).toMatch(/^'use client';/);
    expect(settingsSource).toContain("function CleanupButton({ dark, t })");
    expect(settingsSource).toContain("export function AdminSettingsPage(");
  });

  it("loads both extracted modules without browser globals", async () => {
    const [alerts, settings] = await Promise.all([
      import("@/components/admin-alerts-page"),
      import("@/components/admin-settings-page"),
    ]);

    expect(alerts.AdminAlertsPage).toBeTypeOf("function");
    expect(settings.AdminSettingsPage).toBeTypeOf("function");
  });
});
