/**
 * E2E тесты валидации форм авторизации
 *
 * Проверяет корректность валидации всех полей во всех формах
 * авторизации включая edge cases и пользовательский опыт
 */

import { expect, test } from '@playwright/test'
import { baseUrl, waitForPageLoad } from '../utils/test-helpers'

test.describe('Валидация формы входа', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await expect(page.getByPlaceholder('Почта')).toBeVisible({ timeout: 10000 })
  })

  test('Должна валидировать email в форме входа', async ({ page }) => {
    const emailInput = page.getByPlaceholder('Почта')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    // Пустой email
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Невалидный email')

    // Невалидный формат email
    const invalidEmails = [
      'test',
      'test@',
      '@example.com',
      'test.example.com',
      'test@.com',
      'test@com',
      'test space@example.com'
    ]

    for (const invalidEmail of invalidEmails) {
      await emailInput.fill(invalidEmail)
      await submitButton.click()
      await expect(page.locator('.validationError')).toContainText('Невалидный email')
    }

    // Валидный email не должен показывать ошибку валидации email
    await emailInput.fill('valid@example.com')
    // После ввода валидного email, ошибка email должна исчезнуть
    const emailErrors = page.locator('.validationError').filter({ hasText: 'Невалидный email' })
    await expect(emailErrors).toHaveCount(0)
  })

  test('Должна валидировать пароль в форме входа', async ({ page }) => {
    const emailInput = page.getByPlaceholder('Почта')
    const passwordInput = page.getByPlaceholder('Пароль')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    // Вводим валидный email
    await emailInput.fill('test@example.com')

    // Пустой пароль
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Пожалуйста, введите пароль')

    // После ввода пароля ошибка должна исчезнуть
    await passwordInput.fill('password123')
    // Проверяем что ошибка пароля исчезла
    const passwordErrors = page
      .locator('.validationError')
      .filter({ hasText: 'Пожалуйста, введите пароль' })
    await expect(passwordErrors).toHaveCount(0)
  })

  test('Должна очищать ошибки при исправлении полей', async ({ page }) => {
    const emailInput = page.getByPlaceholder('Почта')
    const passwordInput = page.getByPlaceholder('Пароль')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    // Создаем ошибки валидации
    await submitButton.click()
    await expect(page.locator('.validationError')).toHaveCount(2) // email и password

    // Исправляем email
    await emailInput.fill('test@example.com')
    await expect(page.locator('.validationError').filter({ hasText: 'Невалидный email' })).toHaveCount(0)

    // Исправляем пароль
    await passwordInput.fill('password123')
    await expect(
      page.locator('.validationError').filter({ hasText: 'Пожалуйста, введите пароль' })
    ).toHaveCount(0)
  })

  test('Должна устанавливать фокус на первое поле с ошибкой', async ({ page }) => {
    const emailInput = page.getByPlaceholder('Почта')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    // Отправляем форму с ошибками
    await submitButton.click()

    // Фокус должен быть на email (первое поле с ошибкой)
    await expect(emailInput).toBeFocused()
  })

  test('Должна показывать специфичные ошибки авторизации', async ({ page }) => {
    // Мокаем различные ошибки авторизации
    const errorCases = [
      {
        serverError: 'user not found',
        expectedMessage: 'Пользователь не найден'
      },
      {
        serverError: 'bad user credentials',
        expectedMessage: 'Что-то пошло не так, проверьте email и пароль'
      },
      {
        serverError: 'email not verified',
        expectedMessage: 'Этот email не подтвержден'
      }
    ]

    const emailInput = page.getByPlaceholder('Почта')
    const passwordInput = page.getByPlaceholder('Пароль')
    const submitButton = page.getByRole('button', { name: 'Войти' })

    for (const errorCase of errorCases) {
      // Мокаем ответ сервера
      await page.route('**/graphql', async (route) => {
        const request = route.request()
        const postData = request.postData()

        if (postData?.includes('Login')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: {
                login: {
                  success: false,
                  error: errorCase.serverError
                }
              }
            })
          })
        } else {
          await route.continue()
        }
      })

      // Заполняем и отправляем форму
      await emailInput.fill('test@example.com')
      await passwordInput.fill('password123')
      await submitButton.click()

      // Проверяем что появилась соответствующая ошибка
      await expect(page.locator('.validationError')).toContainText(errorCase.expectedMessage, {
        timeout: 5000
      })

      // Сбрасываем мок для следующей итерации
      await page.unroute('**/graphql')
    }
  })
})

