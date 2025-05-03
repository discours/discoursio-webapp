/**
 * Вспомогательные функции для тестов
 *
 * Содержит общие утилиты и функции, используемые в тестах
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { Page } from '@playwright/test'
import { config } from 'dotenv'

// Загружаем переменные окружения из .env файла
config()

// Базовый URL - должен соответствовать запущенному локальному серверу или значению из .env
export const baseUrl = process.env.BASE_URL || 'https://localhost:3000'

// Тестовые учетные данные из переменных окружения
export const TEST_CREDENTIALS = {
  email: process.env.TEST_USERNAME || 'test@example.com',
  password: process.env.TEST_PASSWORD || 'test_password',
  token: process.env.AUTH_TOKEN || ''
}

/**
 * Проверяет доступность сервера без его запуска
 * Для использования в beforeAll хуках тестовых файлов
 *
 * @param page - Экземпляр страницы Playwright
 * @returns {Promise<boolean>} - Возвращает true, если сервер доступен
 */
export async function checkServerWithoutStarting(page: Page): Promise<boolean> {
  try {
    console.log('Проверка доступности сервера...')
    await page.goto(baseUrl)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.warn('Тайм-аут при ожидании networkidle, продолжаем...')
    })
    console.log('Сервер доступен и отвечает')
    return true
  } catch (e) {
    console.error('Сервер недоступен:', e)
    return false
  }
}

/**
 * Проверяет, авторизован ли пользователь
 * @param page - Экземпляр страницы Playwright
 * @returns {Promise<boolean>} Возвращает true если пользователь авторизован
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Проверяем отсутствие кнопки входа
  const loginButton = page.getByRole('button', { name: 'Войти' })
  const isLoginButtonVisible = await loginButton.isVisible()

  // Если кнопка входа не видна, считаем что пользователь авторизован
  return !isLoginButtonVisible
}

/**
 * Выполняет вход пользователя в систему
 * @param page - Экземпляр страницы Playwright
 * @param email - Email пользователя
 * @param password - Пароль пользователя
 * @returns {Promise<boolean>} Возвращает true если вход успешно выполнен
 */
export async function login(
  page: Page,
  email = TEST_CREDENTIALS.email,
  password = TEST_CREDENTIALS.password
): Promise<boolean> {
  // Проверяем, возможно пользователь уже авторизован
  if (await isLoggedIn(page)) {
    return true
  }

  // Переходим на главную страницу
  await page.goto(baseUrl)
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    console.warn('Тайм-аут при ожидании networkidle, продолжаем...')
  })

  // Ищем и кликаем на кнопку входа
  const loginButton = page.getByRole('button', { name: 'Войти' })

  if (!(await loginButton.isVisible())) {
    // Если кнопка не видна, возможно пользователь уже авторизован
    return true
  }

  await loginButton.click()

  try {
    // Ждем появления элементов формы ввода
    await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 })
    await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 5000 })

    // Заполняем форму входа
    const emailInput = page.locator('input[type="email"]').first()
    const passwordInput = page.locator('input[type="password"]').first()

    await emailInput.fill(email)
    await passwordInput.fill(password)

    // Отправляем форму
    const submitButton = page.getByRole('button', { name: 'Войти' })
    await submitButton.click()

    // Ждем завершения авторизации
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // Дополнительная пауза для обработки авторизации
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      console.warn('Тайм-аут при ожидании networkidle после авторизации, продолжаем...')
    })

    // Проверяем успешный вход
    return await isLoggedIn(page)
  } catch (e) {
    console.warn('Не удалось выполнить вход:', e)
    return false
  }
}

/**
 * Устанавливает состояние аутентификации с помощью сохранения куки или localStorage
 * и проверяет, что авторизация работает
 * @param page - Экземпляр страницы Playwright
 * @param navigateToMain - Нужно ли переходить на главную страницу после авторизации
 * @returns {Promise<boolean>} Возвращает true, если авторизация успешна
 */
export async function setupAuthState(page: Page, navigateToMain = true): Promise<boolean> {
  // Если у нас есть токен, используем его
  if (TEST_CREDENTIALS.token) {
    try {
      // Переходим на сайт, чтобы установить домен для localStorage и cookies
      await page.goto(baseUrl)

      // Устанавливаем токен в localStorage с разными возможными именами
      await page.evaluate((token) => {
        localStorage.setItem('auth_token', token)
        localStorage.setItem('token', token)
        localStorage.setItem('accessToken', token)
        localStorage.setItem('jwt', token)
      }, TEST_CREDENTIALS.token)

      // Обновляем страницу для применения авторизации
      await page.reload()
      await waitForPageLoad(page)

      // Проверяем, что авторизация сработала
      const isAuthorized = await isLoggedIn(page)

      if (!isAuthorized) {
        console.warn('Авторизация через токен не сработала, пробуем через форму входа')
        return await login(page)
      }

      return true
    } catch (e) {
      console.warn('Ошибка при установке токена авторизации:', e)
    }
  }

  // Пробуем авторизоваться с помощью формы
  const loginSuccess = await login(page)

  // После авторизации переходим на главную страницу, если требуется
  if (loginSuccess && navigateToMain) {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
  }

  return loginSuccess
}

/**
 * Ожидает загрузки страницы и всех сетевых запросов
 * @param page - Экземпляр страницы Playwright
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
  } catch (_e) {
    console.warn('Тайм-аут при ожидании загрузки страницы, продолжаем тест...')
  }
}

/**
 * Создает заголовок для скриншота текущей тестовой страницы
 * @param testInfo - Имя текущего теста
 * @returns {string} - Имя файла скриншота
 */
export function getScreenshotName(testInfo: string): string {
  const date = new Date()
  const timestamp = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`
  return `./test-results/${testInfo.replace(/\s+/g, '_')}_${timestamp}.png`
}
