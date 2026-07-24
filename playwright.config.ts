import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "visual.spec.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL: process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:4173",
    browserName: "chromium",
    colorScheme: "light",
    locale: "zh-CN",
  },
  webServer: process.env.VISUAL_BASE_URL
    ? undefined
    : {
        command: "npm run build:client && npm run preview",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
