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
  async mockRegistration(isSuccess = true): Promise<void> {
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
  async mockPasswordRecovery(isSuccess = true): Promise<void> {
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
  async mockSlowConnection(delay = 5000): Promise<void> {
    await this.page.route('**/graphql', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, delay))
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
export const DataGenerator = {
  /**
   * Генерирует случайный email
   */
  randomEmail: (): string => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    return `test+${timestamp}+${random}@example.com`
  },

  /**
   * Генерирует случайную строку
   */
  randomString: (length = 10): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },

  /**
   * Генерирует тестовую статью
   */
  sampleArticle: () => ({
    title: `Тестовая статья ${Date.now()}`,
    lead: 'Это тестовая статья для проверки функциональности',
    body: 'Содержимое тестовой статьи с достаточным количеством текста для проверки различных сценариев тестирования.'
  }),

  /**
   * Генерирует тестовый комментарий
   */
  sampleComment: () => ({
    text: `Тестовый комментарий ${Date.now()}`,
    author: 'Тестовый пользователь'
  })
}

/**
 * Вспомогательные функции для OAuth тестирования
 */
export const OAuthFixtures = {
  /**
   * Устанавливает мок OAuth state в localStorage
   */
  setOAuthState: async (page: Page, state: string, provider: string): Promise<void> => {
    await page.addInitScript(
      (stateData) => {
        const oauthState = {
          state: stateData.state,
          provider: stateData.provider,
          timestamp: Date.now(),
          redirectUri: 'https://localhost:3000'
        }
        localStorage.setItem('oauth_state', JSON.stringify(oauthState))
      },
      { state, provider }
    )
  },

  /**
   * Устанавливает истекший OAuth state
   */
  setExpiredOAuthState: async (page: Page, state: string, provider: string): Promise<void> => {
    await page.addInitScript(
      (stateData) => {
        const expiredTimestamp = Date.now() - 15 * 60 * 1000 // 15 минут назад
        const oauthState = {
          state: stateData.state,
          provider: stateData.provider,
          timestamp: expiredTimestamp,
          redirectUri: 'https://localhost:3000'
        }
        localStorage.setItem('oauth_state', JSON.stringify(oauthState))
      },
      { state, provider }
    )
  },

  /**
   * Мок OAuth редиректа
   */
  mockOAuthRedirect: async (page: Page): Promise<void> => {
    await page.route('**/oauth/**', (route) => {
      route.fulfill({
        status: 200,
        body: 'OAuth redirect intercepted for testing'
      })
    })
  }
}
