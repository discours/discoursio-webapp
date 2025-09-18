import { defineConfig, devices } from '@playwright/test'

const isCI = process.env.CI === 'true'

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: true, // ✅ Включаем параллельность для скорости
  forbidOnly: isCI,
  retries: 0, // ❌ Убираем retries чтобы видеть реальные проблемы
  workers: isCI ? 2 : 2, // ⚡ Меньше воркеров для стабильности
  reporter: isCI ? [['github'], ['json', { outputFile: './test-results/results.json' }]] : 'html',
  outputDir: './test-results',
  timeout: 30000, // ⏱️ Стандартный таймаут без маскировки проблем
  // В CI используем более надежные настройки
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://localhost:3001',
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
    actionTimeout: 15000, // ⚡ Стандартные таймауты для выявления проблем
    navigationTimeout: 20000, // ⚡ Быстрое выявление медленной навигации
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
