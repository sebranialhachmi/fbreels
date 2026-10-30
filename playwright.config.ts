import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:3100';
const executablePath = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const launchOptions = { executablePath, args: ['--no-sandbox'] };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', launchOptions },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], baseURL: BASE, launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], baseURL: BASE, launchOptions } },
  ],
  webServer: {
    // Production build (built by `npm run build:e2e`), default configuration: no ads, no analytics, no contact delivery.
    command: 'NEXT_DIST_DIR=.next-e2e npx next start -p 3100',
    url: `${BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
