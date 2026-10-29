import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const PROD = 'http://localhost:3100';
const DEV = 'http://localhost:3101';
const executablePath = fs.existsSync('/opt/pw-browsers/chromium')
  ? '/opt/pw-browsers/chromium'
  : undefined;
const launchOptions = { executablePath, args: ['--no-sandbox'] };
const secret = 'e2e-secret-e2e-secret-e2e-secret-1234';

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
    {
      name: 'desktop',
      testIgnore: /\.mock\./,
      use: { ...devices['Desktop Chrome'], baseURL: PROD, launchOptions },
    },
    {
      name: 'mobile',
      testIgnore: /\.mock\./,
      use: { ...devices['Pixel 7'], baseURL: PROD, launchOptions },
    },
    {
      name: 'mock-desktop',
      testMatch: /\.mock\./,
      use: { ...devices['Desktop Chrome'], baseURL: DEV, launchOptions },
    },
    {
      name: 'mock-mobile',
      testMatch: /\.mock\./,
      use: { ...devices['Pixel 7'], baseURL: DEV, launchOptions },
    },
  ],
  webServer: [
    {
      // Production build, no extraction provider configured (the real default).
      command: 'NEXT_DIST_DIR=.next-e2e npx next start -p 3100',
      url: `${PROD}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { DOWNLOAD_TOKEN_SECRET: secret, MEDIA_EXTRACTOR_PROVIDER: '' },
    },
    {
      // Development server with the TEST-ONLY mock provider (refused in production builds).
      command: 'NEXT_DIST_DIR=.next-e2e-dev npx next dev -p 3101',
      url: `${DEV}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        DOWNLOAD_TOKEN_SECRET: secret,
        MEDIA_EXTRACTOR_PROVIDER: 'mock',
        EXTRACT_RATE_LIMIT: '1000',
        DOWNLOAD_RATE_LIMIT: '1000',
      },
    },
  ],
});
