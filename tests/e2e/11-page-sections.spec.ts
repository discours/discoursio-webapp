import { expect, type Page, test } from '@playwright/test'
import { initializeTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers'
import { SitePage } from '../utils/page-objects'

/**
 * Тестирование основных страниц сайта
 * Проверка загрузки и корректности заголовков
 */

// Объявляем глобальную переменную page как nullable
let page: Page | null = null

test.beforeAll(async ({ browser }) => {
  page = await initializeTestEnvironment(browser, 'page sections')
  test.setTimeout(150000)
})

test.afterAll(async () => {
  await cleanupTestEnvironment(page, 'page sections')
})

/**
 * Конфигурация страниц для тестирования
 * Маппинг путей и ожидаемых заголовков
 */
const PAGES_CONFIG = {
  '/': /Дискурс/,
  '/feed': /Дискурс :: Лента/,
  '/support': /Поддержите Дискурс/,
  '/authors': /Дискурс :: Все авторы/,
  '/topics': /Дискурс :: Темы и сюжеты/
} as const

test.describe('Проверка загрузки основных страниц', () => {
  Object.entries(PAGES_CONFIG).forEach(([path, expectedTitle]) => {
    test(`Загрузка страницы ${path}`, async ({ page }) => {
      const sitePage = new SitePage(page)
      
      await sitePage.navigateToPage(path)
      await sitePage.verifyPageTitle(expectedTitle)
    })
  })
})
