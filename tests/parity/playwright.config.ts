import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  retries: 1,
  use: {
    headless: true,
    screenshot: "on",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: "parity",
      testMatch: "parity.spec.ts",
    },
  ],
  reporter: [["html", { open: "never" }], ["list"]],
});
