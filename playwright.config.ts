import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Загрузка переменных окружения для E2E
dotenv.config({ path: '.env.e2e' })

export default defineConfig({
  // Директория с E2E тестами
  testDir: './tests/e2e',
  
  // Параллельный запуск тестов
  fullyParallel: false, // отключает параллелизм на уровне файлов
  forbidOnly: true, // (опционально, чтобы не забыть .only)
  retries: 0, // Без ретраев для быстрой отладки
  workers: 1,           // один воркер — один процесс
  
  // Улучшенная конфигурация репортинга
  reporter: [['list', { printSteps: false }]],
  
  timeout: 30000, // Сокращенный тайм-аут
  
  // Глобальные настройки тестов
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    headless: false, // Показываем браузер для отладки
    ignoreHTTPSErrors: true,
    trace: 'off', // Отключаем трейсы
    screenshot: 'off', // Отключаем скриншоты
    video: 'off', // Отключаем видео
    actionTimeout: 5000 // Тайм-аут для отдельных действий
  },
  
  // Конфигурация браузеров
  projects: [
    {
      name: 'hydration-debug',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
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
