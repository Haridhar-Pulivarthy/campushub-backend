/**
 * Playwright end-to-end configuration (Lab 9).
 *
 * Playwright starts both servers on their usual ports and stops them when the
 * run ends. The backend runs against an in-memory MongoDB (e2e/support/
 * start-api.ts), never the development database. reuseExistingServer is off
 * so a run fails, rather than reusing a dev server, if a port is already busy.
 */
import { defineConfig, devices } from "@playwright/test";

import {
  E2E_LOCALE,
  E2E_STUDENT_ID,
  E2E_TIME_ZONE,
} from "./e2e/support/e2e-env.ts";

/** Vite dev server; it proxies /api to the backend on port 3000. */
const WEB_ORIGIN = "http://localhost:5173";
const API_HEALTH_URL = "http://localhost:3000/api/v1/health";

const isCI: boolean = process.env["CI"] !== undefined;

export default defineConfig({
  testDir: "./e2e",
  // One worker: every browser project shares one backend and database.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_ORIGIN,
    // Fixed so displayed dates and "tomorrow" match e2e/support/dates.ts on
    // any host.
    locale: E2E_LOCALE,
    timezoneId: E2E_TIME_ZONE,
    // Kept for any failed attempt, including runs with retries disabled.
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      name: "API",
      command: "npm run build && node e2e/support/start-api.ts",
      // Health answers only after the MongoDB connection is open.
      url: API_HEALTH_URL,
      reuseExistingServer: false,
      // Covers the build and a first-run mongod download.
      timeout: 180_000,
      stdout: "pipe",
      // POSIX only; Windows always force-kills the process tree.
      gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    },
    {
      name: "Web",
      cwd: "client",
      command: "npm run dev -- --port 5173 --strictPort",
      url: WEB_ORIGIN,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_CAMPUSHUB_USER_ID: E2E_STUDENT_ID },
    },
  ],
});
