// biome-ignore lint/correctness/noNodejsModules: <explanation>
import { type Page, expect, test } from '@playwright/test'
import { baseUrl, checkServerWithoutStarting } from './utils/test-helpers'

const TEST_PASSWORD = process.env.TEST_PASSWORD
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let context: any = null;
let page: Page | null = null;

/* Global starting test config */

test.beforeAll(async ({ browser }) => {
  console.log('Инициализация тестов действий авторов...')
  
  // Создаем контекст и страницу
  context = await browser.newContext()
  page = await context.newPage()
  test.setTimeout(150000)
  
  if (page) {
    // Проверяем доступность сервера без его запуска
    await checkServerWithoutStarting(page)
  
    // Проверяем, что страница загрузилась корректно
    // biome-ignore lint/performance/useTopLevelRegex: <explanation>
    await expect(page).toHaveTitle(/Дискурс/)
    await page.getByRole('link', { name: 'Войти' }).click()
    console.log('Тесты действий авторов инициализированы успешно!')
  
    // Закрываем страницу
    await page.close()
    page = null; // Устанавливаем null после закрытия
  }
})

// Добавляем хук afterAll для закрытия контекста
test.afterAll(async () => {
  if (page) {
    await page.close();
    page = null;
  }
  if (context) {
    await context.close();
    context = null;
  }
});

/* TESTS section */

/* Random Generator */
function generateRandomString(length = 10) {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

const randomstring = generateRandomString(4)

test('Sign up', async ({ page }) => {
  await page.goto('/')
  /* test.setTimeout(80000); */
  await page.getByRole('link', { name: 'Войти' }).click()
  await page.getByRole('link', { name: 'У меня еще нет аккаунта' }).click()
  await page.getByPlaceholder('Имя и фамилия').click()
  await page.getByPlaceholder('Имя и фамилия').fill('Тестируем Разработку')
  await page.getByPlaceholder('Почта').click()
  await page.getByPlaceholder('Почта').fill(`guests+${randomstring}@discours.io`)
  await page.getByPlaceholder('Пароль').click()
  if (TEST_PASSWORD) {
    await page.getByPlaceholder('Пароль').fill(TEST_PASSWORD)
  }
  await page.getByRole('button', { name: 'Присоединиться' }).click()
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  /* test.setTimeout(80000); */
  await page.getByRole('link', { name: 'Войти' }).click()
  await page.getByPlaceholder('Почта').click()
  await page.getByPlaceholder('Почта').fill(`guests+${randomstring}@discours.io`)
  await page.getByPlaceholder('Пароль').click()
  if (TEST_PASSWORD) {
    await page.getByPlaceholder('Пароль').fill(TEST_PASSWORD)
  }
  await page.getByRole('button', { name: 'Войти' }).click()
})

test.describe('Author Actions', () => {
  test('Author sandwitch menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Т.Р.' }).click()
    await expect(page.getByRole('link', { name: 'Профиль' })).toBeVisible()
    await page.getByRole('button', { name: 'Т.Р.' }).click()
  })
  test('Follow author', async ({ page }) => {
    await page.getByRole('link', { name: 'авторы', exact: true }).click()
    await page.getByRole('link', { name: 'Дискурс На сайте c 16 июня' }).click()
    await page.getByRole('button', { name: 'Подписаться' }).click()
    await expect(page.getByRole('main').getByRole('button', { name: 'Вы подписаны' })).toBeVisible()
  })
  test('Unfollow author', async ({ page }) => {
    await page.getByRole('link', { name: 'авторы', exact: true }).click()
    await page.getByRole('link', { name: 'Дискурс На сайте c 16 июня' }).click()
    await page.getByRole('button', { name: 'Вы подписаны' }).click()
    await expect(page.getByRole('main').getByRole('button', { name: 'Подписаться' })).toBeVisible()
  })
  test('Change author profile', async ({ page }) => {
    await page.getByRole('button', { name: 'Т.Р.' }).click()
    await page.getByRole('link', { name: 'Профиль' }).click()
    await page.getByRole('button', { name: 'Редактировать профиль' }).click()
    await page.locator('.tiptap').click()
    const randomString = generateRandomString()
    const currentDate = new Date()
    await page.locator('.tiptap').fill(`test: ${randomString} ${currentDate}`)
    try {
      const button = await page.getByRole('button', { name: 'Сохранить настройки' })
      await button.click()
    } catch (error) {
      console.warn('Button has disappeared', error)
    }
    await expect(page.getByText(`test: ${randomString} ${currentDate}`)).toBeVisible()
  })
})
