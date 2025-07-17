import { expect, Page } from '@playwright/test'
import { baseUrl, waitForPageLoad } from './common'

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
    email: process.env.TEST_LOGIN || 'test@example.com',
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
 * Универсальная функция авторизации
 */
export async function performLogin(page: Page, credentials: AuthCredentials): Promise<boolean> {
  try {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Открываем форму входа
    await page.getByRole('link', { name: 'Войти' }).click()
    await expect(page.getByPlaceholder('Почта')).toBeVisible({ timeout: 10000 })

    // Заполняем поля
    await page.getByPlaceholder('Почта').fill(credentials.email)
    await page.getByPlaceholder('Пароль').fill(credentials.password)

    // Отправляем форму
    await page.getByRole('button', { name: 'Войти' }).click()

    // Проверяем успешность входа
    await page.waitForTimeout(2000)

    const loginButton = page.getByRole('button', { name: 'Войти' })
    const isLoggedIn = !(await loginButton.isVisible())

    return isLoggedIn
  } catch (error) {
    console.warn('Ошибка авторизации:', error)
    return false
  }
}

/**
 * Универсальная функция регистрации
 */
export async function performRegistration(page: Page, user: MockUser): Promise<boolean> {
  try {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Открываем форму регистрации
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()
    await expect(page.locator('input[name="fullName"]')).toBeVisible({ timeout: 10000 })

    // Заполняем поля
    await page.getByPlaceholder('Имя и фамилия').fill(user.fullName)
    await page.getByPlaceholder('Почта').fill(user.email)
    await page.getByPlaceholder('Пароль').fill(user.password)

    // Отправляем форму
    await page.getByRole('button', { name: 'Присоединиться' }).click()

    // Проверяем результат
    await page.waitForTimeout(2000)

    const successMessage = page.getByText('Почти готово! Проверьте email')
    const isRegistered = await successMessage.isVisible()

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
    const loginButton = page.getByRole('button', { name: 'Войти' })
    const profileElement = page.locator('.userpic, [data-testid="user-avatar"]')

    const loginVisible = await loginButton.isVisible()
    const profileVisible = await profileElement.isVisible()

    return !loginVisible && profileVisible
  } catch {
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
export async function switchAuthForm(
  page: Page,
  targetForm: 'login' | 'register' | 'recovery'
): Promise<void> {
  const switchMap = {
    login: 'У меня есть аккаунт',
    register: 'У меня еще нет аккаунта',
    recovery: 'Забыли пароль?'
  }

  const switchText = switchMap[targetForm]
  await page.getByText(switchText).click()
  await page.waitForTimeout(500)
}
