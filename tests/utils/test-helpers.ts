/**
 * Вспомогательные функции для тестов
 *
 * Содержит общие утилиты и функции, используемые в тестах
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { Browser, expect, type Page } from '@playwright/test'
import { baseUrl, checkServerWithoutStarting, waitForPageLoad } from './common'

/**
 * Генерирует имя для скриншота на основе имени теста
 * @param testName - Название теста
 * @param prefix - Префикс для имени файла
 * @returns {string} - Имя файла скриншота
 */
export function getScreenshotName(testName: string, prefix = 'screenshot'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '_')
  return `${prefix}_${sanitizedTestName}_${timestamp}.png`
}

// Re-export common utilities
export { baseUrl, checkServerWithoutStarting, waitForPageLoad }

// Re-export auth functions for backward compatibility
export {
  isUserLoggedIn as isLoggedIn,
  performLogin as login,
  performLogin as setupAuthState,
  performLogout,
  TEST_USERS
} from './auth-helpers'

/**
 * Инициализация тестового окружения для отдельных тестов
 */
export async function initializeTestEnvironment(browser: Browser, testName: string): Promise<Page> {
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
