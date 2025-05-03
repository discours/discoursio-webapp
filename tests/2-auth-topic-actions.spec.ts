// biome-ignore lint/correctness/noNodejsModules: <explanation>
import { type Page, expect, test } from '@playwright/test'
import { baseUrl, checkServerWithoutStarting } from './utils/test-helpers'

const TEST_LOGIN = process.env.TEST_LOGIN
const TEST_PASSWORD = process.env.TEST_PASSWORD

// Объявляем глобальную переменную page как nullable
let page: Page | null = null;

test.beforeAll(async ({ browser }) => {
  console.log('Инициализация тестов авторизации...')
  
  // Создаем страницу для тестов
  page = await browser.newPage()
  test.setTimeout(150000)
  
  // Проверяем доступность сервера без его запуска
  await checkServerWithoutStarting(page)
  
  // Проверяем, что страница загрузилась корректно
  // biome-ignore lint/performance/useTopLevelRegex: <explanation>
  await expect(page).toHaveTitle(/Дискурс/)
  await page.getByRole('link', { name: 'Войти' }).click()
  console.log('Тесты авторизации инициализированы успешно!')
  await page.close()
  page = null; // Устанавливаем null после закрытия
})

test.afterAll(async () => {
  // Проверяем, что page существует перед закрытием
  if (page) {
    await page.close()
  }
})

/* TESTS section */
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  /* test.setTimeout(80000); */
  await page.getByRole('link', { name: 'Войти' }).click()
  await page.getByPlaceholder('Почта').click()
  if (TEST_LOGIN) {
    await page.getByPlaceholder('Почта').fill(TEST_LOGIN)
    await page.getByPlaceholder('Пароль').click()
    if (TEST_PASSWORD) {
      await page.getByPlaceholder('Пароль').fill(TEST_PASSWORD)
    }
  }
  await page.getByRole('button', { name: 'Войти' }).click()
})

test.describe('Topic Actions', () => {
  test('Follow topic', async ({ page }) => {
    await page.getByRole('link', { name: 'темы', exact: true }).click()
    await page
      .getByRole('link', {
        name: 'Общество Статьи о политике, экономике и обществе, об актуальных событиях, людях, мнениях. Тексты про историю и современность, про то, что происходит в России и мире'
      })
      .click()
    await page.getByRole('button', { name: 'Подписаться на тему' }).click()
    await expect(page.getByRole('button', { name: 'Отписаться от темы' })).toBeVisible()
  })
  test('Unfollow topic', async ({ page }) => {
    await page.getByRole('link', { name: 'темы', exact: true }).click()
    await page
      .getByRole('link', {
        name: 'Общество Статьи о политике, экономике и обществе, об актуальных событиях, людях, мнениях. Тексты про историю и современность, про то, что происходит в России и мире'
      })
      .click()
    await page.getByRole('button', { name: 'Отписаться от темы' }).click()
    await expect(page.getByRole('button', { name: 'Подписаться на тему' })).toBeVisible()
  })
})
