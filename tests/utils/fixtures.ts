import { Page } from '@playwright/test'

/**
 * Моковые данные для тестирования
 */
export const MOCK_DATA = {
  // Пользователи
  USERS: {
    VALID: {
      email: process.env.TEST_LOGIN || 'test@example.com',
      password: process.env.TEST_PASSWORD || 'testPassword123!',
      fullName: 'Тестовый Пользователь'
    },
    NEW: () => ({
      email: `test+${Date.now()}@example.com`,
      password: 'NewTestPassword123!',
      fullName: 'Новый Тестовый Пользователь'
    }),
    EXISTING: {
      email: 'existing@example.com',
      password: 'password123',
      fullName: 'Существующий Пользователь'
    }
  },

  // Контент
  CONTENT: {
    ARTICLE: {
      title: 'Тестовая статья',
      content: 'Это тестовая статья для проверки функциональности редактора'
    },
    COMMENT: {
      text: 'Тестовый комментарий для проверки системы комментариев'
    }
  },

  // Валидация
  VALIDATION: {
    INVALID_EMAILS: ['test', 'test@', '@example.com', 'test.example.com', 'test@.com'],
    WEAK_PASSWORDS: ['123', '123456', 'password', 'PASSWORD', 'pass'],
    STRONG_PASSWORDS: ['Password123!', 'MyStr0ngP@ssw0rd', 'ComplexPass1234#']
  },

  // API ответы
  API_RESPONSES: {
    SUCCESS: {
      login: { data: { login: { success: true, token: 'mock-token' } } },
      register: { data: { registerUser: { success: true } } },
      passwordReset: { data: { requestPasswordReset: { success: true } } }
    },
    ERRORS: {
      userNotFound: { data: { login: { success: false, error: 'user not found' } } },
      badCredentials: { data: { login: { success: false, error: 'bad user credentials' } } },
      emailNotVerified: { data: { login: { success: false, error: 'email not verified' } } },
      emailExists: { data: { registerUser: { success: false, error: 'Email already exists' } } }
    }
  }
} as const

/**
 * Настройка моков для различных сценариев
 */
export class MockManager {
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  /**
   * Мок успешной авторизации
   */
  async mockSuccessfulLogin(): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('Login')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DATA.API_RESPONSES.SUCCESS.login)
        })
      } else {
        await route.continue()
      }
    })
  }

  /**
   * Мок ошибки авторизации
   */
  async mockLoginError(errorType: 'userNotFound' | 'badCredentials' | 'emailNotVerified'): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('Login')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_DATA.API_RESPONSES.ERRORS[errorType])
        })
      } else {
        await route.continue()
      }
    })
  }

  /**
   * Мок регистрации пользователя
   */
  async mockRegistration(isSuccess: boolean = true): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('registerUser')) {
        const response = isSuccess 
          ? MOCK_DATA.API_RESPONSES.SUCCESS.register
          : MOCK_DATA.API_RESPONSES.ERRORS.emailExists

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      } else {
        await route.continue()
      }
    })
  }

  /**
   * Мок проверки существования email
   */
  async mockEmailCheck(emailExists: boolean): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('isEmailUsed')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { isEmailUsed: emailExists }
          })
        })
      } else {
        await route.continue()
      }
    })
  }

  /**
   * Мок восстановления пароля
   */
  async mockPasswordRecovery(isSuccess: boolean = true): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('requestPasswordReset')) {
        const response = isSuccess
          ? MOCK_DATA.API_RESPONSES.SUCCESS.passwordReset
          : MOCK_DATA.API_RESPONSES.ERRORS.userNotFound

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        })
      } else {
        await route.continue()
      }
    })
  }

  /**
   * Мок сетевых ошибок
   */
  async mockNetworkError(): Promise<void> {
    await this.page.route('**/graphql', (route) => {
      route.abort('failed')
    })
  }

  /**
   * Мок медленного соединения
   */
  async mockSlowConnection(delay: number = 5000): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      await new Promise(resolve => setTimeout(resolve, delay))
      await route.continue()
    })
  }

  /**
   * Мок 401 (неавторизован)
   */
  async mockUnauthorized(): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            {
              message: 'Unauthorized',
              extensions: { code: 'UNAUTHENTICATED' }
            }
          ]
        })
      })
    })
  }

  /**
   * Мок ошибки сервера (500)
   */
  async mockServerError(): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            {
              message: 'Internal Server Error'
            }
          ]
        })
      })
    })
  }

  /**
   * Очистка всех моков
   */
  async clearMocks(): Promise<void> {
    await this.page.unroute('**/graphql')
  }
}

/**
 * Генераторы тестовых данных
 */
export class DataGenerator {
  /**
   * Генерирует случайную строку
   */
  static randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Генерирует уникальный email
   */
  static uniqueEmail(domain: string = 'example.com'): string {
    return `test+${this.randomString(8)}@${domain}`
  }

  /**
   * Генерирует данные пользователя
   */
  static user(overrides: Partial<{email: string, password: string, fullName: string}> = {}) {
    return {
      email: overrides.email || this.uniqueEmail(),
      password: overrides.password || 'TestPassword123!',
      fullName: overrides.fullName || `Test User ${this.randomString(4)}`,
      ...overrides
    }
  }

  /**
   * Генерирует контент статьи
   */
  static article(overrides: Partial<{title: string, content: string}> = {}) {
    return {
      title: overrides.title || `Test Article ${this.randomString(4)}`,
      content: overrides.content || `This is test content for article ${this.randomString(6)}`,
      ...overrides
    }
  }
}

/**
 * Вспомогательные функции для OAuth тестирования
 */
export class OAuthFixtures {
  /**
   * Устанавливает мок OAuth state в localStorage
   */
  static async setOAuthState(page: Page, state: string, provider: string): Promise<void> {
    await page.addInitScript((stateData) => {
      const oauthState = {
        state: stateData.state,
        provider: stateData.provider,
        timestamp: Date.now(),
        redirectUri: 'http://localhost:3001'
      }
      localStorage.setItem('oauth_state', JSON.stringify(oauthState))
    }, { state, provider })
  }

  /**
   * Устанавливает истекший OAuth state
   */
  static async setExpiredOAuthState(page: Page, state: string, provider: string): Promise<void> {
    await page.addInitScript((stateData) => {
      const expiredTimestamp = Date.now() - 15 * 60 * 1000 // 15 минут назад
      const oauthState = {
        state: stateData.state,
        provider: stateData.provider,
        timestamp: expiredTimestamp,
        redirectUri: 'http://localhost:3001'
      }
      localStorage.setItem('oauth_state', JSON.stringify(oauthState))
    }, { state, provider })
  }

  /**
   * Мок OAuth редиректа
   */
  static async mockOAuthRedirect(page: Page): Promise<void> {
    await page.route('**/oauth/**', (route) => {
      route.fulfill({
        status: 200,
        body: 'OAuth redirect intercepted for testing'
      })
    })
  }
} 