/**
 * Вспомогательные функции для тестов
 *
 * Содержит общие утилиты и функции, используемые в тестах
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { test as baseTest, expect, Page } from '@playwright/test'
import * as AuthHelpers from './auth-helpers'
import * as Common from './common'

// Временный класс для совместимости
class TestUtils {
  constructor(page: Page) {}
  async goto() {}
  async expectPageReady() {}
}

const test = baseTest.extend<{
  solidPage: Page
  testUtils: TestUtils
}>({
  solidPage: async ({ page }, use) => {
    await use(page)
  },
  testUtils: async ({ page }, use) => {
    const utils = new TestUtils(page)
    await use(utils)
  }
})

export { test, TestUtils, expect }

export const baseUrl = Common.baseUrl
export const checkServerWithoutStarting = Common.checkServerWithoutStarting
export const waitForPageLoad = Common.waitForPageLoad

export const { isUserLoggedIn, performLogin, performLogout, TEST_USERS } = AuthHelpers

// Алиасы для обратной совместимости
export const isLoggedIn = isUserLoggedIn
export const setupAuthState = performLogin
export const getScreenshotName = (testName: string, prefix = 'screenshot') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '_')
  return `${prefix}_${sanitizedTestName}_${timestamp}.png`
}

export async function initializeTestEnvironment(browser: any, testName: string): Promise<any> {
  console.log(`Инициализация тестов ${testName}...`)

  const page = await browser.newPage()
  await checkServerWithoutStarting(page)
  await expect(page).toHaveTitle(/Discours|Дискурс/)

  console.log(`Тесты ${testName} инициализированы успешно!`)
  return page
}

export async function cleanupTestEnvironment(page: any | null, testName: string): Promise<void> {
  if (page) {
    console.log(`Очистка тестов ${testName}...`)
    await page.close()
  }
}
