import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    locale: 'en-GB',
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: 'screenshots.spec.ts' },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: 'screenshots.spec.ts' },
    {
      name: 'screenshots',
      testMatch: 'screenshots.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    // The same entry point the launchers use, or a built single executable when CHATLEDGER_BINARY names one.
    command: process.env.CHATLEDGER_BINARY
      ? `"${process.env.CHATLEDGER_BINARY}" --no-open --port=${PORT}`
      : `node scripts/start.mjs --no-open --port=${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
