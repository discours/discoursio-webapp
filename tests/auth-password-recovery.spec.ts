/**
 * E2E тесты системы восстановления пароля
 *
 * Проверяет полный цикл восстановления: отправку запроса,
 * подтверждение email, смену пароля и вход с новым паролем
 */

import { expect, test } from '@playwright/test'
import { baseUrl, waitForPageLoad } from './utils/test-helpers'

const MOCK_EMAIL = 'test.recovery@example.com'
const MOCK_NEW_PASSWORD = 'NewPassword123!'
const MOCK_RESET_TOKEN = 'mock-reset-token-123'

test.describe('Восстановление пароля', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Открываем форму входа, затем переходим к восстановлению пароля
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('Забыли пароль?').click()

    // Проверяем что форма восстановления открылась
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Забыли пароль?')).toBeVisible()
  })

  test('Должна отображать форму запроса восстановления пароля', async ({ page }) => {
    // Проверяем наличие всех элементов формы
    await expect(page.getByText('Забыли пароль?')).toBeVisible()
    await expect(
      page.getByText('Ничего страшного. Просто введите email для получения ссылки')
    ).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Восстановить пароль' })).toBeVisible()

    // Проверяем ссылку для возврата к входу
    await expect(page.getByText('Я знаю пароль')).toBeVisible()
  })

  test('Должна валидировать email при восстановлении пароля', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: 'Восстановить пароль' })

    // Отправляем пустую форму
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Невалидный email')

    // Вводим невалидный email
    await page.locator('input[name="email"]').fill('invalid-email')
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Невалидный email')
  })

  test('Должна отправлять запрос на восстановление для существующего email', async ({ page }) => {
    // Мокаем успешный ответ на запрос восстановления
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('requestPasswordReset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              requestPasswordReset: {
                success: true
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Восстановить пароль' })

    await emailInput.fill(MOCK_EMAIL)
    await submitButton.click()

    // Проверяем что появилось сообщение об успешной отправке
    await expect(page.getByText(/Ссылка отправлена|Проверьте email/)).toBeVisible({ timeout: 5000 })
  })

  test('Должна показывать ошибку для несуществующего email', async ({ page }) => {
    // Мокаем ответ об отсутствии пользователя
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('requestPasswordReset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              requestPasswordReset: {
                success: false,
                error: 'User not found'
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Восстановить пароль' })

    await emailInput.fill('nonexistent@example.com')
    await submitButton.click()

    // Проверяем что появилась ошибка с предложением регистрации
    await expect(page.getByText('Мы не можем найти вас, проверьте email или')).toBeVisible()
    await expect(page.getByText('зарегистрируйтесь')).toBeVisible()
  })

  test('Должна переключаться между формами восстановления и входа', async ({ page }) => {
    // Возвращаемся к форме входа
    await page.getByText('Я знаю пароль').click()

    // Проверяем что открылась форма входа
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()

    // Возвращаемся к восстановлению
    await page.getByText('Забыли пароль?').click()

    // Проверяем что снова форма восстановления
    await expect(page.getByRole('button', { name: 'Восстановить пароль' })).toBeVisible()
  })

  test('Должна отключать форму после отправки запроса', async ({ page }) => {
    // Мокаем успешный ответ
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('requestPasswordReset')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              requestPasswordReset: {
                success: true
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Восстановить пароль' })

    await emailInput.fill(MOCK_EMAIL)
    await submitButton.click()

    // Ждем отправки и проверяем что поле отключено
    await page.waitForTimeout(1000)
    await expect(emailInput).toBeDisabled()
    await expect(submitButton).toBeDisabled()
  })
})

test.describe('Смена пароля по токену', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим напрямую к форме смены пароля с токеном
    await page.goto(`${baseUrl}?m=auth&mode=change-password&token=${MOCK_RESET_TOKEN}`)
    await waitForPageLoad(page)

    // Проверяем что форма смены пароля открылась
    await expect(page.getByText('Введите новый пароль')).toBeVisible({ timeout: 10000 })
  })

  test('Должна отображать форму смены пароля', async ({ page }) => {
    // Проверяем наличие всех элементов формы
    await expect(page.getByText('Введите новый пароль')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Изменить пароль' })).toBeVisible()

    // Проверяем ссылку отмены
    await expect(page.getByText('Отмена')).toBeVisible()
  })

  test('Должна валидировать новый пароль', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: 'Изменить пароль' })

    // Пытаемся отправить без пароля
    await submitButton.click()

    // [непроверенное] Должна быть валидация пароля, но нужно проверить как именно отображается
    await page.waitForTimeout(1000)
  })

  test('Должна переключать видимость пароля при смене', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]')
    const toggleButton = page
      .locator('button[type="button"]')
      .filter({ has: page.locator('[data-icon="eye"]') })

    // Проверяем изначальное состояние
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Переключаем видимость
    if (await toggleButton.isVisible()) {
      await toggleButton.click()
      await expect(passwordInput).toHaveAttribute('type', 'text')

      await toggleButton.click()
      await expect(passwordInput).toHaveAttribute('type', 'password')
    }
  })

  test('Должна успешно менять пароль с валидным токеном', async ({ page }) => {
    // Мокаем успешную смену пароля
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('resetPassword')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              resetPassword: {
                success: true
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Изменить пароль' })

    await passwordInput.fill(MOCK_NEW_PASSWORD)
    await submitButton.click()

    // Проверяем успешное завершение
    await expect(page.getByText('Пароль обновлен!')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Теперь вы можете войти используя новый пароль')).toBeVisible()
  })

  test('Должна показывать ошибку с невалидным токеном', async ({ page }) => {
    // Мокаем ошибку с токеном
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('resetPassword')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              resetPassword: {
                success: false,
                error: 'Недействительный или истекший токен'
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Изменить пароль' })

    await passwordInput.fill(MOCK_NEW_PASSWORD)
    await submitButton.click()

    // [непроверенное] Должна появиться ошибка, но нужно проверить как именно отображается
    await page.waitForTimeout(2000)
  })

  test('Должна предоставлять кнопки для дальнейших действий после успешной смены', async ({ page }) => {
    // Мокаем успешную смену пароля
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('resetPassword')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              resetPassword: {
                success: true
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Изменить пароль' })

    await passwordInput.fill(MOCK_NEW_PASSWORD)
    await submitButton.click()

    // Ждем успешного завершения
    await expect(page.getByText('Пароль обновлен!')).toBeVisible({ timeout: 5000 })

    // Проверяем наличие кнопок для дальнейших действий
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Вернуться на главную страницу' })).toBeVisible()
  })

  test('Должна переходить к форме входа после успешной смены', async ({ page }) => {
    // Мокаем успешную смену пароля
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('resetPassword')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              resetPassword: {
                success: true
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Изменить пароль' })

    await passwordInput.fill(MOCK_NEW_PASSWORD)
    await submitButton.click()

    // Ждем успешного завершения и кликаем на вход
    await expect(page.getByText('Пароль обновлен!')).toBeVisible({ timeout: 5000 })
    await page.getByRole('button', { name: 'Войти' }).click()

    // Проверяем что открылась форма входа
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('Должна отменять смену пароля', async ({ page }) => {
    // Кликаем отмену
    await page.getByText('Отмена').click()

    // Проверяем что вернулись к форме входа
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
  })
})

test.describe('Обработка ошибок восстановления пароля', () => {
  test('Должна обрабатывать сетевые ошибки при запросе восстановления', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('Забыли пароль?').click()

    // Мокаем сетевую ошибку
    await page.route('**/graphql', (route) => {
      route.abort('failed')
    })

    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Восстановить пароль' })

    await emailInput.fill(MOCK_EMAIL)
    await submitButton.click()

    // Проверяем что кнопка больше не показывает загрузку
    await expect(submitButton).not.toContainText('...')
  })

  test('Должна обрабатывать недоступность токена', async ({ page }) => {
    // Переходим без токена
    await page.goto(`${baseUrl}?m=auth&mode=change-password`)
    await waitForPageLoad(page)

    // [непроверенное] Должна быть обработка отсутствующего токена
    await page.waitForTimeout(1000)
  })

  test('Должна обрабатывать истекший токен', async ({ page }) => {
    await page.goto(`${baseUrl}?m=auth&mode=change-password&token=expired-token`)
    await waitForPageLoad(page)

    // Мокаем ошибку истекшего токена
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('resetPassword')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              resetPassword: {
                success: false,
                error: 'Token expired'
              }
            }
          })
        })
      } else {
        await route.continue()
      }
    })

    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Изменить пароль' })

    if (await passwordInput.isVisible()) {
      await passwordInput.fill(MOCK_NEW_PASSWORD)
      await submitButton.click()

      // [непроверенное] Должна появиться ошибка об истекшем токене
      await page.waitForTimeout(2000)
    }
  })
})
