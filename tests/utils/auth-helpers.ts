import { expect, Page } from '@playwright/test'
import { baseUrl, waitForPageLoad } from './common'
import { AuthModal } from './page-objects'

/**
 * Получает локатор для кнопки/ссылки "Войти" с правильным селектором
 */
export function getLoginButton(page: Page) {
  return page.locator('a:has-text("Войти"), button:has-text("Войти")').first()
}

/**
 * Получает локатор для кнопки submit формы входа
 */
export function getLoginSubmitButton(page: Page) {
  return page.locator('button[type="submit"]:has-text("Войти"), form button:has-text("Войти")').first()
}

export interface AuthCredentials {
  email: string
  password: string
  fullName?: string
}

export interface MockUser {
  email: string
  password: string
  fullName: string
  isExisting?: boolean
}

/**
 * Стандартные тестовые пользователи
 */
export const TEST_USERS = {
  VALID: {
    email: process.env.TEST_USERNAME || 'test@example.com',
    password: process.env.TEST_PASSWORD || 'testPassword123!',
    fullName: 'Тестовый Пользователь'
  },
  NEW: {
    email: `test+${Date.now()}@example.com`,
    password: 'NewTestPassword123!',
    fullName: 'Новый Тестовый Пользователь'
  }
} as const

/**
 * Проверяет доступность API перед тестами
 */
