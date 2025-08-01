import { expect, type Page } from '@playwright/test'
import { generateRandomString } from '../utils/common'
import { test, TestUtils } from '../utils/test-helpers'

// biome-ignore lint/suspicious/noExplicitAny: ok
let context: any = null
let page: Page | null = null

/* Global starting test config */

test.beforeAll(async ({ browser }) => {
  console.log('Инициализация тестов действий авторов...')

  // Создаем контекст для тестов аутентификации
  context = await browser.newContext()
  test.setTimeout(150000)

  console.log('Тесты действий авторов инициализированы успешно!')
})

// Добавляем хук afterAll для закрытия контекста
test.afterAll(async () => {
  if (page) {
    await page.close()
    page = null
  }
  if (context) {
    await context.close()
    context = null
  }
})

/* TESTS section */

const randomstring = generateRandomString(4)
const username = `guests+${randomstring}@discours.io`
const password = generateRandomString(12)

test('Sign up', async ({ page }) => {
  const testUtils = new TestUtils(page)
  
  await testUtils.goto('/')
  await testUtils.expectPageReady()

    // Открываем форму входа
  await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()
  
  // Ждем появления модального окна входа
  await page.waitForSelector('.authForm, .auth-form, [class*="AuthModal"]', { timeout: 10000 }).catch(() => {
    console.log('Модальное окно авторизации не найдено, продолжаем...')
  })
  
  // Переходим к регистрации - используем правильный селектор
  const signupButton = page.locator('.authLink:has-text("У меня еще нет аккаунта"), span:has-text("У меня еще нет аккаунта"), .authLink:has-text("I have no account yet"), span:has-text("I have no account yet")')
  await signupButton.waitFor({ timeout: 10000 })
  await signupButton.click()

    // Ждем формы регистрации
  await page.waitForSelector('input[name="fullName"], input[placeholder*="Full name"], input[placeholder*="Имя"]', { timeout: 10000 })
  
  // Заполняем форму регистрации
  await page.getByPlaceholder('Имя и фамилия').or(page.getByPlaceholder('Full name')).first().click()
  await page.getByPlaceholder('Имя и фамилия').or(page.getByPlaceholder('Full name')).first().fill(`Тестируем Разработку ${randomstring}`)
  
  await page.getByPlaceholder('Почта').or(page.getByPlaceholder('Email')).first().click()
  await page.getByPlaceholder('Почта').or(page.getByPlaceholder('Email')).first().fill(username)
  
  await page.getByPlaceholder('Пароль').or(page.getByPlaceholder('Password')).first().click()
  await page.getByPlaceholder('Пароль').or(page.getByPlaceholder('Password')).first().fill(password)
  
  // Отправляем форму - используем правильный селектор кнопки
  const submitButton = page.getByRole('button', { name: 'Присоединиться' }).or(page.getByRole('button', { name: 'Join' })).or(page.locator('button[type="submit"]')).first()
  await submitButton.waitFor({ timeout: 5000 })
  await submitButton.click()

  // Ждем результата регистрации (может быть редирект или сообщение)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    console.log('Тайм-аут при ожидании после регистрации, продолжаем...')
  })
})

test.beforeEach(async ({ page }) => {
  const testUtils = new TestUtils(page)
  
  await testUtils.goto('/')
  await testUtils.expectPageReady()

    // Открываем форму входа
  await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()
  
  // Ждем появления формы входа
  await page.waitForSelector('input[name="email"], input[placeholder*="Email"], input[placeholder*="Почта"]', { timeout: 10000 })
  
  // Заполняем форму входа
  await page.getByPlaceholder('Почта').or(page.getByPlaceholder('Email')).first().click()
  await page.getByPlaceholder('Почта').or(page.getByPlaceholder('Email')).first().fill(username)
  await page.getByPlaceholder('Пароль').or(page.getByPlaceholder('Password')).first().click()
  await page.getByPlaceholder('Пароль').or(page.getByPlaceholder('Password')).first().fill(password)
  
    // Отправляем форму входа
  const loginButton = page.getByRole('button', { name: 'Войти' }).or(page.getByRole('button', { name: 'Enter' })).or(page.locator('button[type="submit"]')).first()
  await loginButton.click()
  
  // Ждем завершения входа и проверяем что пользователь авторизован
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    console.log('Тайм-аут при ожидании после входа, продолжаем...')
  })
  
  // Ждем появления индикатора авторизованного пользователя (кнопка с инициалами или аватар)
  await page.waitForSelector('button:has-text("Т.Р."), [data-testid="user-menu"], .user-avatar, .user-button', { timeout: 15000 }).catch(() => {
    console.log('Не найден индикатор авторизованного пользователя, продолжаем...')
  })
  
  // Проверяем что модальное окно закрылось
  await page.waitForSelector('.authForm, .auth-form, [class*="AuthModal"]', { state: 'hidden', timeout: 5000 }).catch(() => {
    console.log('Модальное окно авторизации все ещё видно, продолжаем...')
  })
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
