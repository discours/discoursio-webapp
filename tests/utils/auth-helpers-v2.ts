/**
 * Улучшенные хелперы для авторизации в E2E тестах
 * Объединяет все рабочие подходы в единый интерфейс
 */

import type { Page } from '@playwright/test'

export interface AuthHelpers {
  // Основные методы авторизации
  performLogin(): Promise<boolean>
  performLogout(): Promise<boolean>
  checkAuthStatus(): Promise<boolean>

  // Вспомогательные методы
  fillLoginForm(email: string, password: string): Promise<void>
  waitForAuthCompletion(): Promise<boolean>
  // biome-ignore lint/suspicious/noExplicitAny: test
  findLoginButton(): Promise<any>
  findLoginForm(): Promise<boolean>
}

export class AuthTestHelpers implements AuthHelpers {
  private readonly defaultEmail: string
  private readonly defaultPassword: string

  constructor(private page: Page) {
    this.defaultEmail = process.env.TEST_USERNAME || 'guests@discours.io'
    this.defaultPassword = process.env.TEST_PASSWORD || 'srwgRNbdkNs^J5yA'
  }

  async performLogin(email?: string, password?: string): Promise<boolean> {
    const testEmail = email || this.defaultEmail
    const testPassword = password || this.defaultPassword

    console.log('[AuthHelpers] 🔐 Начинаем авторизацию...')

    try {
      // Проверяем, не авторизованы ли мы уже
      if (await this.checkAuthStatus()) {
        console.log('[AuthHelpers] ✅ Пользователь уже авторизован')
        return true
      }

      // Ищем кнопку входа
      const loginButton = await this.findLoginButton()
      if (!loginButton) {
        console.log('[AuthHelpers] ❌ Кнопка входа не найдена')
        return false
      }

      await loginButton.click()
      console.log('[AuthHelpers] 🖱️ Кликнули на кнопку входа')

      // Ждем появления формы
      const hasForm = await this.findLoginForm()
      if (!hasForm) {
        console.log('[AuthHelpers] ❌ Форма входа не появилась')
        return false
      }

      // Заполняем форму
      await this.fillLoginForm(testEmail, testPassword)

      // Отправляем форму
      const submitButton = this.page.locator('button[type="submit"], button:has-text("Войти")').first()
      await submitButton.click()
      console.log('[AuthHelpers] 📤 Форма отправлена')

      // Ждем завершения авторизации
      const authSuccess = await this.waitForAuthCompletion()

      if (authSuccess) {
        console.log('[AuthHelpers] ✅ Авторизация успешна!')
      } else {
        console.log('[AuthHelpers] ❌ Авторизация не удалась')
      }

      return authSuccess
    } catch (error) {
      console.log('[AuthHelpers] ❌ Ошибка при авторизации:', error)
      return false
    }
  }

  async performLogout(): Promise<boolean> {
    console.log('[AuthHelpers] 🚪 Выходим из системы...')

    try {
      // Ищем меню пользователя или кнопку выхода
      const userMenuSelectors = [
        '[data-testid="user-menu"]',
        '.user-menu',
        '.profile-menu',
        'button:has-text("Т.Р.")',
        '.user-avatar',
        '.user-button'
      ]

      let userMenu = null
      for (const selector of userMenuSelectors) {
        const element = this.page.locator(selector).first()
        const isVisible = await element.isVisible().catch(() => false)

        if (isVisible) {
          userMenu = element
          break
        }
      }

      if (userMenu) {
        await userMenu.click()
        await this.page.waitForTimeout(1000)

        // Ищем кнопку выхода
        const logoutButton = this.page
          .locator('button:has-text("Выйти"), a:has-text("Выйти"), [data-testid="logout"]')
          .first()
        const logoutVisible = await logoutButton.isVisible().catch(() => false)

        if (logoutVisible) {
          await logoutButton.click()
          console.log('[AuthHelpers] ✅ Выход выполнен')
          return true
        }
      }

      console.log('[AuthHelpers] ❌ Кнопка выхода не найдена')
      return false
    } catch (error) {
      console.log('[AuthHelpers] ❌ Ошибка при выходе:', error)
      return false
    }
  }

  async checkAuthStatus(): Promise<boolean> {
    // Проверяем наличие индикаторов авторизованного пользователя
    const authIndicators = [
      'button:has-text("Т.Р.")',
      '[data-testid="user-menu"]',
      '.user-avatar',
      '.user-button',
      '.profile-menu'
    ]

    for (const selector of authIndicators) {
      const isVisible = await this.page
        .locator(selector)
        .first()
        .isVisible()
        .catch(() => false)
      if (isVisible) {
        return true
      }
    }

    // Проверяем отсутствие кнопки входа
    const loginVisible = await this.page
      .locator('a:has-text("Войти"), button:has-text("Войти")')
      .first()
      .isVisible()
      .catch(() => false)

    return !loginVisible
  }

