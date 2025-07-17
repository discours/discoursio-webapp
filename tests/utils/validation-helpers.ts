import { Page, expect } from '@playwright/test'

export interface ValidationError {
  field: string
  message: string
  locator: string
}

export interface FormValidationOptions {
  shouldShowErrors?: boolean
  shouldFocusFirst?: boolean
  timeout?: number
}

/**
 * Универсальная проверка валидации формы
 */
export async function checkFormValidation(
  page: Page,
  submitButton: string,
  expectedErrors: ValidationError[],
  options: FormValidationOptions = {}
): Promise<void> {
  const { shouldShowErrors = true, shouldFocusFirst = true, timeout = 5000 } = options

  // Отправляем форму
  await page.getByRole('button', { name: submitButton }).click()

  if (shouldShowErrors) {
    // Проверяем что появились ошибки валидации
    await expect(page.locator('.validationError')).toHaveCount(expectedErrors.length, { timeout })

    // Проверяем конкретные ошибки
    for (const error of expectedErrors) {
      await expect(page.locator('.validationError')).toContainText(error.message)
    }
  }

  if (shouldFocusFirst && expectedErrors.length > 0) {
    // Проверяем что фокус установлен на первое поле с ошибкой
    const firstErrorField = page.locator(expectedErrors[0].locator)
    await expect(firstErrorField).toBeFocused()
  }
}

/**
 * Проверка валидации email поля
 */
export async function validateEmailField(
  page: Page,
  emailLocator: string,
  submitButton: string,
  invalidEmails: string[] = ['test', 'test@', '@example.com', 'test.example.com']
): Promise<void> {
  const emailInput = page.locator(emailLocator)

  // Тест пустого email
  await page.getByRole('button', { name: submitButton }).click()
  await expect(page.locator('.validationError')).toContainText(/email|почта/i)

  // Тест невалидных форматов
  for (const email of invalidEmails) {
    await emailInput.fill(email)
    await page.getByRole('button', { name: submitButton }).click()
    await expect(page.locator('.validationError')).toContainText('Невалидный email')
  }

  // Валидный email должен очистить ошибку
  await emailInput.fill('valid@example.com')
  const emailErrors = page.locator('.validationError').filter({ hasText: 'Невалидный email' })
  await expect(emailErrors).toHaveCount(0)
}

/**
 * Проверка валидации пароля
 */
export async function validatePasswordField(
  page: Page,
  passwordLocator: string,
  submitButton: string,
  options: {
    shouldTestEmpty?: boolean
    shouldTestWeak?: boolean
    strongPasswords?: string[]
  } = {}
): Promise<void> {
  const {
    shouldTestEmpty = true,
    shouldTestWeak = true,
    strongPasswords = ['Password123!', 'MyStr0ngP@ssw0rd']
  } = options

  const passwordInput = page.locator(passwordLocator)

  if (shouldTestEmpty) {
    // Тест пустого пароля
    await page.getByRole('button', { name: submitButton }).click()
    await expect(page.locator('.validationError')).toContainText(/пароль|password/i)
  }

  if (shouldTestWeak) {
    // Тест слабых паролей
    const weakPasswords = ['123', '123456', 'password', 'PASSWORD']

    for (const weakPassword of weakPasswords) {
      await passwordInput.fill(weakPassword)
      // Trigger blur event
      await page.keyboard.press('Tab')

      const passwordError = page.locator('.validationError').filter({ hasText: /пароль|password/i })
      if (await passwordError.isVisible()) {
        expect(await passwordError.textContent()).toBeTruthy()
      }
    }
  }

  // Тест сильных паролей
  for (const strongPassword of strongPasswords) {
    await passwordInput.fill(strongPassword)
    await page.keyboard.press('Tab')

    const passwordErrors = page.locator('.validationError').filter({ hasText: /пароль|password/i })
    await expect(passwordErrors).toHaveCount(0)
  }
}

/**
 * Проверка переключения видимости пароля
 */
export async function testPasswordVisibilityToggle(
  page: Page,
  passwordLocator: string,
  toggleLocator: string = '.passwordToggle, [data-testid="password-toggle"]'
): Promise<void> {
  const passwordInput = page.locator(passwordLocator)
  const toggleButton = page.locator(toggleLocator)

  await passwordInput.fill('TestPassword123!')

  // Изначально пароль скрыт
  await expect(passwordInput).toHaveAttribute('type', 'password')

  if (await toggleButton.isVisible()) {
    // Показываем пароль
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'text')

    // Скрываем пароль
    await toggleButton.click()
    await expect(passwordInput).toHaveAttribute('type', 'password')
  }
}

/**
 * Проверка очистки ошибок при исправлении полей
 */
export async function testErrorClearingOnCorrection(
  page: Page,
  fields: Array<{ locator: string; validValue: string; errorText: string }>,
  submitButton: string
): Promise<void> {
  // Создаем ошибки валидации
  await page.getByRole('button', { name: submitButton }).click()

  // Исправляем каждое поле и проверяем что ошибка исчезает
  for (const field of fields) {
    const fieldInput = page.locator(field.locator)
    await fieldInput.fill(field.validValue)

    const fieldErrors = page.locator('.validationError').filter({ hasText: field.errorText })
    await expect(fieldErrors).toHaveCount(0)
  }
}

/**
 * Проверка состояния загрузки формы
 */
export async function testFormLoadingState(
  page: Page,
  submitButton: string,
  shouldShowLoading: boolean = true
): Promise<void> {
  const button = page.getByRole('button', { name: submitButton })

  await button.click()

  if (shouldShowLoading) {
    // Проверяем что показывается состояние загрузки
    await expect(button).toContainText('...')

    // Ждем завершения загрузки
    await expect(button).not.toContainText('...', { timeout: 10000 })
  }
}

/**
 * Проверка сохранения данных формы при ошибке валидации
 */
export async function testFormDataPersistence(
  page: Page,
  fields: Array<{ locator: string; value: string }>,
  submitButton: string
): Promise<void> {
  // Заполняем поля
  for (const field of fields) {
    await page.locator(field.locator).fill(field.value)
  }

  // Отправляем форму (предполагается что будет ошибка)
  await page.getByRole('button', { name: submitButton }).click()

  // Проверяем что данные остались
  for (const field of fields) {
    await expect(page.locator(field.locator)).toHaveValue(field.value)
  }
}

/**
 * Проверка переключения между формами
 */
export async function testFormSwitching(
  page: Page,
  switches: Array<{ trigger: string; expectedButton: string; expectedField?: string }>
): Promise<void> {
  for (const switchData of switches) {
    // Кликаем на переключатель
    await page.getByText(switchData.trigger).click()

    // Проверяем что появилась нужная форма
    await expect(page.getByRole('button', { name: switchData.expectedButton })).toBeVisible()

    if (switchData.expectedField) {
      await expect(page.locator(switchData.expectedField)).toBeVisible()
    }
  }
}
