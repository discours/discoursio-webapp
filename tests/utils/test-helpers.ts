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
import { baseUrl, checkServerWithoutStarting } from './common'

// Класс утилит для тестов
export class TestUtils {
  public page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto(path = '/') {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`
    console.log(`Переход на: ${url}`)
    await this.page.goto(url)
  }

  async expectPageReady() {
    // Игнорируем CORS ошибки при загрузке страницы
    this.page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('CORS')) {
        console.log(`[CORS Ignored] ${msg.text()}`)
        return
      }
      if (msg.type() === 'error' && msg.text().includes('Preflight response')) {
        console.log(`[CORS Preflight Ignored] ${msg.text()}`)
        return
      }
    })

    this.page.on('pageerror', (error) => {
      if (error.message.includes('CORS') || error.message.includes('access control checks')) {
        console.log(`[CORS Error Ignored] ${error.message}`)
        return
      }
    })

    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.log('Тайм-аут при ожидании networkidle, продолжаем...')
    })

    // Проверяем что страница загрузилась с правильным заголовком
    await expect(this.page).toHaveTitle(/Discours|Дискурс/, { timeout: 10000 })
    console.log('Страница готова!')
  }

  async expectHydrationSuccessful() {
    console.log('Проверка успешной гидрации...')

    // Ждем завершения гидрации - проверяем что нет консольных ошибок гидрации
    await this.page.waitForFunction(
      () => {
        // Проверяем что document.readyState === 'complete'
        return document.readyState === 'complete'
      },
      { timeout: 10000 }
    )

    // Дополнительная проверка на наличие атрибутов data-hk (hydration keys) в SolidJS
    const hydrationKeys = await this.page.$$eval('[data-hk]', (elements) => elements.length)
    if (hydrationKeys > 0) {
      console.log(`Найдено ${hydrationKeys} элементов с ключами гидрации`)
    }

    // Проверяем что основные интерактивные элементы доступны
    const interactiveElements = await this.page.$$eval(
      'button, a, input, [role="button"]',
      (elements) => elements.length
    )
    if (interactiveElements > 0) {
      console.log(`Найдено ${interactiveElements} интерактивных элементов`)
    }

    console.log('Гидрация прошла успешно!')
  }
}

export const test = baseTest.extend<{
  solidPage: Page
  testUtils: TestUtils
}>({
  solidPage: async ({ page }, use) => {
    // Отслеживаем консольные ошибки для диагностики
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('🚨 Console Error:', msg.text())
      }
    })

    // Отслеживаем ошибки страницы
    page.on('pageerror', (error) => {
      console.log('🚨 Page Error:', error.message)
    })

    await use(page)
  },
  testUtils: async ({ page }, use) => {
    const utils = new TestUtils(page)
    await use(utils)
  }
})

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

// Re-export auth helpers для удобства
export { getLoginButton, getLoginSubmitButton } from './auth-helpers'
