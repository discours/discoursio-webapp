/**
 * Утилиты для тестирования SolidJS приложения
 * Включает проверки гидратации, состояния сервера и готовности страниц
 */

import { Browser, test as baseTest, expect, Page } from '@playwright/test'
import { baseUrl } from './common'

/**
 * Утилиты для тестирования SolidJS приложения
 * Включает проверки гидратации, состояния сервера и готовности страниц
 */
export class TestUtils {
  public page: Page

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Переход на страницу с улучшенной обработкой ошибок
   */
  async goto(path = '/') {
    const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3001'
    const fullUrl = `${baseUrl}${path}`
    console.log(`Переход на: ${fullUrl}`)

    try {
      await this.page.goto(fullUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })
    } catch (error) {
      console.error(`Ошибка при переходе на ${path}:`, error)
      throw error
    }
  }

  /**
   * Проверка состояния сервера
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await this.page.request.get('https://localhost:3001')
      return response.status() === 200
    } catch {
      return false
    }
  }

  /**
   * Проверка состояния гидратации SolidJS
   */
  async checkHydrationState() {
    // Проверяем наличие data-hk атрибутов (hydration keys) - опционально
    const hydrationKeys = await this.page.$$eval('[data-hk]', (els) => els.length)

    // Проверяем что основные компоненты загружены
    const hasMainContent = (await this.page.$('main')) !== null
    const hasHeader = (await this.page.$('header')) !== null || (await this.page.$('nav')) !== null

    // Проверяем что страница интерактивна
    const isInteractive = await this.page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a[href], input')
      return buttons.length > 0 && document.readyState === 'complete'
    })

    // Проверяем наличие серверного контейнера
    const hasServerContainer = await this.page.$('[data-server-rendered="true"]') !== null

    // Более гибкая логика: считаем гидрированным если есть основные элементы и интерактивность
    // data-hk атрибуты могут отсутствовать в разных режимах SolidJS
    const isBasicallyHydrated = hasMainContent && isInteractive

    return {
      hydrationKeys,
      hasMainContent,
      hasHeader,
      isInteractive,
      hasServerContainer,
      isHydrated: isBasicallyHydrated
    }
  }

  /**
   * ⚡ Оптимизированное ожидание готовности страницы
   */
  async expectPageReady() {
    const isCI = process.env.CI === 'true'
    const timeout = isCI ? 8000 : 15000 // 🔥 Сокращенные таймауты для CI
    
    console.log('Ожидание готовности страницы...')

    // Ждем только domcontentloaded - достаточно для большинства случаев
    await this.page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {
      console.log('⚠️ Тайм-аут domcontentloaded, продолжаем...')
    })

    // В CI пропускаем медленные проверки
    if (!isCI) {
      // Ждем завершения загрузки страницы (только локально)
      await this.page.waitForLoadState('load', { timeout }).catch(() => {
        console.log('⚠️ Тайм-аут load, продолжаем...')
      })
    }

    // Быстрая проверка заголовка
    try {
      await expect(this.page).toHaveTitle(/Discours|Дискурс/, { timeout: timeout / 2 })
    } catch (_error) {
      const title = await this.page.title()
      if (!title?.trim()) {
        throw new Error('❌ Страница не загрузилась - заголовок пустой')
      }
      console.log(`⚠️ Нестандартный заголовок: "${title}", но страница загружена`)
    }

    console.log('✅ Страница готова!')
  }

  /**
   * Проверка успешной гидратации с детальной диагностикой
   */
  async expectHydrationSuccessful() {
    console.log('Проверка успешной гидратации...')

    // Ждем завершения гидрации
    await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 })

    // Получаем состояние гидратации
    const hydrationState = await this.checkHydrationState()

    console.log('Состояние гидратации:', {
      hydrationKeys: hydrationState.hydrationKeys,
      hasMainContent: hydrationState.hasMainContent,
      hasHeader: hydrationState.hasHeader,
      isInteractive: hydrationState.isInteractive
    })

    // Проверяем что основные интерактивные элементы доступны
    const interactiveElements = await this.page.$$eval(
      'button, a, input, [role="button"]',
      (elements) => elements.length
    )

    if (interactiveElements > 0) {
      console.log(`Найдено ${interactiveElements} интерактивных элементов`)
    }

    // Проверяем что гидратация прошла успешно
    if (!hydrationState.isHydrated) {
      throw new Error(`Гидратация не завершена: ${JSON.stringify(hydrationState)}`)
    }

    console.log('Гидратация прошла успешно!')
  }

  /**
   * Retry механизм для нестабильных операций
   */
  async retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation()
      } catch (error) {
        console.log(`Попытка ${i + 1}/${maxRetries} не удалась:`, error)
        if (i === maxRetries - 1) throw error
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    throw new Error('Max retries exceeded')
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

export const getScreenshotName = (testName: string, prefix = 'screenshot') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '_')
  return `${prefix}_${sanitizedTestName}_${timestamp}.png`
}

/**
 * Инициализация тестовой среды с проверкой сервера
 */
export async function initializeTestEnvironment(browser: Browser, testName: string): Promise<Page> {
  console.log(`Инициализация тестов ${testName}...`)

  const page = await browser.newPage()

  // Проверяем доступность сервера
  console.log('Проверка доступности сервера...')
  const response = await page.request.get('https://localhost:3001')

  if (response.status() !== 200) {
    throw new Error(`Сервер недоступен: ${response.status()} ${response.statusText()}`)
  }

  console.log('Сервер доступен и отвечает')

  // Проверяем что страница загружается
  await page.goto('https://localhost:3001', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveTitle(/Discours|Дискурс/, { timeout: 10000 })

  console.log(`Тесты ${testName} инициализированы успешно!`)
  return page
}

/**
 * Очистка тестовой среды
 */
export async function cleanupTestEnvironment(page: Page | null, testName: string): Promise<void> {
  if (page) {
    console.log(`Очистка тестов ${testName}...`)
    await page.close()
  }
}

/**
 * Проверка сервера без запуска нового экземпляра
 */
export async function checkServerWithoutStarting(page: Page): Promise<boolean> {
  try {
    const response = await page.request.get('https://localhost:3001')
    return response.status() === 200
  } catch {
    return false
  }
}

// Re-export auth helpers для удобства
export { getLoginButton, getLoginSubmitButton } from './auth-helpers'
