import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.DEBA_E2E_BASE_URL || 'http://127.0.0.1:3000'
const localBase = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseURL)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: localBase
    ? {
        command: 'npm run dev -- -p 3000',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
})
