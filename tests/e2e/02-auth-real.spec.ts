/**
 * Реальные тесты авторизации без моков
 *
 * Тестируют реальное поведение форм и UI состояний
 */

import { expect } from '@playwright/test'
import { TestUtils, test } from '../utils/test-helpers'

test.describe('Авторизация - UI поведение', () => {
  test('Открытие формы входа', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Ищем кнопку входа
    const loginButton = page
      .locator('a:has-text("Войти"), button:has-text("Войти"), [data-testid="login-button"]')
      .first()
    await expect(loginButton).toBeVisible()

    await loginButton.click()

    // Проверяем что форма входа появилась
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"], button:has-text("Войти")')).toBeVisible()
  })

  test('Валидация полей формы входа', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Открываем форму входа
    await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()
    await expect(page.locator('input[type="email"]')).toBeVisible()

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const submitButton = page.locator('button[type="submit"], button:has-text("Войти")').first()

    // Тест пустых полей
    await submitButton.click()

    // Проверяем что поля подсвечены как обязательные (HTML5 валидация или custom)
    const emailValid = await emailInput.evaluate((el) => (el as HTMLInputElement).validity.valid)
    expect(emailValid).toBeFalsy()

    // Тест неверного формата email
    await emailInput.fill('invalid-email')
    await submitButton.click()

    const emailValidAfterInvalid = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valid
    )
    expect(emailValidAfterInvalid).toBeFalsy()

    // Валидный email должен проходить валидацию
    await emailInput.fill('test@example.com')
    const emailValidAfterValid = await emailInput.evaluate((el) => (el as HTMLInputElement).validity.valid)
    expect(emailValidAfterValid).toBeTruthy()
  })

  test('Переключение между формами входа и регистрации', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Открываем форму входа
    await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Переключаемся на регистрацию
    const signupLink = page
      .locator('a:has-text("регистрации"), a:has-text("аккаунт"), span:has-text("аккаунт")')
      .first()
    if (await signupLink.isVisible()) {
      await signupLink.click()

      // Проверяем что появились поля регистрации
      await expect(page.locator('input[name="fullName"], input[placeholder*="имя"]')).toBeVisible({
        timeout: 3000
      })
    }

    // Возвращаемся к входу
    const loginLink = page.locator('a:has-text("есть аккаунт"), span:has-text("есть аккаунт")').first()
    if (await loginLink.isVisible()) {
      await loginLink.click()

      // Проверяем что поле имени исчезло
      await expect(page.locator('input[name="fullName"]')).not.toBeVisible()
    }
  })

  test('Закрытие модального окна авторизации', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Открываем форму входа
    await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Пробуем закрыть через ESC
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Проверяем что форма закрылась
    const emailVisible = await page.locator('input[type="email"]').isVisible()
    expect(emailVisible).toBeFalsy()
  })

  test('Переход к восстановлению пароля', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Открываем форму входа
    await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Ищем ссылку забыли пароль
    const forgotLink = page.locator('a:has-text("Забыли"), span:has-text("Забыли")').first()
    if (await forgotLink.isVisible()) {
      await forgotLink.click()

      // Проверяем что появилась форма восстановления
      await expect(page.locator('input[name="email"]')).toBeVisible()
      await expect(page.locator('button:has-text("Восстановить")')).toBeVisible()
    }
  })

  test('Доступ к защищенным страницам без авторизации', async ({ page }) => {
    const utils = new TestUtils(page)

    // Пробуем перейти на защищенную страницу
    await utils.goto('/edit')
    await utils.expectPageReady()

    // Должна появиться форма авторизации или редирект
    const authRequired =
      (await page.locator('input[type="email"]').isVisible()) ||
      page.url().includes('auth') ||
      page.url().includes('login')

    expect(authRequired).toBeTruthy()
  })

  test('OAuth провайдеры отображаются', async ({ page }) => {
    const utils = new TestUtils(page)

    await utils.goto('/')
    await utils.expectPageReady()

    // Открываем форму входа
    await page.locator('a:has-text("Войти"), button:has-text("Войти")').first().click()
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // Проверяем наличие OAuth кнопок
    const oauthButtons = page.locator('[data-testid^="oauth-"], .oauth-button, .social-login')
    const count = await oauthButtons.count()

    expect(count).toBeGreaterThan(0)

    // Проверяем что кнопки кликабельны
    if (count > 0) {
      const firstButton = oauthButtons.first()
      await expect(firstButton).toBeVisible()
      // Не кликаем реально, чтобы не запускать редирект
    }
  })
})
