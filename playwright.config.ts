import { defineConfig, devices } from "@playwright/test";

// The tests run against the built site (`pnpm build` first), served the way
// GitHub Pages serves it: extensionless paths resolve to their .html files.
export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4321",
    locale: "en-NZ",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:4321",
    reuseExistingServer: !process.env["CI"],
  },
});
