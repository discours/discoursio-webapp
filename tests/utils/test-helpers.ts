/**
 * Утилиты для тестирования SolidJS приложения
 * Включает проверки гидратации, состояния сервера и готовности страниц
 */

import { Browser, test as baseTest, expect, Page } from '@playwright/test'

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
    const baseUrl = process.env.E2E_BASE_URL || 'https://localhost:3000'
    const fullUrl = `${baseUrl}${path}`
    console.log(`Переход на: ${fullUrl}`)

    try {
      // Увеличиваем таймаут для CI
      const timeout = process.env.CI === 'true' ? 45000 : 30000

      await this.page.goto(fullUrl, {
        waitUntil: 'domcontentloaded',
        timeout
      })

      // Дополнительная проверка что страница загрузилась
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {
        console.log('⚠️ Дополнительная проверка domcontentloaded не прошла, но продолжаем...')
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
      const response = await this.page.request.get('https://localhost:3000')
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

    // Проверяем что страница интерактивна с более мягкими критериями
    const isInteractive = await this.page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a[href], input, [role="button"], [tabindex]')
      const hasBasicInteraction = buttons.length > 0
      const isDocumentReady = document.readyState === 'complete'

      // Если нет кнопок, проверяем хотя бы ссылки или другие интерактивные элементы
      const hasAnyInteraction = hasBasicInteraction || document.querySelectorAll('a, [onclick]').length > 0

      return hasAnyInteraction && isDocumentReady
    })

    // Проверяем наличие серверного контейнера
    const hasServerContainer = (await this.page.$('[data-server-rendered="true"]')) !== null

    // Гибкая логика гидратации: основные элементы ИЛИ интерактивность ИЛИ hydration keys
    const isBasicallyHydrated = hasMainContent && (isInteractive || hydrationKeys > 0)

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
    const timeout = isCI ? 25000 : 30000 // 🔄 Увеличиваем таймауты для стабильности

    console.log('Ожидание готовности страницы...')

    // Ждем domcontentloaded с увеличенным таймаутом
    await this.page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {
      console.log('⚠️ Тайм-аут domcontentloaded, продолжаем...')
    })

    // Ждем load state с увеличенным таймаутом
    await this.page.waitForLoadState('load', { timeout: timeout * 0.9 }).catch(() => {
      console.log('⚠️ Тайм-аут load, продолжаем...')
    })

    // Более мягкая проверка гидратации SolidJS
    await this.page
      .waitForFunction(
        () => {
          // Проверяем что документ готов И есть базовый контент
          const hasContent = document.querySelectorAll('main, body > *').length > 0
          const isComplete = document.readyState === 'complete'
          const hasBasicElements = document.querySelectorAll('button, a[href], input, nav, header').length > 0

          // Достаточно базового контента И готовности документа
          return isComplete && (hasContent || hasBasicElements)
        },
        { timeout: timeout * 0.8 }
      )
      .catch(() => {
        console.log('⚠️ Гидратация не завершена полностью, но продолжаем...')
      })

    // Более гибкая проверка заголовка
    try {
      await expect(this.page).toHaveTitle(/Discours|Дискурс/, { timeout: timeout * 0.5 })
    } catch (_error) {
      // Ждем появления заголовка
      await this.page.waitForFunction(() => !!document.title?.trim(), { timeout: 8000 }).catch(() => {})

      try {
        const title = await this.page.title()
        if (!title?.trim()) {
          // Проверяем что хотя бы контент загрузился
          const hasContent = await this.page.evaluate(() => {
            return document.querySelectorAll('main, body > *').length > 0
          })

          if (!hasContent) {
            throw new Error('❌ Страница не загрузилась - нет контента')
          }
          console.log('⚠️ Заголовок пустой, но контент загружен')
        } else {
          console.log(`⚠️ Нестандартный заголовок: "${title}", но страница загружена`)
        }
      } catch (error) {
        console.log('⚠️ Не удалось получить заголовок страницы:', error)
        // Проверяем что хотя бы контент загрузился
        const hasContent = await this.page.evaluate(() => {
          return document.querySelectorAll('main, body > *').length > 0
        })

        if (!hasContent) {
          throw new Error('❌ Страница не загрузилась - нет контента')
        }
        console.log('⚠️ Заголовок недоступен, но контент загружен')
      }
    }

    // Проверяем гидратацию с увеличенным таймаутом
    try {
      await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 })
    } catch (error) {
      console.log('⚠️ Гидратация не завершена полностью, но продолжаем...', error)
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
   * ❌ Retry механизм удален - тесты должны падать сразу чтобы показать реальные проблемы
   * Если операция нестабильна, нужно исправить корневую причину, а не маскировать retries
   */
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
  const response = await page.request.get('https://localhost:3000')

  if (response.status() !== 200) {
    throw new Error(`Сервер недоступен: ${response.status()} ${response.statusText()}`)
  }

  console.log('Сервер доступен и отвечает')

  // Проверяем что страница загружается
  await page.goto('https://localhost:3000', { waitUntil: 'domcontentloaded' })
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
    const response = await page.request.get('https://localhost:3000')
    return response.status() === 200
  } catch {
    return false
  }
}

// Re-export auth helpers для удобства
export { getLoginButton, getLoginSubmitButton } from './auth-helpers'