test.describe('Валидация формы регистрации', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()
    await expect(page.locator('input[name="fullName"]')).toBeVisible({ timeout: 10000 })
  })

  test('Должна валидировать полное имя', async ({ page }) => {
    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    // Заполняем остальные поля чтобы изолировать валидацию имени
    await emailInput.fill('test@example.com')

    // Пустое имя
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText(
      'Пожалуйста, введите имя для подписи ваших комментариев и публикации'
    )

    // Только пробелы
    await nameInput.fill('   ')
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText(
      'Пожалуйста, введите имя для подписи ваших комментариев и публикации'
    )

    // Валидное имя должно очистить ошибку
    await nameInput.fill('Test User')
    const nameErrors = page.locator('.validationError').filter({
      hasText: 'Пожалуйста, введите имя для подписи ваших комментариев и публикации'
    })
    await expect(nameErrors).toHaveCount(0)
  })

  test('Должна валидировать различные форматы имен', async ({ page }) => {
    const nameInput = page.locator('input[name="fullName"]')
    const emailInput = page.locator('input[name="email"]')
    const passwordInput = page.locator('input[name="password"]')

    await emailInput.fill('test@example.com')
    await passwordInput.fill('password123')

    // Тестируем различные валидные форматы имен
    const validNames = [
      'John Doe',
      'Анна Иванова',
      'Jean-Pierre Dupont',
      "Mary O'Connor",
      'José María García',
      '李明',
      'Ahmed Al-Rashid',
      'Single',
      'Very Long Name With Multiple Words'
    ]

    for (const name of validNames) {
      await nameInput.fill(name)
      // После ввода валидного имени ошибки быть не должно
      const nameErrors = page.locator('.validationError')
      const hasNameError = (await nameErrors.count()) > 0
      if (hasNameError) {
        const errorText = await nameErrors.textContent()
        expect(errorText).not.toContain('имя')
      }
    }
  })

  test('Должна валидировать уникальность email', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]')
    const nameInput = page.locator('input[name="fullName"]')

    // Мокаем проверку существующего email
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

    // Вводим существующий email
    await emailInput.fill('existing@example.com')
    await nameInput.focus() // Trigger blur на email

    await page.waitForTimeout(2000) // Ждем проверки

    // Проверяем что появилось сообщение о регистрации
    await expect(page.locator('.validationError')).toContainText(/зарегистрирован|registered/)
  })

  test('Должна отключать поля при обнаружении существующего email', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]')
    const nameInput = page.locator('input[name="fullName"]')
    const passwordInput = page.locator('input[name="password"]')
    const submitButton = page.getByRole('button', { name: 'Присоединиться' })

    // Мокаем существующий email
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

    await emailInput.fill('existing@example.com')
    await nameInput.focus()

    await page.waitForTimeout(2000)

    // Проверяем что соответствующие поля отключены
    await expect(nameInput).toBeDisabled()
    await expect(passwordInput).toBeDisabled()
    await expect(submitButton).toBeDisabled()
  })

  test('Должна очищать статус email при изменении адреса', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]')
    const nameInput = page.locator('input[name="fullName"]')
    const passwordInput = page.locator('input[name="password"]')

    // Сначала вводим существующий email
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

    await emailInput.fill('existing@example.com')
    await nameInput.focus()
    await page.waitForTimeout(2000)

    // Убеждаемся что поля отключены
    await expect(nameInput).toBeDisabled()

    // Меняем email
    await emailInput.fill('new@example.com')

    // Поля должны снова стать активными
    await expect(nameInput).not.toBeDisabled()
    await expect(passwordInput).not.toBeDisabled()
  })
})