export async function checkApiConnection(page: Page): Promise<boolean> {
  try {
    // Используем локальный GraphQL прокси вместо прямого API
    const apiUrl = '/graphql'
    console.log(`[API Test] Проверка подключения к локальному GraphQL прокси: ${apiUrl}`)

    const result = await page.evaluate(async (url) => {
      try {
        console.log(`[API Test] Выполняю POST запрос к локальному прокси: ${url}`)
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: '{ __typename }'
          })
        })

        console.log(`[API Test] Ответ локального прокси: ${response.status} ${response.statusText}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.log(`[API Test] Ошибка локального прокси: ${errorText}`)
          return false
        }

        const data = await response.json()
        console.log('[API Test] Успешный ответ от локального прокси:', data)
        return true
      } catch (error) {
        console.log(`[API Test] Ошибка подключения к локальному прокси ${url}:`, error)
        console.log(`[API Test] Тип ошибки: ${error instanceof Error ? error.name : 'Unknown'}`)
        console.log(`[API Test] Сообщение: ${error instanceof Error ? error.message : String(error)}`)
        return false
      }
    }, apiUrl)

    if (!result) {
      console.log(
        `[API Test] Локальный GraphQL прокси недоступен по адресу ${apiUrl}, тесты будут выполняться в режиме fallback`
      )
    } else {
      console.log(`[API Test] Локальный GraphQL прокси доступен по адресу ${apiUrl}`)
    }

    return result
  } catch (error) {
    console.warn('[API Test] Ошибка проверки локального GraphQL прокси:', error)
    return false
  }
}

/**
 * Универсальная функция авторизации
 */
export async function performLogin(page: Page): Promise<boolean> {
  try {
    console.log('[performLogin] Начинаем процесс авторизации...')

    // Проверяем доступность локального GraphQL прокси
    const apiAvailable = await checkApiConnection(page)
    if (!apiAvailable) {
      console.log('[performLogin] Локальный GraphQL прокси недоступен, но попробуем авторизацию')
    } else {
      console.log('[performLogin] Локальный GraphQL прокси доступен, авторизация возможна')
    }

    // Проверяем существующий аккаунт или создаем новый
    const account = await ensureTestAccount(page)

    if (!account.email) {
      console.log('[performLogin] Не удалось получить тестовый аккаунт')
      return false
    }

    console.log(`[performLogin] Используем аккаунт: ${account.email} (новый: ${account.isNew})`)

    // Добавляем обработчики ошибок для диагностики
    await page.evaluate(() => {
      window.addEventListener('error', (event) => {
        if (event.message.includes('graphql') || event.message.includes('API')) {
          console.log('[signIn] Локальный GraphQL прокси недоступен, авторизация невозможна')
          console.log('[signIn] URL запроса:', event.filename || 'unknown')
          console.log('[signIn] Ошибка:', event.message)
          console.log('[signIn] Стек:', event.error?.stack || 'no stack')
          event.preventDefault()
        }
      })

      const originalFetch = window.fetch
      window.fetch = function (...args) {
        const url = args[0]
        console.log(`[signIn] Fetch запрос к: ${url}`)

        return originalFetch
          .apply(this, args)
          .then((response) => {
            if (!response.ok) {
              console.log(`[signIn] Fetch ошибка ${response.status} для ${url}`)
            }
            return response
          })
          .catch((error) => {
            console.log(`[signIn] Fetch исключение для ${url}:`, error)
            throw error
          })
      }
    })

    // Проверяем что пользователь авторизован
    const loginStatus = await isUserLoggedIn(page)
    console.log('[performLogin] Финальный статус авторизации:', loginStatus)

    if (loginStatus) {
      console.log('[performLogin] Авторизация успешна')
      return true
    } else {
      console.log('[performLogin] Авторизация не удалась')
      return false
    }
  } catch (error) {
    console.error('[performLogin] Ошибка авторизации:', error)
    return false
  }
}

/**
 * Универсальная функция регистрации
 */
export async function performRegistration(page: Page, user?: MockUser): Promise<boolean> {
  try {
    console.log('[performRegistration] Начинаем процесс регистрации...')

    // Используем переданные данные или тестовые данные из переменных окружения
    const testUser = user || {
      email: process.env.TEST_USERNAME || 'test@example.com',
      password: process.env.TEST_PASSWORD || 'testpassword',
      fullName: 'Test User'
    }

    console.log(`[performRegistration] Используем данные: ${testUser.email}`)

    // Проверяем доступность API
    const apiAvailable = await checkApiConnection(page)
    if (!apiAvailable) {
      console.log('[performRegistration] API недоступен, но попробуем регистрацию')
    }

    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Открываем форму регистрации
    const loginButton = page.locator('a:has-text("Войти"), button:has-text("Войти")').first()
    await loginButton.click({ timeout: 10000 })

    // Переключаемся на форму регистрации
    const switchToRegister = page.getByText('У меня еще нет аккаунта')
    await switchToRegister.click()

    // Ждем появления формы регистрации
    await expect(page.locator('input[name="fullName"]')).toBeVisible({ timeout: 15000 })

    // Заполняем поля регистрации
    await page.locator('input[name="fullName"]').fill(testUser.fullName)
    await page.getByPlaceholder('Почта').fill(testUser.email)
    await page.getByPlaceholder('Пароль').fill(testUser.password)

    // Отправляем форму
    const submitButton = page.locator('button[type="submit"]:has-text("Присоединиться")').first()
    await submitButton.click()

    // Ждем завершения регистрации
    await page.waitForTimeout(3000)

    // Проверяем успешность регистрации
    const isRegistered = await isUserLoggedIn(page)

    if (isRegistered) {
      console.log('[performRegistration] Регистрация успешна')
    } else {
      console.log('[performRegistration] Регистрация не удалась')
    }

    return isRegistered
  } catch (error) {
    console.warn('Ошибка регистрации:', error)
    return false
  }
}

/**
 * Универсальная функция выхода
 */
export async function performLogout(page: Page): Promise<boolean> {
  try {
    // Пробуем различные способы выхода
    const logoutMethods = [
      // Через меню профиля
      async () => {
        const profileButton = page.locator('.userControlItemUserpic button').first()
        if (await profileButton.isVisible()) {
          await profileButton.click()
          await page.waitForTimeout(500)

          const logoutOption = page.getByText(/Выйти|Выход|Logout/i)
          if (await logoutOption.isVisible()) {
            await logoutOption.click()
            return true
          }
        }
        return false
      },
      // Через настройки
      async () => {
        await page.goto(`${baseUrl}/settings`)
        await waitForPageLoad(page)

        const logoutButton = page.getByText(/Выйти|Выход|Logout/i)
        if (await logoutButton.isVisible()) {
          await logoutButton.click()
          return true
        }
        return false
      }
    ]

    // Пробуем каждый метод
    for (const method of logoutMethods) {
      try {
        const success = await method()
        if (success) {
          await page.waitForTimeout(2000)
          return true
        }
      } catch (error) {
        console.warn('Метод выхода не сработал:', error)
      }
    }

    // Принудительная очистка
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload()
    return true
  } catch (error) {
    console.warn('Ошибка выхода:', error)
    return false
  }
}

/**
 * Проверка состояния авторизации
 */
export async function isUserLoggedIn(page: Page): Promise<boolean> {
  try {
    // Проверяем несколько индикаторов авторизации
    const loginButton = page.locator('a:has-text("Войти"), button:has-text("Войти")').first()
    const profileElement = page.locator(
      '.userpic, [data-testid="user-avatar"], [data-user-menu], button:has([src*="avatar"])'
    )
    const userMenu = page.locator('[data-user-menu], .user-menu, .profile-menu')
    const logoutButton = page.locator('button:has-text("Выйти"), a:has-text("Выйти"), [data-logout]')

    const loginVisible = await loginButton.isVisible()
    const profileVisible = await profileElement.isVisible()
    const userMenuVisible = await userMenu.isVisible()
    const logoutVisible = await logoutButton.isVisible()

    // Пользователь авторизован если:
    // 1. Кнопка входа НЕ видна И
    // 2. Есть профиль/аватар ИЛИ есть меню пользователя ИЛИ есть кнопка выхода
    const isLoggedIn = !loginVisible && (profileVisible || userMenuVisible || logoutVisible)

    console.log('[isUserLoggedIn]', {
      loginVisible,
      profileVisible,
      userMenuVisible,
      logoutVisible,
      isLoggedIn
    })

    return isLoggedIn
  } catch (error) {
    console.warn('[isUserLoggedIn] Ошибка проверки:', error)
    return false
  }
}

/**
 * Универсальная функция восстановления пароля
 */
export async function performPasswordRecovery(page: Page, email: string): Promise<boolean> {
  try {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Открываем форму восстановления
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('Забыли пароль?').click()
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 })

    // Заполняем email
    await page.locator('input[name="email"]').fill(email)

    // Отправляем запрос
    await page.getByRole('button', { name: 'Восстановить пароль' }).click()

    // Проверяем результат
    await page.waitForTimeout(2000)

    const successMessage = page.getByText(/Ссылка отправлена|Проверьте email/)
    return await successMessage.isVisible()
  } catch (error) {
    console.warn('Ошибка восстановления пароля:', error)
    return false
  }
}

/**
 * Переключение между формами авторизации
 */
export async function switchAuthForm(page: Page, targetForm: 'login' | 'register' | 'recovery'): Promise<void> {
  const switchMap = {
    login: 'У меня есть аккаунт',
    register: 'У меня еще нет аккаунта',
    recovery: 'Забыли пароль?'
  }

  const switchText = switchMap[targetForm]
  await page.getByText(switchText).click()
  await page.waitForTimeout(500)
}

/**
 * Регистрация нового тестового аккаунта
 * Создает уникальный email для каждого теста
 */
export async function registerNewTestAccount(
  page: Page
): Promise<{ email: string; password: string; success: boolean }> {
  try {
    console.log('[registerNewTestAccount] Начинаем регистрацию нового тестового аккаунта...')

    // Создаем уникальный email для теста
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const testEmail = `test-${timestamp}-${randomId}@discours.io`
    const testPassword = process.env.TEST_PASSWORD
    if (!testPassword) {
      throw new Error('TEST_PASSWORD is not set')
    }
    const testName = `Test User ${randomId}`

    console.log(`[registerNewTestAccount] Регистрируем: ${testEmail}`)

    // Проверяем доступность локального GraphQL прокси
    const apiAvailable = await checkApiConnection(page)
    if (!apiAvailable) {
      console.log('[registerNewTestAccount] Локальный GraphQL прокси недоступен, но попробуем регистрацию')
    } else {
      console.log('[registerNewTestAccount] Локальный GraphQL прокси доступен, регистрация возможна')
    }

    // Открываем форму регистрации
    const authModal = new AuthModal(page)
    await authModal.openRegisterForm()

    // Заполняем форму регистрации
    await authModal.fillRegisterForm(testName, testEmail, testPassword)
    await authModal.submitForm()

    // Ждем результат регистрации
    await page.waitForTimeout(3000)

    // Проверяем успешность регистрации
    const isRegistered = await isUserLoggedIn(page)
    console.log('[registerNewTestAccount] Статус регистрации:', isRegistered)

    if (isRegistered) {
      console.log('[registerNewTestAccount] Регистрация успешна')
      return { email: testEmail, password: testPassword, success: true }
    } else {
      console.log('[registerNewTestAccount] Регистрация не удалась')
      return { email: testEmail, password: testPassword, success: false }
    }
  } catch (error) {
    console.error('[registerNewTestAccount] Ошибка регистрации:', error)
    return { email: '', password: '', success: false }
  }
}

/**
 * Простая авторизация с существующим аккаунтом
 */
export async function ensureTestAccount(page: Page): Promise<{ email: string; password: string; isNew: boolean }> {
  try {
    console.log('[ensureTestAccount] Простая авторизация с существующим аккаунтом...')

    const existingUsername = process.env.TEST_USERNAME || 'guests@discours.io'
    const existingPassword = process.env.TEST_PASSWORD || 'test123'

    console.log(`[ensureTestAccount] Логин: ${existingUsername}`)

    // Переходим напрямую к форме авторизации
    await page.goto(`${baseUrl}?m=auth`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Ждем появления формы входа
    await page.waitForSelector('input[placeholder="Почта"]', { timeout: 10000 })

    // Заполняем форму входа используя правильные placeholder'ы
    console.log('[ensureTestAccount] Заполняем форму входа...')
    await page.fill('input[placeholder="Почта"]', existingUsername)
    await page.fill('input[placeholder="Пароль"]', existingPassword)

    // Отправляем форму
    await page.click('button[type="submit"]')

    // Ждем результата авторизации
    await page.waitForTimeout(5000)

    // Проверяем статус авторизации
    const loginStatus = await isUserLoggedIn(page)
    console.log('[ensureTestAccount] Статус входа:', loginStatus)

    if (loginStatus) {
      console.log('[ensureTestAccount] ✅ Успешная авторизация!')
      return { email: existingUsername, password: existingPassword, isNew: false }
    } else {
      console.log('[ensureTestAccount] ❌ Авторизация не удалась')
      throw new Error('Не удалось авторизоваться. Проверьте TEST_USERNAME и TEST_PASSWORD в .env файле')
    }
  } catch (error) {
    console.error('[ensureTestAccount] Ошибка авторизации:', error)
    throw error
  }
}
