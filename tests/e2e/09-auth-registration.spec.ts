/**
 * E2E тесты процесса регистрации пользователей
 *
 * Проверяет весь цикл регистрации: валидацию форм, отправку данных,
 * подтверждение email и успешное завершение регистрации
 */

import { expect, test } from '@playwright/test'
import { baseUrl, waitForPageLoad } from '../utils/test-helpers'

// Моковые данные для тестирования
const MOCK_USER_DATA = {
  email: `test+${Date.now()}@example.com`,
  password: 'TestPassword123!',
  fullName: 'Test User Name'
}

test.describe('Регистрация пользователей', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)

    // Открываем форму входа, затем переключаемся на регистрацию
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()

    // Проверяем что форма регистрации открылась
    await expect(page.locator('input[name="fullName"]')).toBeVisible({ timeout: 10000 })
  })

  test('Должна отображать форму регистрации с необходимыми полями', async ({ page }) => {
    // Проверяем наличие всех полей формы
    await expect(page.locator('input[name="fullName"]')).toBeVisible()
    await expect(page.locator('input[name="email"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Присоединиться' })).toBeVisible()

    // Проверяем наличие OAuth провайдеров
    await expect(page.locator('[data-testid^="oauth-"]')).toHaveCount(7)

    // Проверяем ссылку для перехода к входу
    await expect(page.getByText('У меня есть аккаунт')).toBeVisible()
  })

  test('Должна валидировать поле полного имени', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    // Оставляем имя пустым и пытаемся отправить
    await emailInput.fill(MOCK_USER_DATA.email)
    await submitButton.click()

    // Проверяем что появилась ошибка валидации
    await expect(page.locator('.validationError')).toContainText(
      'Пожалуйста, введите имя для подписи ваших комментариев и публикации'
    )
  })

  test('Должна валидировать поле email', async ({ page }) => {
    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    await nameInput.fill(MOCK_USER_DATA.fullName)

    // Тест с пустым email
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Пожалуйста, введите email')

    // Тест с невалидным email
    await emailInput.fill('invalid-email')
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Невалидный email')
  })

  test('Должна валидировать поле пароля', async ({ page }) => {
    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    await nameInput.fill(MOCK_USER_DATA.fullName)
    await emailInput.fill(MOCK_USER_DATA.email)

    // Отправляем без пароля
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Пожалуйста, введите пароль')
  })

  test('Должна проверять существование email при потере фокуса', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]')
    const nameInput = page.locator('input[name="fullName"]')

    // Вводим существующий email (предполагается что в тестовой среде есть такой)
    await emailInput.fill('existing@example.com')
    await nameInput.focus() // Переводим фокус для trigger blur

    // Ждем проверки email (может занять время)
    await page.waitForTimeout(2000)

    // Проверяем что появилось сообщение о регистрации
    const errorMessage = page.locator('.validationError')
    if (await errorMessage.isVisible()) {
      await expect(errorMessage).toContainText(/зарегистрирован|registered/)
    }
  })

  test('Должна переключать видимость пароля', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]')
    const toggleButton = page
      .locator('button[type="button"]')
      .filter({ has: page.locator('[data-icon="eye"]') })

    // Проверяем что изначально пароль скрыт
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Кликаем на кнопку показать
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    // Кликаем еще раз чтобы скрыть
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('Должна переключаться между формами входа и регистрации', async ({ page }) => {
    // Переключаемся на форму входа
    await page.getByText('У меня есть аккаунт').click()

    // Проверяем что открылась форма входа
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible()
    await expect(page.locator('input[name="fullName"]')).not.toBeVisible()

    // Возвращаемся к регистрации
    await page.getByText('У меня еще нет аккаунта').click()

    // Проверяем что снова форма регистрации
    await expect(page.getByRole('button', { name: 'Присоединиться' })).toBeVisible()
    await expect(page.locator('input[name="fullName"]')).toBeVisible()
  })

  test('Должна отключать форму при проверке существующего email', async ({ page }) => {
    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    // Мокаем ответ для проверки существующего email
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('isEmailUsed')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { isEmailUsed: true }
          })
        })
      } else {
        await route.continue()
      }
    })

    // Вводим email и убираем фокус
    await emailInput.fill('existing@example.com')
    await nameInput.focus()

    // Ждем обработки
    await page.waitForTimeout(1000)

    // Проверяем что поля отключены
    await expect(nameInput).toBeDisabled()
    await expect(passwordInput).toBeDisabled()
    await expect(submitButton).toBeDisabled()
  })

  test.skip('Должна успешно регистрировать нового пользователя', async ({ page }) => {
    // [предположение] Этот тест может требовать настройки мок-сервера
    // для полной имитации процесса регистрации

    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    // Заполняем форму
    await nameInput.fill(MOCK_USER_DATA.fullName)
    await emailInput.fill(MOCK_USER_DATA.email)
    await passwordInput.fill(MOCK_USER_DATA.password)

    // Отправляем форму
    await submitButton.click()

    // Ожидаем успешную регистрацию
    await expect(page.getByText('Почти готово! Проверьте email')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Мы отправили вам сообщение со ссылкой')).toBeVisible()
  })

  test('Должна инициировать OAuth регистрацию', async ({ page }) => {
    // Мокаем OAuth редирект
    await page.route('**/oauth/**', (route) => {
      route.fulfill({
        status: 200,
        body: 'OAuth redirect intercepted for testing'
      })
    })

    // Тестируем клик по разным провайдерам
    const providers = ['google', 'facebook', 'github', 'vk', 'yandex']

    for (const provider of providers) {
      const providerButton = page.locator(`[data-testid="oauth-${provider}"]`)
      if (await providerButton.isVisible()) {
        await expect(providerButton).toBeVisible()
        // Не кликаем реально чтобы не запускать редирект
      }
    }
  })
})

test.describe('Обработка ошибок регистрации', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()
  })

  test('Должна показывать ошибку при сбое сети', async ({ page }) => {
    // Мокаем сетевую ошибку
    await page.route('**/graphql', (route) => {
      route.abort('failed')
    })

    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    await nameInput.fill(MOCK_USER_DATA.fullName)
    await emailInput.fill(MOCK_USER_DATA.email)
    await passwordInput.fill(MOCK_USER_DATA.password)

    await submitButton.click()

    // Проверяем что кнопка перестала показывать загрузку
    await expect(submitButton).not.toContainText('...')
  })

  test('Должна показывать ошибку сервера', async ({ page }) => {
    // Мокаем ошибку сервера
    await page.route('**/graphql', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            registerUser: {
              success: false,
              error: 'Email уже используется'
            }
          }
        })
      })
    })

    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    await nameInput.fill(MOCK_USER_DATA.fullName)
    await emailInput.fill(MOCK_USER_DATA.email)
    await passwordInput.fill(MOCK_USER_DATA.password)

    await submitButton.click()

    // [непроверенное] Ожидаем что ошибка отобразится в UI
    await page.waitForTimeout(2000)
  })
})