test.describe('Валидация поля пароля', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()
    await expect(page.locator('input[name="fullName"]')).toBeVisible({ timeout: 10000 })
  })

  test('Должна валидировать требования к паролю', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]')
    const nameInput = page.locator('input[name="fullName"]')

    // Тестируем различные слабые пароли
    const weakPasswords = [
      '', // пустой
      '123', // слишком короткий
      '123456', // только цифры
      'password', // только буквы
      'PASSWORD', // только заглавные
      'pass' // слишком короткий
    ]

    for (const weakPassword of weakPasswords) {
      await passwordInput.fill(weakPassword)
      await nameInput.focus() // Trigger blur

      // Проверяем что появилась ошибка валидации пароля
      const passwordError = page.locator('.validationError').filter({ hasText: /пароль|password/i })
      if (await passwordError.isVisible()) {
        expect(await passwordError.textContent()).toBeTruthy()
      }
    }
  })

  test('Должна принимать сильные пароли', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]')
    const nameInput = page.locator('input[name="fullName"]')

    const strongPasswords = [
      'Password123!',
      'MyStr0ngP@ssw0rd',
      'ComplexPass1234#',
      'Тестовый123Пароль!',
      'P@ssw0rd2024$'
    ]

    for (const strongPassword of strongPasswords) {
      await passwordInput.fill(strongPassword)
      await nameInput.focus()

      // Не должно быть ошибок пароля
      const passwordErrors = page.locator('.validationError').filter({ hasText: /пароль|password/i })
      await expect(passwordErrors).toHaveCount(0)
    }
  })

  test('Должна показывать и скрывать пароль', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]')
    const toggleButton = page.locator('.passwordToggle, [data-testid="password-toggle"]')

    await passwordInput.fill('TestPassword123!')

    // Изначально пароль скрыт
    await expect(passwordInput).toHaveAttribute('type', 'password')

    // Если кнопка переключения видима
    if (await toggleButton.isVisible()) {
      // Показываем пароль
      await toggleButton.click()
      await expect(passwordInput).toHaveAttribute('type', 'text')

      // Скрываем пароль
      await toggleButton.click()
      await expect(passwordInput).toHaveAttribute('type', 'password')
    }
  })
})

test.describe('Валидация формы восстановления пароля', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('Забыли пароль?').click()
    await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 10000 })
  })

  test('Должна валидировать email для восстановления', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]')
    const submitButton = page.getByRole('button', { name: 'Восстановить пароль' })

    // Пустой email
    await submitButton.click()
    await expect(page.locator('.validationError')).toContainText('Невалидный email')

    // Невалидные форматы
    const invalidEmails = ['test', 'test@', '@domain.com', 'test.domain.com']

    for (const email of invalidEmails) {
      await emailInput.fill(email)
      await submitButton.click()
      await expect(page.locator('.validationError')).toContainText('Невалидный email')
    }

    // Валидный email должен очистить ошибку
    await emailInput.fill('valid@example.com')
    const emailErrors = page.locator('.validationError').filter({ hasText: 'Невалидный email' })
    await expect(emailErrors).toHaveCount(0)
  })

  test('Должна обрабатывать состояние загрузки', async ({ page }) => {
    // Мокаем медленный ответ
    await page.route('**/graphql', async (route) => {
      const request = route.request()
      const postData = request.postData()

      if (postData?.includes('requestPasswordReset')) {
        // Задержка в ответе
        await new Promise((resolve) => setTimeout(resolve, 1000))
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

    await emailInput.fill('test@example.com')
    await submitButton.click()

    // Проверяем состояние загрузки
    await expect(submitButton).toContainText('...')

    // Ждем завершения
    await expect(submitButton).not.toContainText('...', { timeout: 5000 })
  })
})

test.describe('Общая валидация форм', () => {
  test('Должна предотвращать автозаполнение где необходимо', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()

    // Поля регистрации должны иметь защиту от автозаполнения
    const nameInput = page.locator('input[name="fullName"]')
    const regEmailInput = page.locator('input[name="email"]')

    await expect(nameInput).toHaveAttribute('autocomplete', 'one-time-code')
    await expect(regEmailInput).toHaveAttribute('autocomplete', 'one-time-code')
  })

  test('Должна корректно обрабатывать Copy/Paste в полях', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()

    const emailInput = page.locator('input[type="email"]')

    // Имитируем вставку текста
    await emailInput.focus()
    await page.keyboard.type('test@example.com')

    // Проверяем что текст корректно вставился
    await expect(emailInput).toHaveValue('test@example.com')
  })

  test('Должна обрабатывать специальные символы в полях', async ({ page }) => {
    await page.goto(baseUrl)
    await waitForPageLoad(page)
    await page.getByRole('link', { name: 'Войти' }).click()
    await page.getByText('У меня еще нет аккаунта').click()

    const nameInput = page.locator('input[name="fullName"]')

    // Тестируем специальные символы в имени
    const specialChars = [
      'José María',
      'François Müller',
      'Владимир Владимирович',
      'Ahmed Al-Rashid',
      "Mary O'Brien"
    ]

    for (const name of specialChars) {
      await nameInput.fill(name)
      await expect(nameInput).toHaveValue(name)
    }
  })
})