  async fillLoginForm(email: string, password: string): Promise<void> {
    console.log('[AuthHelpers] 📝 Заполняем форму входа...')

    // Заполняем email
    const emailSelectors = [
      'input[placeholder="Почта"]',
      'input[placeholder="Email"]',
      'input[type="email"]',
      'input[name="email"]'
    ]

    let emailFilled = false
    for (const selector of emailSelectors) {
      try {
        const emailInput = this.page.locator(selector).first()
        const isVisible = await emailInput.isVisible().catch(() => false)

        if (isVisible) {
          await emailInput.fill(email)
          emailFilled = true
          console.log(`[AuthHelpers] ✅ Email заполнен: ${email}`)
          break
        }
      } catch (_e) {
        // Продолжаем поиск
      }
    }

    if (!emailFilled) {
      throw new Error('Поле email не найдено')
    }

    // Заполняем пароль
    const passwordSelectors = [
      'input[placeholder="Пароль"]',
      'input[placeholder="Password"]',
      'input[type="password"]',
      'input[name="password"]'
    ]

    let passwordFilled = false
    for (const selector of passwordSelectors) {
      try {
        const passwordInput = this.page.locator(selector).first()
        const isVisible = await passwordInput.isVisible().catch(() => false)

        if (isVisible) {
          await passwordInput.fill(password)
          passwordFilled = true
          console.log('[AuthHelpers] ✅ Пароль заполнен')
          break
        }
      } catch (_e) {
        // Продолжаем поиск
      }
    }

    if (!passwordFilled) {
      throw new Error('Поле пароля не найдено')
    }
  }

  async waitForAuthCompletion(): Promise<boolean> {
    console.log('[AuthHelpers] ⏳ Ждем завершения авторизации...')

    try {
      // Ждем GraphQL запроса (если есть)
      await this.page
        .waitForResponse((response) => response.url().includes('graphql'), { timeout: 10000 })
        .catch(() => console.log('[AuthHelpers] GraphQL запрос не обнаружен'))

      // Дополнительное ожидание
      await this.page.waitForTimeout(3000)

      // Ждем изменения URL или исчезновения формы входа
      await Promise.race([
        this.page.waitForURL((url: URL) => !url.href.includes('m=auth'), { timeout: 15000 }),
        this.page.waitForFunction(
          () => {
            const loginForm = document.querySelector('input[placeholder="Почта"], input[placeholder="Email"]')
            return !loginForm
          },
          { timeout: 15000 }
        )
      ]).catch(() => console.log('[AuthHelpers] Таймаут ожидания изменений'))

      // Финальная проверка статуса
      await this.page.waitForTimeout(2000)
      return await this.checkAuthStatus()
    } catch (error) {
      console.log('[AuthHelpers] ❌ Ошибка при ожидании завершения авторизации:', error)
      return false
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: test
  async findLoginButton(): Promise<any> {
    const loginSelectors = [
      'a:has-text("Войти")',
      'button:has-text("Войти")',
      'a:has-text("Login")',
      'button:has-text("Login")',
      '[data-testid="login-button"]',
      'a[href*="auth"]',
      'a[href*="login"]'
    ]

    for (const selector of loginSelectors) {
      const element = this.page.locator(selector).first()
      const isVisible = await element.isVisible().catch(() => false)

      if (isVisible) {
        console.log(`[AuthHelpers] ✅ Кнопка входа найдена: ${selector}`)
        return element
      }
    }

    console.log('[AuthHelpers] ❌ Кнопка входа не найдена')
    return null
  }

  async findLoginForm(): Promise<boolean> {
    const formSelectors = [
      'input[placeholder="Почта"]',
      'input[placeholder="Email"]',
      'input[type="email"]',
      'input[name="email"]',
      '.login-form',
      '[data-testid="auth-modal"]'
    ]

    // Ждем появления любого из селекторов формы
    try {
      await this.page.waitForSelector(formSelectors.join(', '), { timeout: 10000 })
      console.log('[AuthHelpers] ✅ Форма входа найдена')
      return true
    } catch (e) {
      console.log('[AuthHelpers] ❌ Форма входа не найдена', e)
      return false
    }
  }
}

// Фабричная функция для создания хелперов
export function createAuthHelpers(page: Page): AuthHelpers {
  return new AuthTestHelpers(page)
}

// Упрощенная функция для быстрой авторизации (обратная совместимость)
export async function quickLogin(page: Page): Promise<boolean> {
  const authHelpers = createAuthHelpers(page)
  return await authHelpers.performLogin()
}
