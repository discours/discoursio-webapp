import { type Page, expect, test } from '@playwright/test'
import { checkServerWithoutStarting } from './utils/test-helpers'

/* Global starting test config */

// Объявляем глобальную переменную page как nullable
let page: Page | null = null

test.beforeAll(async ({ browser }) => {
  console.log('Инициализация тестов...')

  // Создаем страницу для тестов
  page = await browser.newPage()
  test.setTimeout(150000)

  // Проверяем доступность сервера без его запуска
  await checkServerWithoutStarting(page)

  // Проверяем, что страница загрузилась корректно
  // biome-ignore lint/performance/useTopLevelRegex: <explanation>
  await expect(page).toHaveTitle(/Дискурс/)
  console.log('Тесты инициализированы успешно!')
})

test.afterAll(async () => {
  // Проверяем, что page существует перед закрытием
  if (page) {
    await page.close()
  }
})

/* TESTS section */

const pagesTitles = {
  '/': /Дискурс/,
  '/feed': /Дискурс :: Лента/,
  '/support': /Поддержите Дискурс/,
  '/authors': /Дискурс :: Все авторы/,
  '/topics': /Дискурс :: Темы и сюжеты/
}
test.describe('Pages open', () => {
  Object.keys(pagesTitles).forEach((res: string) => {
    test(`Open Page ${res}`, async ({ page }) => {
      await page.goto(`${res}`)
      const title = pagesTitles[res as keyof typeof pagesTitles] || '00000000000'
      await expect(page).toHaveTitle(title)
    })
  })
})
