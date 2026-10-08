// End-to-end tests: real backend (in-memory Postgres) + production build of the frontend.
// Run: npm run test:e2e   (first time: npx playwright install chromium)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    // page.route can't intercept service-worker requests; the offline spec opts back in
    serviceWorkers: 'block',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chromium' }],
  webServer: [
    {
      command: 'node server.js',
      cwd: '../backend',
      port: 5000,
      env: { NODE_ENV: 'test', PORT: '5000', JWT_SECRET: 'e2e-secret', ADMIN_EMAILS: 'admin@e2e.test' },
      // never reuse: a stale server would silently test old code
      reuseExistingServer: false,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      port: 4173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
