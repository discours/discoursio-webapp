import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Загрузка переменных окружения для E2E
dotenv.config({ path: '.env.e2e' })

// Проверяем CI окружение
const isCI = !!process.env.CI

export default defineConfig({
  // Директория с E2E тестами
  testDir: './tests/e2e',

  // Параллельный запуск тестов
  fullyParallel: !isCI, // В CI отключаем параллелизм для стабильности
  forbidOnly: !!isCI, // В CI запрещаем .only
  retries: isCI ? 1 : 0, // В CI добавляем ретраи
  workers: isCI ? 1 : undefined, // В CI используем один воркер

  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: 'https://localhost:3000',

    // Collect trace when retrying the failed test.
    trace: 'on-first-retry'
  },
  // Configure projects for major browsers.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  // Run your local dev server before starting the tests.
  webServer: {
    command: 'npm run dev',
    url: 'https://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 60000 : 20000
  },

  // Папки для артефактов
  outputDir: 'test-results/',

  // Настройки для лучшего отображения
  globalSetup: undefined,
  globalTeardown: undefined
})
