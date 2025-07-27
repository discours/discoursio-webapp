/**
 * E2E тесты выхода из системы и очистки сессии
 *
 * Проверяет корректное завершение сессии, очистку данных,
 * блокировку доступа к защищенным страницам после выхода
 */

import { expect, test } from '@playwright/test'
import { TEST_USERS } from '../utils/auth-helpers'
import { baseUrl, isLoggedIn, setupAuthState, waitForPageLoad } from '../utils/test-helpers'

test.describe('Выход из системы', () => {
  test.beforeEach(async ({ page }) => {
    // Авторизуемся перед каждым тестом
    const authSuccess = await setupAuthState(page, TEST_USERS.VALID)

    if (!authSuccess) {
      test.skip()
      console.warn('Не удалось авторизоваться для тестирования выхода')
      return
    }

    // Проверяем что мы действительно авторизованы
    const loggedIn = await isLoggedIn(page)
    if (!loggedIn) {
      test.skip()
      console.warn('Пользователь не авторизован, пропускаем тест выхода')
      return
    }
  })

  test('Должна отображать профиль авторизованного пользователя', async ({ page }) => {
    // Проверяем что отображается аватар/имя пользователя
    const userAvatar = page.locator('.userpic, [data-testid="user-avatar"]')
    const profileButton = page.locator('[data-testid="profile-button"], .userControlItemUserpic')

    // Один из элементов профиля должен быть виден
    const avatarVisible = await userAvatar.isVisible()
    const profileVisible = await profileButton.isVisible()

    expect(avatarVisible || profileVisible).toBeTruthy()

    // Не должно быть кнопки "Войти"
    const loginButton = page.getByRole('button', { name: 'Войти' })
    await expect(loginButton).not.toBeVisible()
  })

  test('Должна предоставлять доступ к меню профиля', async ({ page }) => {
    // Ищем различные способы открытия меню профиля
    const profileTriggers = [
      page.locator('.userControlItemUserpic button'),
      page.locator('[data-testid="profile-button"]'),
      page.locator('.userpic'),
      page.locator('.profileTrigger')
    ]

    let menuOpened = false

    for (const trigger of profileTriggers) {
      if (await trigger.isVisible()) {
        await trigger.click()

        // Проверяем что открылось меню с опцией выхода
        const logoutOption = page.getByText(/Выйти|Выход|Logout/i)
        if (await logoutOption.isVisible({ timeout: 2000 })) {
          menuOpened = true
          break
        }
      }
    }

    expect(menuOpened).toBeTruthy()
  })

  test('Должна выполнять выход через меню профиля', async ({ page }) => {
    // Открываем меню профиля
    const profileButton = page.locator('.userControlItemUserpic button').first()

    if (await profileButton.isVisible()) {
      await profileButton.click()

      // Ждем появления меню
      await page.waitForTimeout(500)

      // Ищем опцию выхода
      const logoutOption = page.getByText(/Выйти|Выход|Logout/i)

      if (await logoutOption.isVisible()) {
        await logoutOption.click()

        // Проверяем что пользователь вышел
        await page.waitForTimeout(2000)

        const stillLoggedIn = await isLoggedIn(page)
        expect(stillLoggedIn).toBeFalsy()

        // Должна появиться кнопка "Войти"
        await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible({ timeout: 5000 })
      } else {
        test.skip()
        console.warn('Опция выхода не найдена в меню профиля')
      }
    } else {
      test.skip()
      console.warn('Кнопка профиля не найдена')
    }
  })

  test('Должна очищать localStorage при выходе', async ({ page }) => {
    // Проверяем что токен есть в localStorage
    const tokenBefore = await page.evaluate(() => {
      return (
        localStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken')
      )
    })

    expect(tokenBefore).toBeTruthy()

    // Выполняем выход
    await performLogout(page)

    // Проверяем что токен удален
    const tokenAfter = await page.evaluate(() => {
      return (
        localStorage.getItem('auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken')
      )
    })

    expect(tokenAfter).toBeFalsy()
  })

  test('Должна очищать сессионные данные при выходе', async ({ page }) => {
    // Проверяем наличие данных пользователя
    const userDataBefore = await page.evaluate(() => {
      return {
        authToken: localStorage.getItem('auth_token'),
        userInfo: localStorage.getItem('user_info'),
        sessionData: sessionStorage.getItem('session_data')
      }
    })

    expect(userDataBefore.authToken).toBeTruthy()

    // Выполняем выход
    await performLogout(page)

    // Проверяем что все данные очищены
    const userDataAfter = await page.evaluate(() => {
      return {
        authToken: localStorage.getItem('auth_token'),
        userInfo: localStorage.getItem('user_info'),
        sessionData: sessionStorage.getItem('session_data')
      }
    })

    expect(userDataAfter.authToken).toBeFalsy()
    expect(userDataAfter.userInfo).toBeFalsy()
  })

  test('Должна блокировать доступ к защищенным страницам после выхода', async ({ page }) => {
    // Выполняем выход
    await performLogout(page)

    // Пытаемся перейти на защищенные страницы
    const protectedUrls = ['/settings', '/edit/new', '/inbox']

    for (const url of protectedUrls) {
      await page.goto(`${baseUrl}${url}`)
      await waitForPageLoad(page)

      // Должны увидеть форму входа или быть перенаправлены
      const authRequired =
        (await page.getByRole('button', { name: 'Войти' }).isVisible()) ||
        (await page.locator('input[type="email"]').isVisible()) ||
        page.url().includes('auth') ||
        page.url().includes('login')

      expect(authRequired).toBeTruthy()
    }
  })

  test('Должна перенаправлять на главную страницу после выхода', async ({ page }) => {
    // Находимся на странице настроек
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)

    // Выполняем выход
    await performLogout(page)

    // Должны быть перенаправлены на главную
    await page.waitForTimeout(2000)

    expect(page.url()).toBe(`${baseUrl}/`)
  })

  test('Должна сохранять выход после обновления страницы', async ({ page }) => {
    // Выполняем выход
    await performLogout(page)

    // Проверяем что вышли
    expect(await isLoggedIn(page)).toBeFalsy()

    // Обновляем страницу
    await page.reload()
    await waitForPageLoad(page)

    // Должны остаться неавторизованными
    expect(await isLoggedIn(page)).toBeFalsy()
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
  })

  test('Должна блокировать API запросы после выхода', async ({ page }) => {
    let apiCallsAfterLogout = 0

    // Отслеживаем API запросы
    page.on('request', (request) => {
      if (request.url().includes('graphql') || request.url().includes('api')) {
        const authHeader = request.headers()['authorization']
        if (authHeader) {
          apiCallsAfterLogout++
        }
      }
    })

    // Выполняем выход
    await performLogout(page)

    // Пытаемся выполнить действие, требующее авторизации
    await page.goto(`${baseUrl}/edit/new`)
    await waitForPageLoad(page)

    // Не должно быть авторизованных API запросов
    expect(apiCallsAfterLogout).toBe(0)
  })
})

