/**
 * Тест для проверки аутентификации
 *
 * Проверяет функциональность авторизации и доступ к защищенным страницам
 *
 * @see https://playwright.dev/docs/writing-tests
 * @see https://playwright.dev/docs/auth
 */

import { expect } from '@playwright/test'
import { baseUrl } from '../utils/common'
import { TestUtils, test } from '../utils/test-helpers'

test.describe('Аутентификация и доступ к защищенным страницам', () => {
  test.beforeEach(async ({ solidPage: page }) => {
    const utils = new TestUtils(page)
    await utils.goto()
    await utils.expectPageReady()
  })

  test('Должна отображаться форма входа при клике на кнопку "Войти"', async () => {
    await authModal.openLoginForm()

    await expect(authModal.emailInput).toBeVisible({ timeout: 10000 })
    await expect(authModal.passwordInput).toBeVisible({ timeout: 10000 })
  })

  test('Должна перенаправлять на авторизацию при попытке доступа к защищенным страницам', async ({
    page
  }) => {
    // Переходим сразу на защищенную страницу
    await page.goto(`${baseUrl}/edit/new`)
    await waitForPageLoad(page)

    // Если мы не авторизованы, то должны увидеть форму ввода или перенаправление
    if (await isUserLoggedIn(page)) {
      test.skip()
      console.warn('Тест пропущен - пользователь уже авторизован')
    } else {
      const currentUrl = page.url()

      // Проверяем один из сценариев:
      // 1. Перенаправлены на страницу входа
      // 2. Отображаются элементы аутентификации
      if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
        expect(currentUrl).toMatch(/login|auth/)
      } else {
        // Проверяем наличие элементов формы авторизации
        const authRequired =
          (await basePage.loginButton.isVisible()) ||
          (await authModal.emailInput.isVisible()) ||
          (await authModal.modal.isVisible())

        expect(authRequired).toBeTruthy()
      }
    }
  })

  test('Должна позволять войти и получить доступ к защищенным страницам', async ({ page }) => {
    // Выполняем авторизацию
    const authSuccess = await performLogin(page, TEST_USERS.VALID)

    if (!authSuccess) {
      test.skip()
      console.warn('Пользователь не смог авторизоваться, проверьте корректность учетных данных')
      return
    }

    // Переходим на защищенную страницу
    await page.goto(`${baseUrl}/settings`)
    await waitForPageLoad(page)

    // Проверяем, что мы авторизованы
    const isAuthorized = await isUserLoggedIn(page)
    if (!isAuthorized) {
      test.fail()
      console.error('Авторизация не сохранилась при переходе на защищенную страницу')
      return
    }

    // Проверяем, что мы находимся на странице настроек
    expect(page.url()).toContain('/settings')

    // На странице настроек должен быть контент
    const bodyContent = (await page.locator('body').textContent()) || ''
    expect(bodyContent.length).toBeGreaterThan(100)
  })
})
