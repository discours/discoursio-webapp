/**
 * Вспомогательные функции для тестов
 *
 * Содержит общие утилиты и функции, используемые в тестах
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { expect, type Page } from '@playwright/test'
import { config } from 'dotenv'

// Загружаем переменные окружения из .env файла
config()

// Базовый URL - должен соответствовать запущенному локальному серверу или значению из .env
export const baseUrl = process.env.BASE_URL || 'http://localhost:3001'

/**
 * Проверяет доступность сервера без его запуска
 * Для использования в beforeAll хуках тестовых файлов
 *
 * @param page - Экземпляр страницы Playwright
 * @returns {Promise<boolean>} - Возвращает true, если сервер доступен
 */
export async function checkServerWithoutStarting(page: Page): Promise<boolean> {
  try {
    console.log('Проверка доступности сервера...')
    await page.goto(baseUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.warn('Тайм-аут при ожидании networkidle, продолжаем...')
    })
    console.log('Сервер доступен и отвечает')
    return true
  } catch (e) {
    console.error('Сервер недоступен:', e)
    return false
  }
}

/**
 * Ожидает загрузки страницы и всех сетевых запросов
 * @param page - Экземпляр страницы Playwright
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
  } catch (_e) {
    console.warn('Тайм-аут при ожидании загрузки страницы, продолжаем тест...')
  }
}

/**
 * Создает заголовок для скриншота текущей тестовой страницы
 * @param testInfo - Имя текущего теста
 * @returns {string} - Имя файла скриншота
 */
export function getScreenshotName(testInfo: string): string {
  const date = new Date()
  const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`
  return `./test-results/${testInfo.replace(/\s+/g, '_')}_${timestamp}.png`
}

// Re-export auth functions for backward compatibility
export {
  performLogin as login,
  performLogout,
  isUserLoggedIn as isLoggedIn,
  performLogin as setupAuthState,
  TEST_USERS
} from './auth-helpers'

/**
 * Инициализация тестового окружения для отдельных тестов
 */
export async function initializeTestEnvironment(browser: any, testName: string): Promise<Page> {
  console.log(`Инициализация тестов ${testName}...`)

  const page = await browser.newPage()
  await checkServerWithoutStarting(page)
  await expect(page).toHaveTitle(/Discours|Дискурс/)

  console.log(`Тесты ${testName} инициализированы успешно!`)
  return page
}

/**
 * Очистка тестового окружения
 */
export async function cleanupTestEnvironment(page: Page | null, testName: string): Promise<void> {
  if (page) {
    console.log(`Очистка тестов ${testName}...`)
    await page.close()
  }
}
