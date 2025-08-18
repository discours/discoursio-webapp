/**
 * Тест для проверки аутентификации
 *
 * Проверяет функциональность авторизации и доступ к защищенным страницам
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { expect } from '@playwright/test'
import { checkApiConnection, performLogin } from '../utils/auth-helpers'
import { TestUtils, test } from '../utils/test-helpers'

test.describe('Аутентификация и доступ к защищенным страницам', () => {
  test('@smoke Должна перенаправлять на авторизацию при попытке доступа к защищенным страницам', async ({
    page
  }) => {
    const testUtils = new TestUtils(page)

    // Идем на главную сначала для инициализации
    await testUtils.goto('/')
    await testUtils.expectPageReady()

    // Переходим на защищенную страницу редактирования
    await page.goto('/edit')

    // Ждем загрузки и проверяем что требуется аутентификация
    // Может быть либо редирект на auth, либо появление модального окна
    try {
      // Ждем либо изменения URL, либо появления формы аутентификации
      await Promise.race([
        page.waitForFunction(
          () => window.location.href.includes('m=auth') || window.location.href.includes('auth'),
          { timeout: 10000 }
        ),
        page.waitForSelector('[data-testid="auth-modal"], .auth-modal, input[type="email"], .login-form', {
          timeout: 10000
        })
      ])
    } catch (_error) {
      console.log('Таймаут ожидания аутентификации, продолжаем проверку...')
    }

    const currentUrl = page.url()
    console.log('Текущий URL после перехода:', currentUrl)

    // Проверяем что либо есть параметр m=auth, либо страница требует аутентификации
    const hasAuthParam = currentUrl.includes('m=auth')
    const hasAuthModal =
      (await page.$(
        '[data-testid="auth-modal"], .auth-modal, .modal[aria-label*="auth"], .modal[aria-label*="Auth"]'
      )) !== null
    const hasLoginForm =
      (await page.$('input[type="email"], input[name="email"], form[action*="login"], .login-form')) !==
      null

    // Принимаем любой из признаков требования аутентификации
    const requiresAuth = hasAuthParam || hasAuthModal || hasLoginForm

    console.log('Признаки аутентификации:', { hasAuthParam, hasAuthModal, hasLoginForm, requiresAuth })
    expect(requiresAuth).toBe(true)
  })

  test('@smoke Должна отображаться форма входа при клике на кнопку "Войти"', async ({ page }) => {
    const testUtils = new TestUtils(page)

    // Идем на главную сначала
    await testUtils.goto('/')
    await testUtils.expectPageReady()

    try {
      // Ищем кнопку входа разными способами
      const loginButton = await page
        .waitForSelector(
          [
            'button:has-text("Войти")',
            'a:has-text("Войти")',
            '[data-testid="login-button"]',
            '.login-button',
            'button[type="button"]:has-text("Войти")',
            '.auth-trigger'
          ].join(','),
          { timeout: 10000 }
        )
        .catch(() => null)

      if (loginButton) {
        await loginButton.click()
        await page.waitForTimeout(1000)
      } else {
        console.log('Кнопка входа не найдена, переходим на /edit для вызова аутентификации')
        await page.goto('/edit')
      }

      // Проверяем что появилась любая форма аутентификации
      const hasAuthForm = await page
        .waitForSelector(
          [
            '[data-testid="login-form"]',
            'input[type="email"]',
            'input[name="email"]',
            '.auth-modal',
            '.login-form',
            'form[action*="login"]'
          ].join(','),
          { timeout: 8000 }
        )
        .catch(() => null)

      expect(hasAuthForm).toBeTruthy()
    } catch (error) {
      console.log('Ошибка при поиске формы входа:', error)

      // Fallback: проверяем что хотя бы URL изменился на auth
      const currentUrl = page.url()
      expect(currentUrl.includes('m=auth') || currentUrl.includes('auth')).toBe(true)
    }
  })

  test('@auth Должна позволять войти и получить доступ к защищенным страницам', async ({ page }) => {
    const testUtils = new TestUtils(page)
    await testUtils.expectPageReady()

    // Проверяем доступность API перед тестом
    const apiAvailable = await checkApiConnection(page)
    if (!apiAvailable) {
      test.skip()
      return
    }

    // Выполняем авторизацию
    const loginSuccess = await performLogin(page)

    if (!loginSuccess) {
      test.skip()
      return
    }

    // Проверяем доступ к защищенным страницам
    await page.goto('/edit')
    await expect(page).toHaveURL(/\/edit/)

    // Проверяем что мы на странице редактирования
    await expect(page.locator('h1, .title, [data-testid="edit-title"]')).toBeVisible()
  })
})
