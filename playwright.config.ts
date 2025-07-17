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
  retries: isCI ? 2 : 0, // В CI добавляем ретраи
  workers: isCI ? 1 : undefined, // В CI используем один воркер

  // Улучшенная конфигурация репортинга
  reporter: [
    ['list', { printSteps: false }],
    ...(isCI ? ([['github' as const], ['html' as const]] as const) : [])
  ],

  timeout: isCI ? 60000 : 30000, // Увеличенный тайм-аут для CI

  // Глобальные настройки тестов
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    headless: !!isCI, // В CI всегда headless
    ignoreHTTPSErrors: true,
    trace: isCI ? 'retain-on-failure' : 'off',
    screenshot: isCI ? 'only-on-failure' : 'off',
    video: isCI ? 'retain-on-failure' : 'off',
    actionTimeout: isCI ? 10000 : 5000 // Увеличенный тайм-аут для CI
  },

  // Конфигурация браузеров
  projects: [
    {
      name: 'hydration-debug',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      }
    },
    // WebKit проект для CI тестов
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        headless: !!isCI, // В CI всегда headless
        viewport: { width: 1280, height: 720 },
        // Оптимизации для CI
        ...(isCI && {
          launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          }
        })
      }
    }
  ],

  // Веб-сервер для тестирования
  webServer: {
    command: 'vinxi dev --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },

  // Папки для артефактов
  outputDir: 'test-results/',

  // Настройки для лучшего отображения
  globalSetup: undefined,
  globalTeardown: undefined
})
