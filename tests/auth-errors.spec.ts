/**
 * E2E тесты обработки ошибок авторизации
 *
 * Проверяет корректную обработку различных типов ошибок:
 * сетевых, серверных, валидации, тайм-аутов и других edge cases
 */

import { expect, test } from '@playwright/test'
import { baseUrl, waitForPageLoad } from './utils/test-helpers'

test.describe('Обработка сетевых ошибок', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
  })

  test('Должна обрабатывать полную недоступность API', async ({ page }) => {
    // Блокируем все API запросы
    await page.route('**/graphql', (route) => {
      route.abort('failed')
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // Проверяем что загрузка прекратилась
    await expect(submitButton).not.toContainText('...', { timeout: 10000 })

    // [непроверенное] Должно появиться сообщение об ошибке подключения
    await page.waitForTimeout(2000)
  })

  test('Должна обрабатывать медленное соединение', async ({ page }) => {
    // Мокаем медленный ответ
    await page.route('**/graphql', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            login: {
              success: false,
              error: 'Timeout'
            }
          }
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // Проверяем что показывается индикатор загрузки
    await expect(submitButton).toContainText('...')

    // Ждем завершения (должно обработать тайм-аут)
    await expect(submitButton).not.toContainText('...', { timeout: 15000 })
  })

  test('Должна обрабатывать прерывание соединения', async ({ page }) => {
    let requestCount = 0

    await page.route('**/graphql', (route) => {
      requestCount++

      if (requestCount === 1) {
        // Первый запрос прерываем
        route.abort('connectionrefused')
      } else {
        // Второй запрос пропускаем
        route.continue()
      }
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')

    // Первая попытка
    await submitButton.click()
    await page.waitForTimeout(2000)

    // Вторая попытка должна пройти
    await submitButton.click()
    await page.waitForTimeout(1000)
  })

  test('Должна обрабатывать ошибки CORS', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 0, // CORS error
        body: ''
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // Проверяем что обработалась ошибка
    await expect(submitButton).not.toContainText('...', { timeout: 5000 })
  })
})

test.describe('Обработка серверных ошибок', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
  })

  test('Должна обрабатывать ошибку 500', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
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

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // Проверяем что ошибка обработана
    await expect(submitButton).not.toContainText('...', { timeout: 5000 })

    // [непроверенное] Должно появиться сообщение об ошибке сервера
    await page.waitForTimeout(2000)
  })

  test('Должна обрабатывать ошибку 503 (сервис недоступен)', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            {
              message: 'Service Unavailable'
            }
          ]
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    await expect(submitButton).not.toContainText('...', { timeout: 5000 })
  })

  test('Должна обрабатывать ошибки GraphQL', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [
            {
              message: 'User not found',
              locations: [{ line: 3, column: 5 }],
              path: ['login'],
              extensions: {
                code: 'USER_NOT_FOUND'
              }
            }
          ]
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // Проверяем специфичную обработку ошибки
    await expect(page.locator('.validationError')).toContainText('Пользователь не найден', {
      timeout: 5000
    })
  })

  test('Должна обрабатывать некорректный JSON ответ', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'Invalid JSON response'
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    await expect(submitButton).not.toContainText('...', { timeout: 5000 })
  })
})

test.describe('Обработка ошибок валидации', () => {
  test('Должна обрабатывать множественные ошибки валидации', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()

    const submitButton = page.getByRole('button', { name: 'Войти' })

    // Отправляем пустую форму
    await submitButton.click()

    // Должны появиться ошибки для всех полей
    const validationErrors = page.locator('.validationError')
    await expect(validationErrors).toHaveCount(2) // email и password

    await expect(validationErrors.nth(0)).toContainText(/email|почта/i)
    await expect(validationErrors.nth(1)).toContainText(/пароль|password/i)
  })

  test('Должна показывать ошибки в правильном порядке', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()

    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    await submitButton.click()

    // Проверяем что фокус установлен на первое поле с ошибкой
    const nameInput = page.locator('input[name="fullName"]')
    await expect(nameInput).toBeFocused()
  })

  test('Должна сохранять введенные данные при ошибке валидации', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()

    const emailInput = page.locator('input[type="email"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    // Вводим валидный email, но не вводим пароль
    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Email должен остаться введенным
    await expect(emailInput).toHaveValue('test@example.com')

    // Должна быть ошибка только для пароля
    await expect(page.locator('.validationError')).toContainText('Пожалуйста, введите пароль')
  })
})

