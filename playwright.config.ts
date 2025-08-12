import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI === 'true'

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true, // ✅ Включаем параллельность для скорости
  forbidOnly: isCI,
  retries: isCI ? 1 : 0, // 🔄 Меньше ретраев - быстрее фидбек
  workers: isCI ? 4 : 2, // ⚡ Больше воркеров для параллельности
  reporter: isCI ? 'github' : 'html',
  timeout: isCI ? 30000 : 60000, // ⏱️ Сокращенные таймауты для CI
  // В CI используем более надежные настройки
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    // Для работы с прокси на /graphql
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
    actionTimeout: isCI ? 15000 : 30000, // ⚡ Оптимизированные таймауты для CI
    navigationTimeout: isCI ? 20000 : 30000, // ⚡ Быстрая навигация в CI
    // В CI добавляем дополнительные аргументы для стабильности
    ...(isCI && {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // В CI используем системный браузер если доступен
        ...(isCI &&
          process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD && {
            channel: 'chromium'
          })
      }
    }
  ],

  // Запускаем отдельный тестовый сервер на порту 3001
  webServer: {
    command: 'E2E=true PORT=3001 npm run dev',
    // command: 'npm run build && npx vinxi preview --port 3001',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    timeout: isCI ? 90000 : 180000, // ⏱️ Увеличиваем таймаут для билда
    stdout: 'pipe',
    stderr: 'pipe'
  }
})
