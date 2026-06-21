import { defineConfig } from "@playwright/test";

// The e2e drives a 7-player session against a LIVE Supabase (schema + functions
// deployed, anonymous sign-ins enabled). Provide NEXT_PUBLIC_SUPABASE_* in the
// environment. Set E2E_NO_SERVER=1 to test against an already-running app.
export default defineConfig({
  testDir: "./e2e",
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "pnpm start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
