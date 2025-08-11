import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI === 'true'

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: false, // Отключаем параллельность для стабильности
  forbidOnly: isCI,
  retries: isCI ? 2 : 1,
  workers: 1, // Только один воркер для избежания конфликтов
  reporter: isCI ? 'github' : 'html',
  timeout: 60000, // Увеличиваем общий таймаут теста
  // В CI используем более надежные настройки
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    headless: !!isCI,
    ignoreHTTPSErrors: true,
    // Игнорируем CORS ошибки в тестах
    extraHTTPHeaders: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
    },
    trace: isCI ? 'retain-on-failure' : 'off',
    screenshot: isCI ? 'only-on-failure' : 'off',
    video: isCI ? 'retain-on-failure' : 'off',
    actionTimeout: 30000, // Увеличенный тайм-аут для действий
    navigationTimeout: 30000, // Увеличенный тайм-аут для навигации
    // В CI добавляем дополнительные аргументы для стабильности
    ...(isCI && {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],

  // Запускаем отдельный тестовый сервер на порту 3001
  webServer: {
    command: 'PORT=3001 npm run dev',
    port: 3001,
    reuseExistingServer: !process.env.CI, // В CI всегда запускаем новый сервер
    timeout: 120000, // Увеличиваем таймаут запуска до 2 минут
    stdout: 'pipe', // Показываем логи сервера
    stderr: 'pipe'
  }
})
