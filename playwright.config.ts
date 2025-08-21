import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI === 'true'

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true, // ✅ Включаем параллельность для скорости
  forbidOnly: isCI,
  retries: isCI ? 2 : 1, // 🔄 Больше ретраев для стабильности в CI
  workers: isCI ? 2 : 2, // ⚡ Меньше воркеров для стабильности
  reporter: isCI ? 'github' : 'html',
  timeout: isCI ? 60000 : 60000, // ⏱️ Увеличиваем таймауты для CI
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
    actionTimeout: isCI ? 30000 : 30000, // ⚡ Увеличиваем таймауты для CI
    navigationTimeout: isCI ? 40000 : 30000, // ⚡ Увеличиваем таймауты для CI
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
    timeout: isCI ? 120000 : 180000, // ⏱️ Увеличиваем таймаут для билда в CI
    stdout: 'pipe',
    stderr: 'pipe'
  }
})