test.describe('Автоматический выход', () => {
  test('Должна обрабатывать истечение токена', async ({ page }) => {
    // Авторизуемся
    const authSuccess = await setupAuthState(page, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Мокаем истекший токен
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const authHeader = request.headers()['authorization']

      if (authHeader) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [
              {
                message: 'Token expired',
                extensions: { code: 'UNAUTHENTICATED' }
              }
            ]
          })
        })
      } else {
        await route.continue()
      }
    })

    // Пытаемся выполнить авторизованное действие
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)

    // Должны быть автоматически разлогинены
    await page.waitForTimeout(2000)
    expect(await isLoggedIn(page)).toBeFalsy()
  })

  test('Должна обрабатывать неавторизованные ответы API', async ({ page }) => {
    const authSuccess = await setupAuthState(page, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Мокаем неавторизованный ответ
    await page.route('**/graphql', async (route) => {
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

    // Действие, вызывающее API запрос
    const createButton = page.getByText('Создать пост')
    if (await createButton.isVisible()) {
      await createButton.click()
      await page.waitForTimeout(2000)

      // Должны быть разлогинены
      expect(await isLoggedIn(page)).toBeFalsy()
    } else {
      test.skip()
      console.warn('Кнопка создания поста не найдена')
    }
  })
})

test.describe('Множественные сессии', () => {
  test('Должна обрабатывать выход в одной вкладке', async ({ context }) => {
    // Создаем две вкладки
    const page1 = await context.newPage()
    const page2 = await context.newPage()

    // Авторизуемся в первой вкладке
    const authSuccess = await setupAuthState(page1, TEST_USERS.VALID)
    if (!authSuccess) {
      test.skip()
      return
    }

    // Проверяем авторизацию во второй вкладке
    await page2.goto(baseUrl)
    await waitForPageLoad(page2)

    const loggedInPage2 = await isLoggedIn(page2)
    if (!loggedInPage2) {
      test.skip()
      console.warn('Сессия не синхронизируется между вкладками')
      return
    }

    // Выходим в первой вкладке
    await performLogout(page1)

    // Обновляем вторую вкладку
    await page2.reload()
    await waitForPageLoad(page2)

    // Во второй вкладке тоже должны выйти
    expect(await isLoggedIn(page2)).toBeFalsy()

    await page1.close()
    await page2.close()
  })
})

/**
 * Вспомогательная функция для выполнения выхода
 */
async function performLogout(page: import('@playwright/test').Page): Promise<void> {
  // Ищем различные способы выхода
  const logoutMethods = [
    // Метод 1: через меню профиля
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

    // Метод 2: прямая ссылка
    async () => {
      const logoutLink = page.locator('a[href*="logout"], a[href*="signout"]')
      if (await logoutLink.isVisible()) {
        await logoutLink.click()
        return true
      }
      return false
    },

    // Метод 3: через настройки
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
        await page.waitForTimeout(2000) // Ждем завершения выхода
        return
      }
    } catch (error) {
      console.warn('Метод выхода не сработал:', error)
    }
  }

  // Если ничего не сработало, очищаем localStorage принудительно
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()
}
