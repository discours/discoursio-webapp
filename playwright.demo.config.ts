import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/demo-e2e',
  timeout: 30_000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev:demo',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120_000
  }
})