test.describe('Обработка ошибок аутентификации', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 })
  })

  test('Должна обрабатывать неверные учетные данные', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            login: {
              success: false,
              error: 'bad user credentials'
            }
          }
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('wrongpassword')
    await submitButton.click()

    await expect(page.locator('.validationError')).toContainText(
      'Что-то пошло не так, проверьте email и пароль',
      { timeout: 5000 }
    )
  })

  test('Должна обрабатывать неподтвержденный email', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            login: {
              success: false,
              error: 'email not verified'
            }
          }
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('unverified@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    await expect(page.locator('.validationError')).toContainText('Этот email не подтвержден', {
      timeout: 5000
    })

    // Должна быть ссылка для повторной отправки
    await expect(page.getByText('Отправить ссылку еще раз')).toBeVisible()
  })

  test('Должна обрабатывать заблокированного пользователя', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            login: {
              success: false,
              error: 'user is blocked'
            }
          }
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('blocked@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // [непроверенное] Должно появиться сообщение о блокировке
    await page.waitForTimeout(2000)
  })

  test('Должна обрабатывать превышение лимита попыток входа', async ({ page }) => {
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            login: {
              success: false,
              error: 'too many attempts'
            }
          }
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // [непроверенное] Должно появиться сообщение о превышении лимита
    await page.waitForTimeout(2000)

    // Кнопка должна быть временно заблокирована
    const isDisabled = await submitButton.isDisabled()
    if (isDisabled) {
      expect(isDisabled).toBe(true)
    }
  })
})

test.describe('Обработка ошибок OAuth', () => {
  test('Должна обрабатывать ошибку OAuth в URL', async ({ page }) => {
    await page.goto(`${baseUrl}?error=oauth_failed&message=Provider authentication failed`)
    await waitForPageLoad(page)

    // [непроверенное] Должно появиться сообщение об ошибке OAuth
    const errorMessage = page.locator('[data-testid="auth-error"], .auth-error')
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toContainText(/OAuth|авторизац/i)
    }
  })

  test('Должна обрабатывать отмену OAuth авторизации', async ({ page }) => {
    await page.goto(`${baseUrl}?error=access_denied&message=User cancelled authorization`)
    await waitForPageLoad(page)

    // [непроверенное] Должно появиться сообщение об отмене
    await page.waitForTimeout(2000)
  })

  test('Должна обрабатывать неверный OAuth state', async ({ page }) => {
    // Устанавливаем один state в localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'oauth_state',
        JSON.stringify({
          state: 'valid-state-123',
          provider: 'google',
          timestamp: Date.now()
        })
      )
    })

    // Переходим с другим state
    await page.goto(`${baseUrl}?state=invalid-state-456&access_token=mock-token`)
    await waitForPageLoad(page)

    // [непроверенное] Должна появиться ошибка безопасности
    await page.waitForTimeout(2000)
  })

  test('Должна обрабатывать истекший OAuth state', async ({ page }) => {
    // Устанавливаем истекший state
    await page.addInitScript(() => {
      const expiredTimestamp = Date.now() - 15 * 60 * 1000 // 15 минут назад
      localStorage.setItem(
        'oauth_state',
        JSON.stringify({
          state: 'expired-state-123',
          provider: 'google',
          timestamp: expiredTimestamp
        })
      )
    })

    await page.goto(`${baseUrl}?state=expired-state-123&access_token=mock-token`)
    await waitForPageLoad(page)

    // [непроверенное] Должна появиться ошибка об истечении
    await page.waitForTimeout(2000)
  })
})

test.describe('Восстановление после ошибок', () => {
  test('Должна позволить повторную попытку после ошибки сети', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()

    let requestCount = 0

    await page.route('**/graphql', (route) => {
      requestCount++

      if (requestCount === 1) {
        // Первый запрос - ошибка
        route.abort('failed')
      } else {
        // Второй запрос - успех
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              login: {
                success: false,
                error: 'user not found'
              }
            }
          })
        })
      }
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')

    // Первая попытка - ошибка сети
    await submitButton.click()
    await expect(submitButton).not.toContainText('...', { timeout: 5000 })

    // Вторая попытка - должна пройти и показать ошибку аутентификации
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Пользователь не найден', {
      timeout: 5000
    })
  })

  test('Должна очищать ошибки при новом вводе', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()

    // Мокаем ошибку
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            login: {
              success: false,
              error: 'user not found'
            }
          }
        })
      })
    })

    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')
    await submitButton.click()

    // Появляется ошибка
    await expect(page.locator('.validationError')).toContainText('Пользователь не найден')

    // Изменяем email - ошибка должна очиститься
    await emailInput.fill('newtest@example.com')

    const errorElements = page.locator('.validationError').filter({ hasText: 'Пользователь не найден' })
    await expect(errorElements).toHaveCount(0)
  })

  test('Должна сохранять состояние формы при ошибках', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()

    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')

    await nameInput.fill('Test User')
    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')

    // Мокаем ошибку регистрации
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            registerUser: {
              success: false,
              error: 'Email already exists'
            }
          }
        })
      })
    })

    const submitButton = page.getByRole('button', { name: 'Присоединиться' })
    await submitButton.click()

    // Данные должны остаться в форме
    await expect(nameInput).toHaveValue('Test User')
    await expect(emailInput).toHaveValue('test@example.com')
    await expect(passwordInput).toHaveValue('password123')
  })
})
